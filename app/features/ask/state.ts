// What is on the page: the question and its cards. A pure reducer, so it is easy to read and to test; features/ask/useAsk.ts runs it.
import type { ScreenerLine, TeacherLine } from "~/lib/api";
import { teacherIndex } from "~/lib/teachers";

export type CardStatus = "waiting" | "answer" | "failed" | "declined";

/** One card. `id` is the teacher's; "" is the screener's own card (its `text` is the message). */
export interface Card {
  id: string;
  status: CardStatus;
  /** the answer (or the screener's message) */
  text: string;
  /** what a teacher who was not picked says, with {title} for its name; "" means the page's own wording */
  decline: string;
}

export type Note = { key: "none" | "tooMany" | "wrong" } | { text: string };

export interface AskState {
  /** the question that is shown */
  q: string;
  /** false until the first question: the logo and the box are in the middle of the screen */
  asked: boolean;
  busy: boolean;
  /** no teacher can answer this question: only the screener's card is shown */
  outOfScope: boolean;
  note: Note | null;
  cards: Card[];
}

export const initialState: AskState = { q: "", asked: false, busy: false, outOfScope: false, note: null, cards: [] };

export type Action =
  | { type: "start"; q: string; ids: string[] }
  | { type: "empty"; q: string }
  | { type: "screener"; line: ScreenerLine; addOn: boolean }
  | { type: "teacher"; line: TeacherLine }
  | { type: "settle"; id?: string }
  | { type: "add"; id: string }
  | { type: "remove"; id: string }
  | { type: "fail"; note: Note }
  | { type: "busy"; value: boolean }
  | { type: "saved"; q: string; cards: Card[]; outOfScope: boolean }
  | { type: "reset" };

const waiting = (id: string): Card => ({ id, status: "waiting", text: "", decline: "" });

export function reducer(state: AskState, action: Action): AskState {
  switch (action.type) {
    case "start":
      return { q: action.q, asked: true, busy: true, outOfScope: false, note: null, cards: action.ids.map(waiting) };
    case "empty":
      return { ...initialState, q: action.q, asked: true, note: { key: "none" } };
    case "screener": {
      const { line, addOn } = action;
      if (line.outOfScope) {
        // No teacher can answer: the screener's own card, in the same look as the teachers' (not the note under the form).
        if (addOn) return state; // the cards already shown stay; the card of the added teacher is dropped by the caller
        return { ...state, outOfScope: true, cards: [{ id: "", status: "answer", text: line.message ?? "", decline: "" }] };
      }
      if (!line.religions) return state;
      const picked = line.religions;
      return {
        ...state,
        cards: state.cards.map((c) => {
          if (picked.includes(c.id)) return c;
          if (addOn && c.status !== "waiting") return c; // this request was only about the added teacher: the answered cards stay as they are
          return { ...c, status: "declined", decline: line.decline ?? "" };
        }),
      };
    }
    case "teacher":
      return {
        ...state,
        cards: state.cards.map((c) => (c.id === action.line.id ? (action.line.answer ? { ...c, status: "answer", text: action.line.answer } : { ...c, status: "failed" }) : c)),
      };
    case "settle": // a card that never got a line failed
      return { ...state, cards: state.cards.map((c) => (c.status === "waiting" && (!action.id || c.id === action.id) ? { ...c, status: "failed" } : c)) };
    case "add": {
      if (state.outOfScope || state.cards.some((c) => c.id === action.id)) return state;
      const at = teacherIndex(action.id);
      const cards = [...state.cards];
      const later = cards.findIndex((c) => teacherIndex(c.id) > at); // keep the order of the teachers
      cards.splice(later === -1 ? cards.length : later, 0, waiting(action.id));
      return { ...state, note: null, cards };
    }
    case "remove":
      return { ...state, cards: state.cards.filter((c) => c.id !== action.id) };
    case "fail":
      return { ...state, cards: [], note: action.note };
    case "busy":
      return { ...state, busy: action.value };
    case "saved":
      return { q: action.q, asked: true, busy: false, outOfScope: action.outOfScope, note: null, cards: action.cards };
    case "reset":
      return initialState;
  }
}
