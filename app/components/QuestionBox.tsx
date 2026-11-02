// The box: the question grows with its text (up to 40% of the screen, then it scrolls). Enter sends, Shift+Enter starts a new line.
// The settings icon sits inside on the right (its menu is `children`), then the send button.
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";

export function QuestionBox({ value, onChange, onSubmit, busy = false, children }: { value: string; onChange: (value: string) => void; onSubmit: () => void; busy?: boolean; children?: React.ReactNode }) {
  const { t } = useTranslation();
  const area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  const empty = !value.trim();
  return (
    <form
      className="ask"
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty && !busy) onSubmit();
      }}
    >
      <label htmlFor="question" className="sr-only">
        {t("label")}
      </label>
      <textarea
        ref={area}
        id="question"
        name="question"
        rows={1}
        maxLength={500}
        required
        placeholder={t("placeholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!empty && !busy) onSubmit();
          }
        }}
      />
      {children}
      <button type="submit" className="icon send" aria-label={t("ask")} disabled={empty || busy}>
        <Icon name="send" />
      </button>
    </form>
  );
}
