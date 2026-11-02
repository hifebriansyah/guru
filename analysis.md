# Guru: product analysis

A page that answers "what do six religions say about X" is a nice demo, but on its own it won't get people coming back. This note
covers who it is for, why it isn't used yet, and how to make it something people use.

## The premise

People are curious about other faiths, but asking someone directly feels risky, and searching gives you either preachy pages from one
side or debate content arguing against the other side. Guru gives one calm place where each tradition answers in its own voice, with
its own sources, side by side, and none of them attacks the others.

## What problem it solves, and for whom

| Who | The real situation | What Guru gives them |
|---|---|---|
| **Students** (high school and university, especially religious studies and *PPKn*, Indonesia's civics and citizenship subject) | Assignments that compare religions; afraid of misrepresenting one | A balanced overview, with sources to cite and check |
| **Interfaith couples and families** | "What will your family expect at a wedding, funeral or Lebaran?" | Each tradition's view on the same life event, without anyone taking sides |
| **Coworkers and neighbours** | "My colleague is fasting / celebrating Nyepi / going to Mass; what does it mean, and what's polite?" | Practical understanding before an awkward moment |
| **People questioning their own faith** | They want answers without being preached at or reported | A private, non-judgmental first look |
| **Teachers and interfaith groups** | Preparing discussions on tolerance (*moderasi beragama*, the government's religious-moderation programme) | Ready material for discussion |

Indonesia fits this unusually well. It officially recognises six religions: Islam, Protestantism, Catholicism, Hinduism, Buddhism and
Confucianism. Those are exactly the six personas, and coexistence among them is part of daily life.

## Why it won't be used yet

1. **One question, one answer, gone.** There's nothing to come back for.
2. **Answers can't be checked.** For religion, an invented verse is worse than no answer, and one viral screenshot of a wrong quote
   could sink the site.
3. **The value isn't visible before typing.** An empty text box asks people to think of a question first.
4. **No reason to share it.** Comparisons are interesting, but nothing on the page is built to be passed around.

## How to make it really used

**1. Make it trustworthy first (the foundation):**
- **Verified references:** turn every cited verse into a link to the real text. The Quran is already on quran.situs.id; add Bible,
  Gita and Dhammapada sources.
- **Flag what can't be checked:** mark any reference the system can't match to a real text.
- **Expert review:** ask one real teacher from each tradition to review the persona and some sample answers. "Reviewed by…" is the
  strongest trust signal there is, and it also protects the site.
- **A clear notice:** "These are AI summaries for learning, not religious rulings. Ask your own teacher for guidance."

**2. Show value before anyone types:**
- **A start page of curated questions:** forgiveness, death, fasting, marriage, charity, how to treat parents. Their answers are
  pre-generated and reviewed.
- **Speed and cost:** those pages load instantly and cost nothing per visit.
- **Search traffic:** each one becomes a page Google can find, for example "pandangan 6 agama tentang memaafkan" ("six religions'
  views on forgiveness"). That's where most real visitors will come from, not the home page.

**3. Make the comparison the product:**
- **A summary view:** "Where they agree / where they differ" at the top, with the six answers below.
- **Visual grouping:** themes shown as icons or colours, so a comparison reads at a glance.

**4. Give people a reason to return and share:**
- **A share card:** one question with six short quotes. It shares well on WhatsApp and Instagram.
- **A daily question,** like Omon Omon's whispers: "Today: what do the six traditions say about patience?"
- **Follow-up with one teacher:** "Ask the Ustadz more about this."
- **Language:** answers in Indonesian by default, because that's the audience.

**5. Go where the users are:**
- **Teachers:** reach them through MGMP groups (subject-teacher associations), with ready lesson material.
- **Interfaith communities** such as FKUB (local interfaith harmony forums), campus interfaith groups and tolerance organisations.
- **Short videos:** "Six religions answer: is lying ever okay?" works well on TikTok and Reels.

## Risks to plan for

- **Being seen as mixing religions together.** Many believers object to presenting all faiths as equal. Present it as
  *understanding* each faith's own view, not "all religions are the same." The personas already never claim one faith is truest and
  never push anyone to convert.
- **Blasphemy sensitivity.** Indonesia's blasphemy law (Article 156a of the old criminal code, carried into the new one) makes a
  misquoted or disrespectful AI answer a real legal and social risk. That's why the reference links and expert review come first.
- **Abuse:** people will try to make one teacher insult another faith. The persona rules forbid it; keep watching the Axiom log
  (dataset `guru.situs.id`) for attempts.
- **Privacy:** questions about faith are sensitive, and people may be questioning their own religion. Keep the log notice on the
  page, keep logs short-lived, and never tie a question to an account.

## What to measure

The Axiom log already has the raw data. Three numbers matter:
1. **Questions per visitor.** One means curiosity; three or more means it's useful.
2. **Returning visitors in a week.**
3. **Shares.** Count clicks on the share button.

## Recommended direction

**Make it a trusted comparison guide for students and teachers.** Start with 30–50 curated, reviewed questions in Indonesian, each
with linked references. Make the share card the main feature, and keep the free-form box as the second step. That solves a real,
recurring need (school and campus work on religious tolerance), brings steady search traffic, and keeps the riskiest part,
unreviewed live answers, as an extra rather than the core.
