import type { Meta, StoryObj } from "@storybook/react-vite";
import { useTranslation } from "react-i18next";
import type { Section } from "~/i18n/en";
import { InfoDialog } from "./InfoDialog";

const meta = { title: "InfoDialog", component: InfoDialog } satisfies Meta<typeof InfoDialog>;
export default meta;
type Story = StoryObj;

function Show({ which }: { which: "policy" | "disclaimer" }) {
  const { t } = useTranslation();
  return <InfoDialog open title={t(which === "policy" ? "policyBtn" : "disclaimerBtn")} sections={t(which, { returnObjects: true }) as unknown as Section[]} onClose={() => {}} />;
}

export const PrivacyPolicy: Story = { render: () => <Show which="policy" /> };
export const Disclaimer: Story = { render: () => <Show which="disclaimer" /> };
