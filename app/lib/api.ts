// Talks to the guru Worker (worker/guru.js): POST /ask streams one JSON line per teacher, GET /answer/<slug> gives what is saved.
export const WORKER_URL: string = import.meta.env.VITE_WORKER_URL || "https://guru-worker.situs.id";

/** The first line of an answer: what the screener decided. */
export interface ScreenerLine {
  id: "screener";
  slug?: string;
  /** no teacher can answer: `message` says why */
  outOfScope?: boolean;
  message?: string;
  /** the teachers that will answer; the others say `decline` */
  religions?: string[];
  decline?: string;
}

export interface TeacherLine {
  id: string;
  title?: string;
  tradition?: string;
  answer?: string;
  error?: string;
}

export type Line = ScreenerLine | TeacherLine;

export const isScreener = (line: Line): line is ScreenerLine => line.id === "screener";

export class AskError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** POST /ask and hand every line of the streamed answer to `onLine`. Throws AskError when the Worker refuses. */
export async function streamAnswer(question: string, teachers: string[], onLine: (line: Line) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`${WORKER_URL}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, teachers }), signal });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AskError(err.error || "", res.status);
  }
  if (!res.body) throw new AskError("", 502);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const l of lines) if (l.trim()) onLine(JSON.parse(l) as Line);
  }
  if (buffer.trim()) onLine(JSON.parse(buffer) as Line);
}

export interface SavedAnswer {
  question: string;
  answers: Record<string, string>;
  outOfScope: boolean;
  message: string;
}

/** GET /answer/<slug>: what is saved for that question, or null when nothing is. */
export async function fetchSaved(slug: string, signal?: AbortSignal): Promise<SavedAnswer | null> {
  try {
    const res = await fetch(`${WORKER_URL}/answer/${encodeURIComponent(slug)}`, { signal });
    return res.ok ? ((await res.json()) as SavedAnswer) : null;
  } catch {
    return null;
  }
}
