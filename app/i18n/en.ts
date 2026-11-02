// English wording of the page. Indonesian is in id.ts: every key exists in both.
// A section is [heading, text]; a blank line in the text starts a new paragraph.
export type Section = [heading: string, text: string];

const en = {
  intro: "Ask one question and hear how different religions answer it.",
  label: "Your question",
  placeholder: "Does heaven exist?",
  ask: "Ask",
  thinking: "Thinking…",
  failed: "This teacher could not answer right now.",
  decline: "As {title}, I can't answer that question.",
  tooMany: "Too many questions. Please wait a minute.",
  wrong: "Something went wrong.",
  none: "Switch on at least one teacher in the menu.",
  policyBtn: "Privacy policy",
  close: "Close",
  disclaimerBtn: "Disclaimer",
  menu: "Settings",
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  language: "Language",
  teachers: "Teachers",
  description: "Ask one question and hear how different religions answer it.",
  updateReady: "A new version is ready.",
  updateNow: "Reload",
  dismiss: "Dismiss",
  settings: "Settings",
  disclaimer: [
    ["Default Active Gurus", "By default, teachings (the ‑isms) are disabled. This isn't about favouring one group over another; it's simply a practical decision to manage token usage and maintain consistency.\n\nAs the project grows, and we have a larger budget or see greater interest in the teachings (‑isms), we'll certainly reconsider enabling them by default."],
    ["Default Guru Order", "By default, gurus are listed according to their popularity in Indonesia. We may introduce the ability to customise their order in the future."],
    ["Abism", "This teaching is included purely for fun. We understand that it might not be everyone's cup of tea, but we kindly ask you to respect our decision to include it. After all, a little humour never hurts!"],
  ],
  policy: [
    ["What we keep", "Every question you ask and every answer you get is saved on our servers (a log and a database), together with your IP address, country and browser type."],
    ["Why", "To keep the service working, to find mistakes, and to reuse an answer when someone asks the same question again, so we do not have to ask the AI twice."],
    ["Links", "Each question gets its own page address, made from the words of the question. Anyone who has that address can read the question and its answers."],
    ["The AI", "Your question is sent to Google's Gemini models, which write the answers. Please read Google's own policy for how it handles what it receives."],
    ["Your device", "This page has no accounts and sets no tracking cookies. Your browser remembers only your choices (theme, language, which teachers are on)."],
    ["Please", "Do not put personal details in your question (your name, address, phone number, health or family details). Questions are saved and may be reused."],
  ],
} satisfies Record<string, string | Section[]>;

export default en;
