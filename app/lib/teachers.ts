// The teachers, in the order the answers are shown: by popularity in Indonesia.
import type { Lang } from "./storage";

export type Start = "on" | "off" | "ism";

export interface Teacher {
  id: string;
  /** The teacher's title in English; `titleId` is the Indonesian one when it differs. */
  title: string;
  titleId?: string;
  tradition: string;
  traditionId: string;
  /** "off": a religion with a smaller audience, "ism": a teaching, not a religion. Both start switched off. */
  start: Start;
}

export const TEACHERS: Teacher[] = [
  { id: "islam", title: "Sheikh", titleId: "Ustadz", tradition: "Islam", traditionId: "Islam", start: "on" },
  { id: "protestant", title: "Pastor", titleId: "Pendeta", tradition: "Protestant", traditionId: "Protestan", start: "on" },
  { id: "catholic", title: "Father", titleId: "Romo", tradition: "Catholic", traditionId: "Katolik", start: "on" },
  { id: "hinduism", title: "Acharya", titleId: "Acarya", tradition: "Hinduism", traditionId: "Hindu", start: "off" },
  { id: "buddhism", title: "Bhante", tradition: "Buddhism", traditionId: "Buddha", start: "off" },
  { id: "confucianism", title: "Laoshi", tradition: "Confucianism", traditionId: "Khonghucu", start: "off" },
  { id: "abism", title: "Abi", tradition: "Abism", traditionId: "Abimisme", start: "ism" },
];

export const teacherIndex = (id: string): number => TEACHERS.findIndex((t) => t.id === id);
export const teacherById = (id: string): Teacher | undefined => TEACHERS.find((t) => t.id === id);

export const titleOf = (t: Teacher, lang: Lang): string => (lang === "id" && t.titleId) || t.title;
export const traditionOf = (t: Teacher, lang: Lang): string => (lang === "id" && t.traditionId) || t.tradition;

/** Teachers that start switched off for a visitor who has not seen them yet. */
export const OFF_AT_FIRST = TEACHERS.filter((t) => t.start !== "on").map((t) => t.id);
