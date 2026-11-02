import type { Decorator, Preview } from "@storybook/react-vite";
import { I18nextProvider } from "react-i18next";
import { i18n } from "../app/i18n";
import { useSettings } from "../app/lib/settings";
import { memoryBackend, setStorageBackend } from "../app/lib/storage";
import "../app/styles/app.css";

// Stories never touch the real localStorage and never call the real Worker: a public Storybook must not spend the Gemini budget.
setStorageBackend(memoryBackend());
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:/.test(url) && !url.startsWith(location.origin)) {
    return Promise.resolve(new Response(JSON.stringify({ error: "Storybook: network calls are switched off" }), { status: 503 }));
  }
  return realFetch(input, init);
};

const withApp: Decorator = (Story, context) => {
  const lang = context.globals.locale === "id" ? "id" : "en";
  const theme = context.globals.theme === "dark" ? "dark" : "light";
  const settings = useSettings.getState();
  if (settings.lang !== lang) settings.setLang(lang);
  if (settings.theme !== theme) settings.setTheme(theme);
  return (
    <I18nextProvider i18n={i18n}>
      <div className="min-h-[200px] p-4">
        <Story />
      </div>
    </I18nextProvider>
  );
};

const preview: Preview = {
  decorators: [withApp],
  globalTypes: {
    locale: {
      description: "Page language",
      toolbar: { title: "Language", icon: "globe", items: [{ value: "en", title: "English" }, { value: "id", title: "Indonesia" }], dynamicTitle: true },
    },
    theme: {
      description: "Theme",
      toolbar: { title: "Theme", icon: "paintbrush", items: [{ value: "light", title: "Light" }, { value: "dark", title: "Dark" }], dynamicTitle: true },
    },
  },
  initialGlobals: { locale: "en", theme: "light" },
  parameters: { backgrounds: { disable: true }, layout: "fullscreen", a11y: { test: "todo" } },
};
export default preview;
