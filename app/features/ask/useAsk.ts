// Asks the teachers and keeps the cards. One question at a time; a newer one (or a reset) makes the older stream's lines count for nothing.
import { useCallback, useEffect, useReducer, useRef } from "react";
import { flushSync } from "react-dom";
import { AskError, fetchSaved, isScreener, streamAnswer, type Line } from "~/lib/api";
import { TEACHERS } from "~/lib/teachers";
import { initialState, reducer, type Card } from "./state";

/** The first question moves the logo and the box from the middle to the top; the View Transitions API animates that move. */
function transition(update: () => void): void {
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof document === "undefined" || !document.startViewTransition || reduced) update();
  else document.startViewTransition(() => flushSync(update));
}

export interface AskOptions {
  /** called with the address (slug) of the question when the Worker has made it */
  onSlug: (slug: string) => void;
  /** called when a saved question is opened, so the box can show it */
  onQuestion: (q: string) => void;
}

export function useAsk({ onSlug, onQuestion }: AskOptions) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const current = useRef(state);
  useEffect(() => {
    current.current = state;
  });
  const run = useRef(0);

  const handle = useCallback(
    (live: () => boolean, addOn: boolean, line: Line) => {
      if (!live()) return;
      if (isScreener(line)) {
        if (line.slug) onSlug(line.slug);
        dispatch({ type: "screener", line, addOn });
      } else dispatch({ type: "teacher", line });
    },
    [onSlug],
  );

  /** Ask the teachers `ids` (the ones switched on). */
  const submit = useCallback(
    async (q: string, ids: string[]) => {
      const mine = ++run.current;
      const live = () => mine === run.current;
      const begin = () => dispatch(ids.length ? { type: "start", q, ids } : { type: "empty", q });
      if (current.current.asked) begin();
      else transition(begin);
      if (!ids.length) return;
      try {
        await streamAnswer(q, ids, (line) => handle(live, false, line));
        if (live()) dispatch({ type: "settle" });
      } catch (err) {
        if (live()) dispatch({ type: "fail", note: err instanceof AskError ? (err.status === 429 ? { key: "tooMany" } : err.message ? { text: err.message } : { key: "wrong" }) : { key: "wrong" } });
      } finally {
        if (live()) dispatch({ type: "busy", value: false });
      }
    },
    [handle],
  );

  /** A teacher is switched on while a question is shown: its card appears in its place, and only that teacher is asked
   *  (an answer already saved for this question comes straight from the database). */
  const addTeacher = useCallback(
    async (id: string) => {
      const now = current.current;
      if (!now.asked || !now.q || now.outOfScope || now.cards.some((c) => c.id === id)) return;
      const mine = run.current;
      const live = () => mine === run.current;
      dispatch({ type: "add", id });
      let screenedOut = false;
      try {
        await streamAnswer(now.q, [id], (line) => {
          if (isScreener(line) && line.outOfScope) screenedOut = true;
          handle(live, true, line);
        });
        if (!live()) return;
        dispatch(screenedOut ? { type: "remove", id } : { type: "settle", id });
      } catch {
        if (live()) dispatch({ type: "settle", id });
      }
    },
    [handle],
  );

  const removeTeacher = useCallback((id: string) => dispatch({ type: "remove", id }), []);

  const reset = useCallback(() => {
    run.current++;
    dispatch({ type: "reset" });
  }, []);

  /** Shows what is saved for an address, without asking any teacher. False when nothing is saved there. */
  const open = useCallback(
    async (slug: string, off: string[]): Promise<boolean> => {
      const mine = ++run.current;
      const data = await fetchSaved(slug);
      if (mine !== run.current) return true; // something newer took over
      if (!data) return false;
      const cards: Card[] =
        data.outOfScope && data.message
          ? [{ id: "", status: "answer", text: data.message, decline: "" }]
          : TEACHERS.filter((t) => data.answers[t.id] && !off.includes(t.id)).map((t) => ({ id: t.id, status: "answer", text: data.answers[t.id] ?? "", decline: "" }));
      if (!cards.length) return false;
      onQuestion(data.question);
      dispatch({ type: "saved", q: data.question, cards, outOfScope: cards[0]?.id === "" });
      return true;
    },
    [onQuestion],
  );

  return { state, submit, addTeacher, removeTeacher, reset, open };
}
