// The page: the logo, the question box with its settings, and the cards. The address of a question (/:slug) opens what is saved for it.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { AnswerList } from "~/components/AnswerList";
import { InfoDialog } from "~/components/InfoDialog";
import { Logo } from "~/components/Logo";
import { QuestionBox } from "~/components/QuestionBox";
import { SettingsMenu } from "~/components/SettingsMenu";
import type { Section } from "~/i18n/en";
import { useAsk } from "~/features/ask/useAsk";
import { enabledIds, useSettings } from "~/lib/settings";
import { cn } from "~/lib/util";

export default function Home() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { theme, lang, off, setTheme, setLang, toggleTeacher } = useSettings();
  const [draft, setDraft] = useState("");
  const [dialog, setDialog] = useState<"policy" | "disclaimer" | null>(null);
  const shownSlug = useRef<string | null>(null); // the address that this page itself put in the bar

  const onSlug = useCallback(
    (next: string) => {
      shownSlug.current = next;
      void navigate(`/${encodeURIComponent(next)}`);
    },
    [navigate],
  );
  const ask = useAsk({ onSlug, onQuestion: setDraft });
  const { state } = ask;

  // An address with a slug shows what is saved for it; the empty address clears the page (the back button, the logo).
  useEffect(() => {
    if (!slug) {
      if (shownSlug.current) {
        shownSlug.current = null;
        ask.reset();
        setDraft("");
      }
      return;
    }
    if (slug === shownSlug.current) return;
    shownSlug.current = slug;
    void ask.open(slug, useSettings.getState().off).then((found) => {
      if (found) return;
      shownSlug.current = null;
      void navigate("/", { replace: true }); // an address nobody saved: back to the empty page
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const submit = () => {
    const ids = enabledIds(off);
    void ask.submit(draft.trim(), ids);
  };

  const toggle = (id: string) => {
    if (toggleTeacher(id)) void ask.addTeacher(id); // a question that is on the page follows the switch
    else ask.removeTeacher(id);
  };

  const sections = (key: "policy" | "disclaimer") => t(key, { returnObjects: true }) as unknown as Section[];

  return (
    <>
      <main className={cn("guru", state.asked && "asked")}>
        <Logo
          onClick={() => {
            shownSlug.current = null;
            ask.reset();
            setDraft("");
            void navigate("/");
          }}
        />
        <QuestionBox value={draft} onChange={setDraft} onSubmit={submit} busy={state.busy}>
          <SettingsMenu
            theme={theme}
            lang={lang}
            off={off}
            onTheme={setTheme}
            onLang={setLang}
            onToggle={toggle}
            onPolicy={() => setDialog("policy")}
            onDisclaimer={() => setDialog("disclaimer")}
          />
        </QuestionBox>
        <p className="note" role="status" aria-live="polite">
          {state.note ? ("key" in state.note ? t(state.note.key) : state.note.text) : ""}
        </p>
        <AnswerList cards={state.cards} lang={lang} />
      </main>
      <InfoDialog open={dialog === "policy"} title={t("policyBtn")} sections={sections("policy")} onClose={() => setDialog(null)} />
      <InfoDialog open={dialog === "disclaimer"} title={t("disclaimerBtn")} sections={sections("disclaimer")} onClose={() => setDialog(null)} />
    </>
  );
}
