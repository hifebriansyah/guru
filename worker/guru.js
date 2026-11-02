// The guru Worker: one question in, one answer from each teacher out (agents/*.md), streamed as each one is ready.
//
//   GET /answer/<slug>  ->  {"question","answers":{"islam":"..."},"outOfScope":false,"message":""}: what is saved for that question (404 if nothing)
//   POST /ask   {"question": "...", "teachers": ["islam", ...] (optional: only these are asked)}  ->  NDJSON, one line per teacher as it finishes:
//               {"id":"islam","title":"Ustadz","tradition":"Islam","answer":"..."}   or   {"id":"islam",...,"error":"..."}
//               A screener (agents/screener.md) reads the question first and sends one line before the teachers:
//               Both screener lines also carry "slug", the address of the question (column slug of table answer).
//               {"id":"screener","religions":["islam",...],"decline":"As {title}, ..."}  the teachers that will answer (the others stay silent), or
//               {"id":"screener","outOfScope":true,"message":"..."}  when scripture cannot answer it (a price, code, the weather): no teacher is asked.
//
// Settings (worker/guru.jsonc): ALLOWED_ORIGINS, THINKING_LEVEL (or THINKING_BUDGET), MAX_OUTPUT_TOKENS, AXIOM_DATASET, AXIOM_URL, the rate limit LIMITER.
// Database: D1 binding DB, tables answer and questions (tools/setup_db.py). A teacher's answer is saved once and reused for the same question.
// Secrets: GEMINI_API_KEY, entered in the Cloudflare dashboard (deploys keep it); AXIOM_TOKEN, copied from .env by the deploy.
//
// Request log (Axiom, when AXIOM_TOKEN is set), like omonomon's: one line per teacher per question with what was sent to Gemini
// (teacher, question, settings) and what came back (answer or error, token counts, tries), plus the visitor's IP address, country
// and browser; and one line for each refused request. That is personal data: the page says questions are logged.

// Filled in by tools/deploy_worker.py from agents/*.md: [{id, title, tradition, prompt}]
const PERSONAS = __PERSONAS__;
// Filled in from agents/screener.md: the prompt of the screener, who decides which teachers a question goes to (or none).
const SCREENER = __SCREENER__;

const QUESTION_MAX = 500;
const LENGTH_RULE = "Keep the answer under 200 words: a short, warm answer the person can read on a phone. Plain paragraphs; you may use " +
  "*italics* and **bold**, but no headings, lists of more than three items, or tables. This is a single answer, not a conversation: never ask the " +
  "person a question, never offer more help, and never invite a follow-up (no \"would you like...\", \"feel free to ask\", \"tell me more\"). End with the answer itself.";

// How a teacher cites. The page (index.html, REFS) turns each tag into a link only when it has exactly this shape; a model never writes an address.
const CITE_RULE = "When you cite a text, write the reference as a tag in double square brackets, exactly in one of these forms, and never write any web address: " +
  "[[quran 2:286]] (surah:verse); [[bible Matthew 5:44]] (English book name, chapter:verse); [[ccc 1234]] (Catechism of the Catholic Church paragraph); " +
  "[[gita 2.47]] (Bhagavad Gita chapter.verse); [[sutta mn10]] or [[sutta an3.65]] (only dn, mn, sn, an, snp, ud, iti, written like these, no spaces); " +
  "[[analects 4.15]] (book.chapter); [[abism 1:3:5]] (Kitab Nasihat Bapak Bapak jilid:bab:bait, only for Abi and only a saying you were given). Use a tag only for one single reference you are sure of. For any other text (Vedas, Upanishads, Dhammapada, Mencius, hadith and so on) " +
  "just name it in plain words, with no tag.";

const MODEL = "gemini-3.8-flash";  // the teachers always use this model: no fallback to another one
const SCREENER_MODEL = "gemini-3.5-flash-lite";  // the screener only sorts a question into JSON, so a cheaper model is enough

