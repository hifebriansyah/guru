// The teachers never write addresses: they write citation tags like [[quran 2:286]] and this builds the link, only when the tag
// has exactly the expected shape. Anything else stays plain text, so a made-up reference can never become a made-up link.
import type { Lang } from "./storage";

const SURAH_SLUGS = "al-fatihah al-baqarah ali-imran an-nisa al-maidah al-anam al-araf al-anfal at-taubah yunus hud yusuf ar-rad ibrahim al-hijr an-nahl al-isra al-kahf maryam thaha al-anbiya al-hajj al-muminun an-nur al-furqan asy-syuara an-naml al-qashash al-ankabut ar-rum luqman as-sajdah al-ahzab saba fathir yasin ash-shaffat shad az-zumar ghafir fushshilat asy-syura az-zukhruf ad-dukhan al-jatsiyah al-ahqaf muhammad al-fath al-hujurat qaf adz-dzariyat at-thur an-najm al-qamar ar-rahman al-waqiah al-hadid al-mujadilah al-hasyr al-mumtahanah ash-shaff al-jumuah al-munafiqun at-taghabun at-thalaq at-tahrim al-mulk al-qalam al-haqqah al-maarij nuh al-jinn al-muzzammil al-muddatstsir al-qiyamah al-insan al-mursalat an-naba an-naziat abasa at-takwir al-infithar al-muthaffifin al-insyiqaq al-buruj at-thariq al-ala al-ghasyiyah al-fajr al-balad asy-syams al-lail adh-dhuha al-insyirah at-tin al-alaq al-qadr al-bayyinah az-zalzalah al-adiyat al-qariah at-takatsur al-ashr al-humazah al-fil quraisy al-maun al-kautsar al-kafirun an-nashr al-lahab al-ikhlash al-falaq an-nas".split(" ");
const ANALECTS = "xue-er wei-zheng ba-yi li-ren gong-ye-chang yong-ye shu-er tai-bo zi-han xiang-dang xian-jin yan-yuan zi-lu xian-wen wei-ling-gong ji-shi yang-huo wei-zi zi-zhang yao-yue".split(" ");

type Hit = [href: string, label: string] | null;
type Builder = (arg: string, lang: Lang) => Hit;

const REFS: Record<string, Builder> = {
  // Quran: our own site, the surah page at the verse
  quran: (a, lang) => {
    const m = /^(\d{1,3}):(\d{1,3})(?:[-–]\d{1,3})?$/.exec(a);
    const s = m && SURAH_SLUGS[Number(m[1]) - 1];
    return m && s ? [`https://quran.situs.id/${lang}/${s}#ayat-${m[2]}`, "Quran " + a] : null;
  },
  // Bible (Protestant and Catholic): the passage on BibleGateway, book in English
  bible: (a) =>
    /^[1-3]? ?[A-Za-z][A-Za-z ]{1,24} \d{1,3}(?::\d{1,3}(?:[-–]\d{1,3})?)?$/.test(a)
      ? [`https://www.biblegateway.com/passage/?search=${encodeURIComponent(a)}`, a]
      : null,
  // Catechism of the Catholic Church paragraph
  ccc: (a) => (/^\d{1,4}$/.test(a) ? [`https://www.scborromeo.org/ccc/para/${a}.htm`, "CCC " + a] : null),
  // Bhagavad Gita chapter.verse
  gita: (a) => {
    const m = /^(\d{1,2})\.(\d{1,3})(?:[-–]\d{1,3})?$/.exec(a);
    return m ? [`https://www.holy-bhagavad-gita.org/chapter/${m[1]}/verse/${m[2]}`, "Bhagavad Gita " + a] : null;
  },
  // Pali suttas on SuttaCentral: dn22, mn10, sn56.11, an3.65, snp1.8, ud1.10, iti27
  sutta: (a) => {
    const m = /^(dn|mn|sn|an|snp|ud|iti)(\d{1,3}(?:\.\d{1,3})?)$/i.exec(a);
    return m ? [`https://suttacentral.net/${a.toLowerCase()}`, `${m[1]!.toUpperCase()} ${m[2]}`] : null;
  },
  // Abimisme (Kitab Nasihat Bapak Bapak) jilid:bab:bait: the verse on abimisme.situs.id
  abism: (a) => {
    const m = /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(a);
    return m ? [`https://abimisme.situs.id/kitab/${m[1]}/${m[2]}/${m[3]}`, "Kitab " + a] : null;
  },
  // Analects book.chapter: the book's page on Chinese Text Project, with the English translation
  analects: (a) => {
    const m = /^(\d{1,2})\.\d{1,2}$/.exec(a);
    const s = m && ANALECTS[Number(m[1]) - 1];
    return s ? [`https://ctext.org/analects/${s}/ens`, "Analects " + a] : null;
  },
};

function cite(tag: string, arg: string, lang: Lang): string {
  const hit = REFS[tag.toLowerCase()]?.(arg.trim(), lang);
  return hit ? `<a href="${hit[0]}" target="_blank" rel="noopener noreferrer">${hit[1]}</a>` : arg.trim();
}

/** Plain text from the model -> safe HTML: escape everything, then allow **bold**, *italics*, citation links and paragraphs. */
export function renderAnswer(text: string, lang: Lang): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .split(/\n{2,}/)
    .map(
      (p) =>
        "<p>" +
        p
          .replace(/\[\[(\w+)\s+([^\]]{1,40})\]\]/g, (_, tag: string, arg: string) => cite(tag, arg, lang))
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(/\n/g, "<br>") +
        "</p>",
    )
    .join("");
}
