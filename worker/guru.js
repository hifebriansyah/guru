// The guru Worker: one question in, one answer from each teacher out (agents/*.md), streamed as each one is ready.
//
//   POST /ask   {"question": "..."}  ->  NDJSON, one line per teacher as it finishes:
//               {"id":"islam","title":"Ustadz","tradition":"Islam","answer":"..."}   or   {"id":"islam",...,"error":"..."}
//
// Settings (worker/guru.jsonc): ALLOWED_ORIGINS, THINKING_BUDGET, MAX_OUTPUT_TOKENS, AXIOM_DATASET, AXIOM_URL, the rate limit LIMITER.
// Secrets: GEMINI_API_KEY, entered in the Cloudflare dashboard (deploys keep it); AXIOM_TOKEN, copied from .env by the deploy.
//
// Request log (Axiom, when AXIOM_TOKEN is set), like omonomon's: one line per teacher per question with what was sent to Gemini
// (teacher, question, settings) and what came back (answer or error, token counts, tries), plus the visitor's IP address, country
// and browser; and one line for each refused request. That is personal data: the page says questions are logged.

// Filled in by tools/deploy_worker.py from agents/*.md: [{id, title, tradition, prompt}]
const PERSONAS = __PERSONAS__;

const QUESTION_MAX = 500;
const LENGTH_RULE = "Keep the answer under 200 words: a short, warm answer the person can read on a phone. Plain paragraphs; you may use " +
  "*italics* and **bold**, but no headings, lists of more than three items, or tables.";

const MODEL = "gemini-3.8-flash";  // always this model: no fallback to another one

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
  if (env.THINKING_BUDGET !== undefined && env.THINKING_BUDGET !== "") config.thinkingConfig = { thinkingBudget: Number(env.THINKING_BUDGET) };
  return config;
}

async function askModel(env, persona, question) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: `${persona.prompt}\n\n${LENGTH_RULE}` }] },
      contents: [{ role: "user", parts: [{ text: question }] }],
      generationConfig: generationConfig(env),
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

// When Gemini is busy (503) or a per-minute quota is hit (429), wait a moment and ask the same model again (twice at most).
async function askOne(env, persona, question, trace) {
  for (let attempt = 1; ; attempt++) {
    trace.tries = attempt;
    try {
      return await askModel(env, persona, question);
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
    if (!question) return reply({ error: "empty question" }, 400);
    if (question.length > QUESTION_MAX) return reply({ error: `at most ${QUESTION_MAX} characters` }, 400);

    // Every teacher is asked at once; each line goes out as soon as its answer is back.
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (obj) => writer.write(encoder.encode(`${JSON.stringify(obj)}\n`));
    const asked = crypto.randomUUID();  // ties the six lines of one question together in the log
    const sent = { model: MODEL, ...generationConfig(env) };
    const all = PERSONAS.map(async (p) => {
      const head = { id: p.id, title: p.title, tradition: p.tradition };
      const trace = { tries: 0 };
      const t0 = Date.now();
      const line = { ...who, kind: "teacher", asked, teacher: p.id, question, model: sent.model, maxOutputTokens: sent.maxOutputTokens,
        thinkingBudget: sent.thinkingConfig?.thinkingBudget };
      try {
        const { text, usage } = await askOne(env, p, question, trace);
        logLine(env, ctx, { ...line, status: 200, answer: text, ...usage, tries: trace.tries, ms: Date.now() - t0 });
        await send({ ...head, answer: text });
      } catch (err) {
        const error = String(err.message || err).slice(0, 300);
        logLine(env, ctx, { ...line, status: err.status || 504, error, tries: trace.tries, ms: Date.now() - t0 });
        await send({ ...head, error });
      }
    });
    ctx.waitUntil(Promise.all(all).finally(() => writer.close()));
    return new Response(readable, { headers: { ...cors, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  },
};
