// Indonesian wording of the page (the language setting is only for the page: the teachers answer in the language of the question).
import type en from "./en";

const id: { [K in keyof typeof en]: (typeof en)[K] } = {
  intro: "Ajukan satu pertanyaan dan dengarkan bagaimana berbagai agama menjawabnya.",
  label: "Pertanyaanmu",
  placeholder: "apa surga itu ada?",
  ask: "Tanya",
  thinking: "Sedang berpikir…",
  failed: "Guru ini belum bisa menjawab sekarang.",
  decline: "Sebagai {title}, saya tidak dapat menjawab pertanyaan itu.",
  tooMany: "Terlalu banyak pertanyaan. Tunggu semenit.",
  wrong: "Terjadi kesalahan.",
  none: "Aktifkan setidaknya satu guru di menu.",
  policyBtn: "Kebijakan privasi",
  close: "Tutup",
  disclaimerBtn: "Penafian",
  menu: "Pengaturan",
  theme: "Tema",
  light: "Terang",
  dark: "Gelap",
  language: "Bahasa",
  teachers: "Guru",
  description: "Ajukan satu pertanyaan dan dengarkan bagaimana berbagai agama menjawabnya.",
  updateReady: "Versi baru sudah siap.",
  updateNow: "Muat ulang",
  dismiss: "Tutup",
  settings: "Pengaturan",
  disclaimer: [
    ["Guru Aktif", "Secara default, ajaran (‑isme) dinonaktifkan. Ini bukan soal memihak satu kelompok dibanding yang lain, melainkan keputusan praktis untuk mengatur penggunaan token dan menjaga konsistensi.\n\nSeiring proyek ini berkembang, dan ketika anggaran kami lebih besar atau minat pada ajaran (‑isme) meningkat, kami pasti akan mempertimbangkan kembali untuk mengaktifkannya secara default."],
    ["Urutan Guru", "Secara default, guru ditampilkan menurut popularitasnya di Indonesia. Kami mungkin menghadirkan kemampuan untuk mengatur urutannya di masa depan."],
    ["Abimisme", "Ajaran ini disertakan murni untuk hiburan. Kami paham ini mungkin bukan selera semua orang, tetapi kami mohon pengertiannya. Semoga, sedikit humor dapat memberikan senyuman!"],
  ],
  policy: [
    ["Yang kami simpan", "Setiap pertanyaan dan jawaban disimpan di server kami (log dan basis data), bersama alamat IP, negara, dan jenis peramban kamu."],
    ["Untuk apa", "Agar layanan tetap berjalan, untuk menemukan kesalahan, dan untuk memakai ulang jawaban bila ada yang menanyakan hal yang sama, sehingga AI tidak perlu ditanya dua kali."],
    ["Tautan", "Setiap pertanyaan punya alamat halaman sendiri yang dibuat dari kata-kata pertanyaannya. Siapa pun yang punya alamat itu bisa membaca pertanyaan dan jawabannya."],
    ["AI", "Pertanyaanmu dikirim ke model Gemini milik Google yang menulis jawabannya. Baca kebijakan Google sendiri untuk tahu bagaimana data itu diperlakukan."],
    ["Perangkatmu", "Halaman ini tidak punya akun dan tidak memasang cookie pelacak. Peramban hanya mengingat pilihanmu (tema, bahasa, guru mana yang aktif)."],
    ["Mohon", "Jangan menulis data pribadi dalam pertanyaan (nama, alamat, nomor telepon, data kesehatan atau keluarga). Pertanyaan disimpan dan bisa dipakai ulang."],
  ],
};

export default id;
