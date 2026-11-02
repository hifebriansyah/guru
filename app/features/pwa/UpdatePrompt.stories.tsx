import type { Meta, StoryObj } from "@storybook/react-vite";
import { UpdatePromptView } from "./UpdatePrompt";

const meta = { title: "UpdatePrompt", component: UpdatePromptView } satisfies Meta<typeof UpdatePromptView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = { args: { onReload: () => {}, onClose: () => {} } };
