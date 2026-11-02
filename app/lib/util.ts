/** Joins class names, skipping the ones that are false. */
export const cn = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(" ");