function logLine(env, ctx, event) {
  if (!env.AXIOM_TOKEN) return;
  const url = `${env.AXIOM_URL || "https://us-east-1.aws.edge.axiom.co"}/v1/ingest/${encodeURIComponent(env.AXIOM_DATASET || "guru.situs.id")}`;
  ctx.waitUntil(fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.AXIOM_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ _time: new Date().toISOString(), worker: "guru", ...event }]),
  }).catch(() => {}));  // a lost log line never breaks an answer
}

class GeminiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

function generationConfig(env) {
  const config = { maxOutputTokens: Number(env.MAX_OUTPUT_TOKENS || 700), temperature: 0.7 };
  if (env.THINKING_LEVEL) config.thinkingConfig = { thinkingLevel: env.THINKING_LEVEL };  // Gemini 3 models take a level (minimal, low, medium, high)
  else if (env.THINKING_BUDGET !== undefined && env.THINKING_BUDGET !== "") config.thinkingConfig = { thinkingBudget: Number(env.THINKING_BUDGET) };
  return config;
}

async function askModel(env, persona, question, config = generationConfig(env), model = MODEL) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: persona.prompt }] },
      contents: [{ role: "user", parts: [{ text: question }] }],
      generationConfig: config,
    }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
  const u = data?.usageMetadata || {};
  const usage = { tokensIn: u.promptTokenCount, tokensOut: u.candidatesTokenCount, tokensThinking: u.thoughtsTokenCount, tokensTotal: u.totalTokenCount, finish: data?.candidates?.[0]?.finishReason };
  if (res.ok && text) return { text, usage };
  // Gemini's own reason, plus which quota ran out on a 429 (for example a per-minute limit): it never holds the key.
  const quota = (data?.error?.details || []).flatMap((d) => d.violations || []).map((v) => v.quotaId || v.quotaMetric).filter(Boolean).join(", ");
  throw new GeminiError(res.ok ? "no answer" : `Gemini ${res.status}${quota ? ` [${quota}]` : ""}${data?.error?.message ? `: ${data.error.message}` : ""}`, res.status);
}

// The screener reads the question first: {answerable, religions: [ids], message, decline}. If it fails or answers nonsense, every teacher is asked,
// so a broken screener never blocks a real question.
async function screen(env, question, trace) {
  const config = { maxOutputTokens: 300, temperature: 0, responseMimeType: "application/json" };  // no thinkingConfig: the lite model refuses it
  try {
    const { text, usage } = await askOne(env, { prompt: SCREENER }, question, trace, config, SCREENER_MODEL);
    const verdict = JSON.parse(text);
    const ids = new Set(PERSONAS.map((p) => p.id));
    const religions = Array.isArray(verdict.religions) ? verdict.religions.filter((r) => ids.has(r)) : [];
    if (typeof verdict.answerable !== "boolean") throw new Error("bad verdict");
    if (verdict.answerable && !religions.length) throw new Error("no religion chosen");
    return { answerable: verdict.answerable, religions, message: String(verdict.message || "").slice(0, 400), decline: String(verdict.decline || "").slice(0, 200), usage };
  } catch (err) {
    return { answerable: true, religions: PERSONAS.map((p) => p.id), message: "", error: String(err.message || err).slice(0, 300) };
  }
}

