import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { QuestionBox } from "./QuestionBox";

const meta = { title: "QuestionBox", component: QuestionBox, decorators: [(Story) => <main className="guru"><Story /></main>] } satisfies Meta<typeof QuestionBox>;
export default meta;
type Story = StoryObj;

function Live({ start = "", busy = false }: { start?: string; busy?: boolean }) {
  const [value, setValue] = useState(start);
  return <QuestionBox value={value} onChange={setValue} onSubmit={() => {}} busy={busy} />;
}

export const Empty: Story = { render: () => <Live /> };
export const WithText: Story = { render: () => <Live start="What does my faith say about forgiveness?" /> };
export const Busy: Story = { render: () => <Live start="Does heaven exist?" busy /> };
