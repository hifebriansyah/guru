// The only file that touches localStorage. The keys are the same as the old page's, so nobody loses their choices.
// Every access is wrapped: private mode or full storage just means nothing is saved.
// Features call the typed helpers below; Storybook swaps the backend for a fake one (setStorageBackend).

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let backend: StorageBackend | null = null;

function real(): StorageBackend | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function setStorageBackend(next: StorageBackend | null): void {
  backend = next;
}

export function memoryBackend(): StorageBackend {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function get(key: string): string | null {
  try {
    return (backend ?? real())?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function set(key: string, value: string): void {
  try {
    (backend ?? real())?.setItem(key, value);
  } catch {}
}

const list = (key: string): string[] => {
  try {
    const value: unknown = JSON.parse(get(key) || "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

export type Theme = "light" | "dark";
export type Lang = "en" | "id";

export const theme = {
  /** Dark unless the visitor chose light. */
  get: (): Theme => (get("guru-theme") === "light" ? "light" : "dark"),
  set: (value: Theme) => set("guru-theme", value),
};

export const language = {
  /** The saved language, else the browser's: Indonesian when the browser is Indonesian. */
  get: (): Lang => {
    const saved = get("guru-lang");
    if (saved === "en" || saved === "id") return saved;
    return typeof navigator !== "undefined" && (navigator.language || "").toLowerCase().startsWith("id") ? "id" : "en";
  },
  set: (value: Lang) => set("guru-lang", value),
};

/** The teachers switched off (guru-off), and every teacher this browser has seen (guru-known). */
export const teacherChoices = {
  off: () => list("guru-off"),
  known: () => list("guru-known"),
  save: (off: string[], known: string[]) => {
    set("guru-off", JSON.stringify(off));
    set("guru-known", JSON.stringify(known));
  },
};