// The row a question uses in table answer: lower case, single spaces, no punctuation at either end, so "Apa itu surga?" and
// "apa itu surga!" share one. tools/setup_db.py has the same key() for the migration.
function key(question) {
  const spaced = question.toLowerCase().replace(/\s+/g, " ").trim();
  const k = spaced.replace(/^[\s¡¿"'“”‘’(]+|[\s?!.。,;:…"'“”‘’)]+$/g, "").replace(/\s+([?!.,])/g, "$1");
  return k || spaced;  // a question of punctuation only ("???") keeps it
}

// Table answer (D1): a row per key, a column per teacher (named by the teacher's id), NULL until that teacher was asked.
// Table questions: each question exactly as typed -> its row in answer (id). It is read first, so a question can be pointed at
// any row by hand; a question not in it uses the row of its key, and is added once that row exists.
// A database failure never blocks an answer: reading gives {} (everyone is asked), writing is skipped.
async function savedAnswers(env, question, key) {
  if (!env.DB) return {};
  try {
    const linked = await env.DB.prepare("SELECT answer.* FROM questions JOIN answer ON answer.id = questions.answer_id WHERE questions.question = ?").bind(question).first();
    if (linked) return { ...linked, linked: true };
    return (await env.DB.prepare("SELECT * FROM answer WHERE question = ?").bind(key).first()) || {};
  } catch {
    return {};
  }
}

// Adds the question as typed to table questions, pointing at the row of its key (nothing when that row does not exist yet, or the question is already there).
async function linkQuestion(env, question, key) {
  if (!env.DB) return;
  try {
    await env.DB.prepare("INSERT OR IGNORE INTO questions (question, answer_id) SELECT ?1, id FROM answer WHERE question = ?2").bind(question, key).run();
  } catch {}
}

// Columns <id>_answerable: the screener's verdict for each teacher, 1 (its tradition can answer) or 0. A question nobody can answer is all 0,
// and column screener then holds the screener's answer to show.
// Saving: into the row found for the question (row.id), or else into the row of its key, made on the first save.
async function saveVerdict(env, row, key, religions, message) {
  if (!env.DB) return;
  const cols = PERSONAS.map((p) => `"${p.id}_answerable"`);
  const values = [...PERSONAS.map((p) => (religions.includes(p.id) ? 1 : 0)), message || null];
  try {
    if (row.id) {
      await env.DB.prepare(`UPDATE answer SET ${cols.map((c, i) => `${c} = ?${i + 2}`).join(", ")}, screener = ?${cols.length + 2}, updated_at = datetime('now') WHERE id = ?1`)
        .bind(row.id, ...values).run();
      return;
    }
    await env.DB.prepare(`INSERT INTO answer (question, ${cols.join(", ")}, screener, updated_at) VALUES (?1, ${cols.map((_, i) => `?${i + 2}`).join(", ")}, ?${cols.length + 2}, datetime('now'))
      ON CONFLICT(question) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}, screener = excluded.screener, updated_at = datetime('now')`)
      .bind(key, ...values).run();
  } catch {}
}

async function saveAnswer(env, row, key, id, text) {
  if (!env.DB || !PERSONAS.some((p) => p.id === id)) return;  // the id is a column name: only a known teacher's is ever used
  try {
    if (row.id) {
      await env.DB.prepare(`UPDATE answer SET "${id}" = ?2, updated_at = datetime('now') WHERE id = ?1`).bind(row.id, text).run();
      return;
    }
    await env.DB.prepare(`INSERT INTO answer (question, "${id}", updated_at) VALUES (?1, ?2, datetime('now'))
      ON CONFLICT(question) DO UPDATE SET "${id}" = excluded."${id}", updated_at = datetime('now')`).bind(key, text).run();
  } catch {}
}

// Column slug of table answer: the address of the question, made from its words ("apa surga itu ada?" -> "apa-surga-itu-ada"), unique, made once and kept.
function slugify(question) {
  const s = question.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return s || crypto.randomUUID().slice(0, 8);  // a question with no letters or digits at all
}

// Gives the question's row a slug (making the row if the question is new) and puts row.id and row.slug on `row`.
// Another row may already own the slug (the same words with other letters or punctuation): then -2, -3 ... are tried.
async function ensureSlug(env, row, key) {
  if (!env.DB || row.slug) return;
  const base = slugify(key);
  for (let i = 0; i < 7; i++) {
    const slug = i === 0 ? base : i < 6 ? `${base}-${i + 1}` : `${base}-${crypto.randomUUID().slice(0, 6)}`;
    try {
      if (row.id) await env.DB.prepare("UPDATE answer SET slug = ?2 WHERE id = ?1").bind(row.id, slug).run();
      else await env.DB.prepare(`INSERT INTO answer (question, slug, updated_at) VALUES (?1, ?2, datetime('now')) ON CONFLICT(question) DO UPDATE SET slug = COALESCE(slug, excluded.slug)`).bind(key, slug).run();
      const made = await env.DB.prepare(row.id ? "SELECT id, slug FROM answer WHERE id = ?" : "SELECT id, slug FROM answer WHERE question = ?").bind(row.id || key).first();
      if (made) { row.id = made.id; row.slug = made.slug; }
      return;
    } catch (err) {
      if (!/UNIQUE/i.test(String(err.message))) return;  // a taken slug: try the next one; any other failure: no slug, the answer still goes out
    }
  }
}

// Abi (agents/abism.md) answers from the Kitab Nasihat Bapak Bapak, which is read from the published page: ABISM_URL/kitab.md (four-part
// lines "1:3:5:2 text": jilid:bab:bait:baris) and ABISM_URL/kutipan.md (the same bait in plain words, "1:3:5 text"). The Kitab is too big to send
// with every question, so for each question the sayings that match it best are looked up and sent along with it.
const STOP = new Set("yang dan di ke dari untuk dengan pada itu ini atau juga akan sudah saya aku kamu kita mereka apa bagaimana kenapa mengapa adalah ada the and for you what how why are is my should can".split(" "));
const words = (text) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3 && !STOP.has(w));
let abismIndex = null;  // one read per Worker instance

function loadAbism(env) {
  if (!abismIndex) {
    abismIndex = (async () => {
      const base = (env.ABISM_URL || "https://guru.situs.id/abism").replace(/\/$/, "");
      const [kitab, kutipan] = await Promise.all(["kitab.md", "kutipan.md"].map(async (f) => {
        // cached for an hour, but only a good answer: a 404 (the file is not published yet) must not stick. ?v= is bumped to drop what was cached before.
        const res = await fetch(`${base}/${f}?v=2`, { cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": 3600, "400-599": 0 } } });
        if (!res.ok) throw new Error(`cannot read ${base}/${f}: ${res.status}`);
        return res.text();
      }));
      const verses = new Map();  // "1:3:5" -> {id, bab, plain, poem[]}
      const get = (id) => { if (!verses.has(id)) verses.set(id, { id, bab: "", plain: "", poem: [] }); return verses.get(id); };
      let bab = "";
      for (const line of kutipan.split("\n")) {
        const b = /^Bab \d+: (.+)$/.exec(line.trim()), m = /^(\d+:\d+:\d+) (.+)$/.exec(line.trim());
        if (b) bab = b[1];
        else if (m) Object.assign(get(m[1]), { bab, plain: m[2] });
      }
      for (const line of kitab.split("\n")) {
        const m = /^(\d+:\d+:\d+):\d+ (.+)$/.exec(line.trim());
        if (m) get(m[1]).poem.push(m[2]);
      }
      const docs = [...verses.values()].map((v) => ({ ...v, tokens: [...new Set(words(`${v.bab} ${v.plain} ${v.poem.join(" ")}`))] }));
      if (!docs.length) throw new Error("the Kitab has no verses");
      return docs;
    })();
    abismIndex.catch(() => { abismIndex = null; });  // read it again next time
  }
  return abismIndex;
}

// A keyword matches a word that is the same, or that starts with it (Indonesian affixes: "sabar" finds "bersabar", "kesabaran").
const hits = (token, keyword) => token === keyword || (keyword.length >= 4 && (token.startsWith(keyword) || token.endsWith(keyword) || (token.length >= 4 && keyword.startsWith(token))));

function searchAbism(docs, keywords, limit = 6) {
  const found = [...new Set(keywords)].map((k) => ({ k, docs: docs.filter((d) => d.tokens.some((t) => hits(t, k))) })).filter((x) => x.docs.length);
  const score = new Map();
  for (const { k, docs: matching } of found) {
    const idf = Math.log(1 + docs.length / (1 + matching.length));  // a rare word counts for more
    for (const d of matching) score.set(d, (score.get(d) || 0) + idf);
  }
  const ranked = [...score].sort((a, b) => b[1] - a[1]);
  return ranked.filter(([, n]) => n >= ranked[0][1] * 0.45).slice(0, limit).map(([d]) => d);  // not the weak matches
}

// What Abi receives: the question plus the best matching sayings. A cheap call first turns the question (in any language) into Indonesian
// search words; if that fails, the words of the question itself are used.
async function abismInput(env, ctx, who, asked, question) {
  const docs = await loadAbism(env);
  let keywords = words(question);
  try {
    const config = { maxOutputTokens: 200, temperature: 0, responseMimeType: "application/json" };
    const { text } = await askOne(env, { prompt: "You help search a book of everyday advice from Indonesian fathers (roads, money, home, health, sleep, tools, neighbours, patience). " +
      "Given the user's question in any language, reply with JSON only: {\"keywords\": [8 to 12 Indonesian words or word stems that sayings answering it would likely contain]}." }, question, { tries: 0 }, config, SCREENER_MODEL);
    const more = JSON.parse(text).keywords;
    if (Array.isArray(more)) keywords = [...keywords, ...more.flatMap((k) => words(String(k)))];
  } catch {}
  const top = searchAbism(docs, keywords);
  logLine(env, ctx, { ...who, kind: "abism", asked, question, keywords: [...new Set(keywords)].join(","), verses: top.map((d) => d.id).join(",") });
  const list = top.map((d) => `[${d.id}] (${d.bab})\n${d.plain}\n${d.poem.join(" / ")}`).join("\n\n");
  return `${question}\n\nSayings from the Kitab (cite only these, with their numbers):\n${list || "(no saying matched this question)"}`;
}

// When Gemini is busy (503) or a per-minute quota is hit (429), wait a moment and ask the same model again (twice at most).
async function askOne(env, persona, question, trace, config, model) {
  for (let attempt = 1; ; attempt++) {
    trace.tries = attempt;
    try {
      return await askModel(env, persona, question, config, model);
    } catch (err) {
      if (attempt >= 3 || !/Gemini (429|503)/.test(String(err.message))) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1500 + Math.random() * 1000));
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const started = Date.now();
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const originOk = allowed.some((a) => origin === a || origin.startsWith(`${a}:`));  // http://localhost also allows its ports
    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin : "null",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    const u = new URL(request.url);
    const who = {
      method: request.method, url: (u.host + u.pathname + u.search).slice(0, 200), origin: origin || undefined,
      ip: request.headers.get("CF-Connecting-IP") || undefined, country: request.cf?.country, ua: (request.headers.get("User-Agent") || "").slice(0, 120) || undefined,
    };
    const reply = (obj, status = 200) => {
      logLine(env, ctx, { ...who, kind: "request", status, error: obj.error, ms: Date.now() - started });
      return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
    };

    if (request.method === "OPTIONS") return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (!originOk) return reply({ error: "forbidden" }, 403);
    // GET /answer/<slug>: what is saved for that question, so a shared address shows the answers again without asking anyone.
    const found = u.pathname.match(/^\/answer\/([^/]+)$/);
    if (found && request.method === "GET") {
      let row = null;
      try { row = env.DB ? await env.DB.prepare("SELECT * FROM answer WHERE slug = ?").bind(decodeURIComponent(found[1])).first() : null; } catch {}
      if (!row) return reply({ error: "not found" }, 404);
      const answers = Object.fromEntries(PERSONAS.filter((p) => row[p.id]).map((p) => [p.id, row[p.id]]));
      return reply({ question: row.question, answers, outOfScope: PERSONAS.every((p) => row[`${p.id}_answerable`] === 0), message: row.screener || "" });
    }
    if (u.pathname !== "/ask" || request.method !== "POST") return reply({ error: "not found" }, 404);
    if (!env.GEMINI_API_KEY) return reply({ error: "not configured" }, 503);

    if (env.LIMITER && !(await env.LIMITER.limit({ key: who.ip || "unknown" })).success) return reply({ error: "too many questions, wait a minute" }, 429);

    const body = await request.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    // The teachers switched on in the page menu (all of them when the page sends none).
    const known = new Set(PERSONAS.map((p) => p.id));
    const picked = Array.isArray(body?.teachers) ? body.teachers.filter((t) => known.has(t)) : [];
    const enabled = new Set(picked.length ? picked : known);
    if (!question) return reply({ error: "empty question" }, 400);
    if (question.length > QUESTION_MAX) return reply({ error: `at most ${QUESTION_MAX} characters` }, 400);

    // Every teacher is asked at once; each line goes out as soon as its answer is back.
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (obj) => writer.write(encoder.encode(`${JSON.stringify(obj)}\n`));
    const qkey = key(question);
    const asked = crypto.randomUUID();  // ties the lines of one question together in the log
    const sent = { model: MODEL, ...generationConfig(env) };
    const run = async () => {
      // Table answer (D1): answers already saved are reused, and a question every tradition already refused is refused again with the saved screener answer.
      const saved = await savedAnswers(env, question, qkey);
      await ensureSlug(env, saved, qkey);  // the page puts it in the address bar; it also makes the row, so saved.id is set from here on
      // A question not yet in table questions is added after each save (its row may only exist from then on); once is enough when the row is already there.
      const link = saved.linked ? () => {} : () => linkQuestion(env, question, qkey);
      if (saved.id) ctx.waitUntil(link());
      const save = (write) => ctx.waitUntil(write.then(link));
      if (saved.screener && PERSONAS.every((p) => saved[`${p.id}_answerable`] === 0)) {
        logLine(env, ctx, { ...who, kind: "screener", asked, question, cached: true, answerable: false, message: saved.screener });
        await send({ id: "screener", slug: saved.slug, outOfScope: true, message: saved.screener });
        return;
      }
      // The screener goes first (one cheap call): it picks the teachers, or says the question is not for holy scripture.
      const screenTrace = { tries: 0 };
      const t1 = Date.now();
      const verdict = await screen(env, question, screenTrace);
      logLine(env, ctx, { ...who, kind: "screener", asked, question, teachers: [...enabled].join(","), model: SCREENER_MODEL, answerable: verdict.answerable, religions: verdict.religions.join(","),
        message: verdict.message, error: verdict.error, ...verdict.usage, tries: screenTrace.tries, ms: Date.now() - t1 });
      if (!verdict.error) save(saveVerdict(env, saved, qkey, verdict.religions, verdict.message));  // not when the screener failed: that verdict was only a guess
      if (!verdict.answerable) {
        await send({ id: "screener", slug: saved.slug, outOfScope: true, message: verdict.message || "This is not something holy scripture speaks to. Try asking about faith, morals or the meaning of life." });
        return;
      }
      const chosen = new Set(verdict.religions.filter((r) => enabled.has(r)));  // what the screener picked, among the teachers switched on
      await send({ id: "screener", slug: saved.slug, religions: [...chosen], decline: verdict.decline });
      // Only the teachers whose column in table answer is still empty go to Gemini.
      await Promise.all(PERSONAS.filter((p) => chosen.has(p.id)).map((p) => ask(p, saved[p.id], save, saved)));
    };
    const ask = async (p, cached, save, saved) => {
      const head = { id: p.id, title: p.title, tradition: p.tradition };
      if (cached) {
        logLine(env, ctx, { ...who, kind: "teacher", asked, teacher: p.id, question, cached: true, status: 200, answer: cached });
        await send({ ...head, answer: cached });
        return;
      }
      const trace = { tries: 0 };
      const t0 = Date.now();
      const line = { ...who, kind: "teacher", asked, teacher: p.id, question, model: sent.model, maxOutputTokens: sent.maxOutputTokens,
        thinkingBudget: sent.thinkingConfig?.thinkingBudget, thinkingLevel: sent.thinkingConfig?.thinkingLevel };
      try {
        const input = p.id === "abism" ? await abismInput(env, ctx, who, asked, question) : question;  // Abi gets the sayings that match
        const { text, usage } = await askOne(env, { prompt: `${p.prompt}\n\n${LENGTH_RULE}\n\n${CITE_RULE}` }, input, trace);
        logLine(env, ctx, { ...line, status: 200, answer: text, ...usage, tries: trace.tries, ms: Date.now() - t0 });
        save(saveAnswer(env, saved, qkey, p.id, text));
        await send({ ...head, answer: text });
      } catch (err) {
        const error = String(err.message || err).slice(0, 300);
        logLine(env, ctx, { ...line, status: err.status || 504, error, tries: trace.tries, ms: Date.now() - t0 });
        await send({ ...head, error });
      }
    };
    ctx.waitUntil(run().catch(() => {}).finally(() => writer.close()));
    return new Response(readable, { headers: { ...cors, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  },
};
