export const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

import type { FunnelMeta, FunnelStage, ScriptPart } from "../types";

export const partLabels: Record<ScriptPart, string> = {
  hook: "HOOK",
  foreshadow: "FORESHADOW",
  body: "ISI",
  cta: "CTA",
};

export const funnelMeta: Record<FunnelStage, FunnelMeta> = {
  tofu: {
    name: "AWARENESS",
    job: "tarik perhatian",
    intent: "membuat orang berhenti scroll dan sadar ada masalah yang relevan",
    cta: "ajak komentar, simpan, atau follow",
  },
  mofu: {
    name: "CONSIDERATION",
    job: "bangun trust",
    intent: "membuktikan bahwa brand paham masalah dan punya proses yang bisa dipercaya",
    cta: "ajak tanya, konsultasi ringan, atau minta checklist",
  },
  bofu: {
    name: "CONVERSION",
    job: "jualan",
    intent: "membantu audiens mengambil keputusan tanpa merasa dipaksa",
    cta: "ajak chat, booking, kunjungan, atau konsultasi kebutuhan",
  },
};

export const emptyBlueprintHtml = `
  <h2>Brand DNA akan muncul di sini</h2>
  <p>Isi pertanyaan di atas untuk membentuk arah konten, gaya bicara, pilar konten, dan blueprint positioning.</p>
`;

export function generationInstruction(part: ScriptPart): string {
  const map: Record<ScriptPart, string> = {
    hook:
      "Buat 5 pilihan hook untuk konten. Ikuti jenis konten, durasi, dan platform yang dipilih pengguna. Berikan variasi tipe hook: Question, Fact/Stats, Controversial, Storytelling, Comedy, Negative/Fear-based, How-to, atau Visual. Setiap opsi wajib punya TIPE, ANGLE, NASKAH, ARAH VISUAL, dan VALUE. Jangan generik. Jangan pakai pembuka/penutup di luar opsi.",
    foreshadow:
      "Buat 3 pilihan foreshadow/janji konten. Foreshadow harus membuat audiens punya alasan lanjut menonton. Setiap opsi wajib punya NASKAH, ARAH CERITA, dan VALUE. Jangan pakai pembuka/penutup di luar opsi.",
    body:
      "Buat 3 pilihan isi konten sesuai jenis konten, durasi, dan platform yang dipilih pengguna. Isi harus menyampaikan value yang jelas, relate dengan keresahan audiens, dan tidak terdengar seperti teori teknis pembuatan konten. Setiap opsi wajib punya NASKAH, VALUE, dan ARAH VISUAL. Jangan pakai pembuka/penutup di luar opsi.",
    cta:
      "Buat 3 pilihan CTA yang natural. Variasikan CTA untuk komentar, save/share, follow, konsultasi/chat, atau soft selling sesuai konteks. Setiap opsi wajib punya CTA dan TUJUAN. Jangan pakai pembuka/penutup di luar opsi.",
  };
  return map[part];
}
