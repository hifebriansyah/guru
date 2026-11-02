import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsMenu } from "./SettingsMenu";
import type { Lang, Theme } from "~/lib/storage";

const meta = { title: "SettingsMenu", component: SettingsMenu, decorators: [(Story) => <form className="ask mx-auto mt-4 max-w-[840px] pb-96"><div className="flex-1" /><Story /></form>] } satisfies Meta<typeof SettingsMenu>;
export default meta;
type Story = StoryObj;

function Live() {
  const [theme, setTheme] = useState<Theme>("light");
  const [lang, setLang] = useState<Lang>("en");
  const [off, setOff] = useState(["hinduism", "buddhism", "confucianism", "abism"]);
  return (
    <SettingsMenu
      defaultOpen
      theme={theme}
      lang={lang}
      off={off}
      onTheme={setTheme}
      onLang={setLang}
      onToggle={(id) => setOff((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))}
      onPolicy={() => {}}
      onDisclaimer={() => {}}
    />
  );
}

export const Open: Story = { render: () => <Live /> };
export const Closed: Story = { args: { theme: "light", lang: "en", off: ["abism"], onTheme: () => {}, onLang: () => {}, onToggle: () => {}, onPolicy: () => {}, onDisclaimer: () => {} } };
