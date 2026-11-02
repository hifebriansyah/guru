// The settings: theme, language, the privacy policy and disclaimer icons, and a switch for every teacher. Opens from the icon in the question box.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Lang, Theme } from "~/lib/storage";
import { TEACHERS, traditionOf } from "~/lib/teachers";
import { Icon } from "./Icon";
import { TeacherSwitch } from "./Switch";

export interface SettingsMenuProps {
  theme: Theme;
  lang: Lang;
  /** ids of the teachers that are switched off */
  off: string[];
  onTheme: (value: Theme) => void;
  onLang: (value: Lang) => void;
  onToggle: (id: string) => void;
  onPolicy: () => void;
  onDisclaimer: () => void;
  /** start open (Storybook) */
  defaultOpen?: boolean;
}

export function SettingsMenu({ theme, lang, off, onTheme, onLang, onToggle, onPolicy, onDisclaimer, defaultOpen = false }: SettingsMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("click", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const info = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="menu-wrap" ref={wrap}>
      <button ref={button} type="button" className="icon" aria-haspopup="true" aria-expanded={open} aria-controls="menu" aria-label={t("settings")} onClick={() => setOpen(!open)}>
        <Icon name="settings" />
      </button>
      {open && (
        <div className="menu" id="menu">
          <div className="segs">
            <div className="seg" role="group" aria-label={t("theme")}>
              <button type="button" aria-pressed={theme === "light"} aria-label={t("light")} onClick={() => onTheme("light")}>
                <Icon name="sun" />
              </button>
              <button type="button" aria-pressed={theme === "dark"} aria-label={t("dark")} onClick={() => onTheme("dark")}>
                <Icon name="moon" />
              </button>
            </div>
            <div className="seg" role="group" aria-label={t("language")}>
              <button type="button" aria-pressed={lang === "id"} onClick={() => onLang("id")}>
                ID
              </button>
              <button type="button" aria-pressed={lang === "en"} onClick={() => onLang("en")}>
                EN
              </button>
            </div>
            <button type="button" className="policy-btn" aria-label={t("policyBtn")} title={t("policyBtn")} onClick={info(onPolicy)}>
              <Icon name="shield" />
            </button>
            <button type="button" className="policy-btn" aria-label={t("disclaimerBtn")} title={t("disclaimerBtn")} onClick={info(onDisclaimer)}>
              <Icon name="info" />
            </button>
          </div>
          <hr />
          <div className="teacher-rows" role="group" aria-label={t("teachers")}>
            {TEACHERS.map((teacher) => (
              <TeacherSwitch key={teacher.id} name={traditionOf(teacher, lang)} on={!off.includes(teacher.id)} onToggle={() => onToggle(teacher.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
