// The visitor's choices: theme, language and which teachers are switched on. Saved through lib/storage.ts, applied to the page here.
import { create } from "zustand";
import { setI18nLanguage } from "~/i18n";
import { language, teacherChoices, theme, type Lang, type Theme } from "./storage";
import { OFF_AT_FIRST, TEACHERS } from "./teachers";

interface Settings {
  theme: Theme;
  lang: Lang;
  /** ids of the teachers that are switched off */
  off: string[];
  setTheme: (value: Theme) => void;
  setLang: (value: Lang) => void;
  /** switches a teacher; returns true when it is on afterwards */
  toggleTeacher: (id: string) => boolean;
  /** reads the saved choices again (Storybook swaps the storage first) */
  reload: () => void;
}

const ALL = TEACHERS.map((t) => t.id);

/** Saved choices; a teacher this browser has not seen yet (not in guru-known) starts as TEACHERS says: teachings and smaller religions off. */
function initial(): Pick<Settings, "theme" | "lang" | "off"> {
  const known = new Set(teacherChoices.known());
  const off = new Set(teacherChoices.off());
  for (const id of OFF_AT_FIRST) if (!known.has(id)) off.add(id);
  teacherChoices.save([...off], ALL);
  return { theme: theme.get(), lang: language.get(), off: [...off] };
}

function apply(next: { theme: Theme; lang: Lang }): void {
  setI18nLanguage(next.lang);
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = next.theme;
  document.documentElement.lang = next.lang;
}

export const useSettings = create<Settings>((set, get) => {
  const start = initial();
  apply(start);
  return {
    ...start,
    setTheme: (value) => {
      theme.set(value);
      apply({ theme: value, lang: get().lang });
      set({ theme: value });
    },
    setLang: (value) => {
      language.set(value);
      apply({ theme: get().theme, lang: value });
      set({ lang: value });
    },
    toggleTeacher: (id) => {
      const off = new Set(get().off);
      if (off.has(id)) off.delete(id);
      else off.add(id);
      teacherChoices.save([...off], ALL);
      set({ off: [...off] });
      return !off.has(id);
    },
    reload: () => {
      const start = initial();
      apply(start);
      set(start);
    },
  };
});

/** The teachers that are switched on, in display order. */
export const enabledIds = (off: string[]): string[] => ALL.filter((id) => !off.includes(id));
