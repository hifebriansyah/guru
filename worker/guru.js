// The guru Worker: one question in, one answer from each teacher out (agents/*.md), streamed as each one is ready.
//
//   POST /ask   {"question": "...", "teachers": ["islam", ...] (optional: only these are asked)}  ->  NDJSON, one line per teacher as it finishes:
//               {"id":"islam","title":"Ustadz","tradition":"Islam","answer":"..."}   or   {"id":"islam",...,"error":"..."}
//               A screener (agents/screener.md) reads the question first and sends one line before the teachers:
//               {"id":"screener","religions":["islam",...],"decline":"As {title}, ..."}  the teachers that will answer (the others stay silent), or
//               {"id":"screener","outOfScope":true,"message":"..."}  when scripture cannot answer it (a price, code, the weather): no teacher is asked.
//
// Settings (worker/guru.jsonc): ALLOWED_ORIGINS, THINKING_LEVEL (or THINKING_BUDGET), MAX_OUTPUT_TOKENS, AXIOM_DATASET, AXIOM_URL, the rate limit LIMITER.
// Database: D1 binding DB, table answer (tools/setup_db.py). A teacher's answer is saved once and reused for the same question.
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
  "[[analects 4.15]] (book.chapter). Use a tag only for one single reference you are sure of. For any other text (Vedas, Upanishads, Dhammapada, Mencius, hadith and so on) " +
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

// Table answer (D1): a row per question, a column per teacher (named by the teacher's id), NULL until that teacher was asked.
// A database failure never blocks an answer: reading gives {} (everyone is asked), writing is skipped.
async function savedAnswers(env, key) {
  if (!env.DB) return {};
  try {
    return (await env.DB.prepare("SELECT * FROM answer WHERE question = ?").bind(key).first()) || {};
  } catch {
    return {};
  }
}

// Columns <id>_answerable: the screener's verdict for each teacher, 1 (its tradition can answer) or 0. A question nobody can answer is all 0,
// and column screener then holds the screener's answer to show.
async function saveVerdict(env, key, religions, message) {
  if (!env.DB) return;
  const cols = PERSONAS.map((p) => `"${p.id}_answerable"`);
  try {
    await env.DB.prepare(`INSERT INTO answer (question, ${cols.join(", ")}, screener, updated_at) VALUES (?1, ${cols.map((_, i) => `?${i + 2}`).join(", ")}, ?${cols.length + 2}, datetime('now'))
      ON CONFLICT(question) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}, screener = excluded.screener, updated_at = datetime('now')`)
      .bind(key, ...PERSONAS.map((p) => (religions.includes(p.id) ? 1 : 0)), message || null).run();
  } catch {}
}

async function saveAnswer(env, key, id, text) {
  if (!env.DB || !PERSONAS.some((p) => p.id === id)) return;  // the id is a column name: only a known teacher's is ever used
  try {
    await env.DB.prepare(`INSERT INTO answer (question, "${id}", updated_at) VALUES (?1, ?2, datetime('now'))
      ON CONFLICT(question) DO UPDATE SET "${id}" = excluded."${id}", updated_at = datetime('now')`).bind(key, text).run();
  } catch {}
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const key = question.toLowerCase().replace(/\s+/g, " ");  // the same question typed with other spacing or capitals is the same row
    const asked = crypto.randomUUID();  // ties the lines of one question together in the log
    const sent = { model: MODEL, ...generationConfig(env) };
    const run = async () => {
      // Table answer (D1): answers already saved are reused, and a question every tradition already refused is refused again with the saved screener answer.
      const saved = await savedAnswers(env, key);
      if (saved.screener && PERSONAS.every((p) => saved[`${p.id}_answerable`] === 0)) {
        logLine(env, ctx, { ...who, kind: "screener", asked, question, cached: true, answerable: false, message: saved.screener });
        await send({ id: "screener", outOfScope: true, message: saved.screener });
        return;
      }
      // The screener goes first (one cheap call): it picks the teachers, or says the question is not for holy scripture.
      const screenTrace = { tries: 0 };
      const t1 = Date.now();
      const verdict = await screen(env, question, screenTrace);
      logLine(env, ctx, { ...who, kind: "screener", asked, question, teachers: [...enabled].join(","), model: SCREENER_MODEL, answerable: verdict.answerable, religions: verdict.religions.join(","),
        message: verdict.message, error: verdict.error, ...verdict.usage, tries: screenTrace.tries, ms: Date.now() - t1 });
      if (!verdict.error) ctx.waitUntil(saveVerdict(env, key, verdict.religions, verdict.message));  // not when the screener failed: that verdict was only a guess
      if (!verdict.answerable) {
        await send({ id: "screener", outOfScope: true, message: verdict.message || "This is not something holy scripture speaks to. Try asking about faith, morals or the meaning of life." });
        return;
      }
      const chosen = new Set(verdict.religions.filter((r) => enabled.has(r)));  // what the screener picked, among the teachers switched on
      await send({ id: "screener", religions: [...chosen], decline: verdict.decline });
      // Only the teachers whose column in table answer is still empty go to Gemini.
      await Promise.all(PERSONAS.filter((p) => chosen.has(p.id)).map((p) => ask(p, saved[p.id])));
    };
    const ask = async (p, cached) => {
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
        const { text, usage } = await askOne(env, { prompt: `${p.prompt}\n\n${LENGTH_RULE}\n\n${CITE_RULE}` }, question, trace);
        logLine(env, ctx, { ...line, status: 200, answer: text, ...usage, tries: trace.tries, ms: Date.now() - t0 });
        ctx.waitUntil(saveAnswer(env, key, p.id, text));
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
