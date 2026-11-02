import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnswerCard } from "./AnswerCard";

const meta = {
  title: "AnswerCard",
  component: AnswerCard,
  decorators: [(Story) => <ul className="answers mx-auto max-w-[680px]"><Story /></ul>],
  args: { lang: "en" },
} satisfies Meta<typeof AnswerCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const answer = "In Islam, patience (*sabr*) is a **virtue** that Allah praises many times: \"Indeed, Allah is with the patient\" [[quran 2:153]].\n\nIt is not passive: it is steadiness while you keep doing what is right.";

export const Waiting: Story = { args: { card: { id: "islam", status: "waiting", text: "", decline: "" } } };
export const Answer: Story = { args: { card: { id: "islam", status: "answer", text: answer, decline: "" } } };
export const Declined: Story = { args: { card: { id: "hinduism", status: "declined", text: "", decline: "As {title}, I can't answer that question." } } };
export const Failed: Story = { args: { card: { id: "catholic", status: "failed", text: "", decline: "" } } };
export const Screener: Story = { args: { card: { id: "", status: "answer", text: "This is not something our teachers can speak to. Try asking about faith, morals, everyday life or the meaning of life.", decline: "" } } };
export const Indonesian: Story = { args: { lang: "id", card: { id: "protestant", status: "answer", text: "Dalam iman Kristen, pengampunan adalah anugerah [[bible Matthew 6:14]].", decline: "" } } };
