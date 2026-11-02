import type { Meta, StoryObj } from "@storybook/react-vite";
import { Logo, LogoMark } from "./Logo";

const meta = { title: "Logo", component: Logo } satisfies Meta<typeof Logo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <main className="guru"><Logo onClick={() => {}} /></main> };
export const Asked: Story = { render: () => <main className="guru asked"><Logo onClick={() => {}} /></main> };
export const Mark: StoryObj = { render: () => <LogoMark className="size-40" /> };
