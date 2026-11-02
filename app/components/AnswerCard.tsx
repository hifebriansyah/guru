// One card, the same for every teacher and for the screener. The heading follows the page language, so a language switch relabels it.
import { useTranslation } from "react-i18next";
import type { Card } from "~/features/ask/state";
import { renderAnswer } from "~/lib/cite";
import type { Lang } from "~/lib/storage";
import { teacherById, titleOf, traditionOf } from "~/lib/teachers";
import { cn } from "~/lib/util";

export function AnswerCard({ card, lang }: { card: Card; lang: Lang }) {
  const { t } = useTranslation();
  const teacher = card.id ? teacherById(card.id) : undefined;
  const title = teacher ? titleOf(teacher, lang) : "Screener";
  let body: React.ReactNode;
  if (card.status === "waiting") body = t("thinking");
  else if (card.status === "failed") body = t("failed");
  else if (card.status === "declined") body = (card.decline || t("decline")).replace("{title}", title);
  else if (teacher) body = <div dangerouslySetInnerHTML={{ __html: renderAnswer(card.text, lang) }} />; // renderAnswer escapes everything first
  else body = card.text;
  return (
    <li className={cn("answer", card.status === "waiting" && "waiting", card.status === "failed" && "failed")}>
      <h2>
        {title}{" "}
        {teacher && <small>· {traditionOf(teacher, lang)}</small>}
      </h2>
      <div className="body">{body}</div>
    </li>
  );
}
