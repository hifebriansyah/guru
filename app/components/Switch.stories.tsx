import type { Meta, StoryObj } from "@storybook/react-vite";
import { TeacherSwitch } from "./Switch";

const meta = { title: "TeacherSwitch", component: TeacherSwitch, decorators: [(Story) => <div className="menu"><Story /></div>] } satisfies Meta<typeof TeacherSwitch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const On: Story = { args: { name: "Islam", on: true, onToggle: () => {} } };
export const Off: Story = { args: { name: "Abism", on: false, onToggle: () => {} } };
