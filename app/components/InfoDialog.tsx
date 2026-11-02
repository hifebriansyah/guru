// A modal with a fixed title bar and a scrolling body: the privacy policy and the disclaimer. A section is [heading, text];
// a blank line in the text starts a new paragraph. Closes with the × button, Escape, or a click outside.
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Section } from "~/i18n/en";
import { Icon } from "./Icon";

export function InfoDialog({ open, title, sections, onClose }: { open: boolean; title: string; sections: Section[]; onClose: () => void }) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={dialog} className="policy" aria-labelledby={titleId} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="policy-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon" aria-label={t("close")} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="policy-body">
        {sections.map(([heading, text]) => (
          <section key={heading}>
            <h3>{heading}</h3>
            {text.split("\n\n").map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </dialog>
  );
}
