import type { Card } from "~/features/ask/state";
import type { Lang } from "~/lib/storage";
import { AnswerCard } from "./AnswerCard";

export function AnswerList({ cards, lang }: { cards: Card[]; lang: Lang }) {
  return (
    <ul className="answers" aria-live="polite">
      {cards.map((card) => (
        <AnswerCard key={card.id || "screener"} card={card} lang={lang} />
      ))}
    </ul>
  );
}
