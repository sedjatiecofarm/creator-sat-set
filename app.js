const storage = {
  read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || fallback);
    } catch (error) {
      return JSON.parse(fallback);
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      showToast("Plan tersimpan untuk sesi ini.");
    }
  },
};

const db = {
  ready: false,
  saveTimer: null,
  async load() {
    try {
      const response = await fetch(`${API_BASE}/api/db?workspaceId=${encodeURIComponent(getActiveWorkspaceId())}`);
      if (!response.ok) throw new Error("DB backend tidak tersedia.");
      const data = await response.json();
      this.ready = true;
      return data;
    } catch (error) {
      this.ready = false;
      return null;
    }
  },
  saveNow() {
    if (!this.ready) return;
    fetch(`${API_BASE}/api/db`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: getActiveWorkspaceId(),
        plans: state.plans,
        blueprints: state.blueprints,
        activeBlueprintId: state.activeBlueprintId,
        history: state.history,
        usage: state.usage,
        lastProvider: state.lastProvider,
        lastModel: state.lastModel,
        lastGeneratedAt: state.lastGeneratedAt,
        lastUserEmail: authState.user?.email || state.lastUserEmail || "",
      }),
    }).catch(() => {
      this.ready = false;
    });
  },
  saveSoon() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 250);
  },
};

const state = {
  scriptParts: {},
  funnelParts: {},
  funnelTopic: "",
  currentFunnel: "tofu",
  selectedDate: null,
  calendarDate: new Date(),
  plans: storage.read("creatorPlans", "{}"),
  blueprints: storage.read("creatorBlueprints", "[]"),
  activeBlueprintId: storage.read("activeBlueprintId", "null"),
  history: storage.read("creatorHistory", "[]"),
  usage: storage.read("creatorUsage", "{}"),
  lastBlueprintResult: "",
  blueprintCreatesNew: false,
  lastProvider: "",
  lastModel: "",
  lastGeneratedAt: null,
  lastUserEmail: "",
};

const emptyBlueprintHtml = `
  <h2>Brand DNA akan muncul di sini</h2>
  <p>Isi pertanyaan di atas untuk membentuk arah konten, gaya bicara, pilar konten, dan blueprint positioning.</p>
`;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const API_BASE = window.location.protocol === "file:" ? "http://localhost:8787" : "";
const IS_LOCAL_APP = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
const WORKSPACE_ID = getWorkspaceId();
const ADMIN_EMAILS = ["sedjatiecofarm@gmail.com"];
const authState = {
  client: null,
  user: null,
  ready: false,
  error: "",
};

showAuthRedirectError();

function getWorkspaceId() {
  const param = new URLSearchParams(window.location.search).get("workspace");
  if (param) {
    const cleanParam = cleanWorkspaceId(param);
    storage.write("creatorWorkspaceId", cleanParam);
    return cleanParam;
  }

  const existing = cleanWorkspaceId(storage.read("creatorWorkspaceId", "null"));
  if (existing) return existing;

  const next = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  storage.write("creatorWorkspaceId", next);
  return next;
}

function cleanWorkspaceId(value) {
  return String(value || "")
    .replace(/^"+|"+$/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
}

function getActiveWorkspaceId() {
  return authState.user?.id ? `user-${authState.user.id}` : WORKSPACE_ID;
}

function isAdminUser() {
  return ADMIN_EMAILS.includes(String(authState.user?.email || "").trim().toLowerCase());
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shortText(value, limit = 700) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function showAuthRedirectError() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error_description") || params.get("error");
  if (!error) return;

  window.history.replaceState({}, document.title, window.location.pathname);
  window.addEventListener("load", () => {
    showToast(`Login Google gagal: ${decodeURIComponent(error).slice(0, 140)}`);
  });
}

const monthNames = [
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

const partLabels = {
  hook: "HOOK",
  foreshadow: "FORESHADOW",
  body: "ISI",
  cta: "CTA",
};

const hookRule =
  "Aturan hook: hook adalah 0-5 detik pertama. Wajib 1 kalimat pendek, maksimal 8-12 kata atau 90 karakter, langsung memancing rasa ingin tahu/emosi. Jangan gabungkan hook dengan isi edukasi, jangan pakai kalimat majemuk panjang.";

const funnelMeta = {
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

function isLivestockTopic(topic) {
  return /domba|ternak|kandang|pakan|bibit|qurban|kurban|garut|fattening|breeding/i.test(topic);
}

function valuePromise(topic) {
  const context = getBrandContext();
  if (isLivestockTopic(topic)) {
    return {
      audience: context.audience === "target audiens" ? "peternak pemula dan calon pembeli domba" : context.audience,
      pain: context.painPoint === "keresahan audiens" ? "takut salah pilih domba, salah rawat, atau rugi karena hanya melihat tampilan luar" : context.painPoint,
      proof: "contoh dari pengamatan kandang, perilaku harian, nafsu makan, postur, kebersihan, dan konsistensi perawatan",
      next: "lebih tenang menilai kualitas domba sebelum membeli atau merawatnya",
    };
  }
  return {
    audience: context.audience === "target audiens" ? "audiens yang sedang mencari solusi praktis" : context.audience,
    pain: context.painPoint === "keresahan audiens" ? "bingung membedakan mana informasi yang penting dan mana yang hanya terlihat menarik" : context.painPoint,
    proof: "contoh sederhana, cerita nyata, dan alasan yang mudah dipahami",
    next: "punya pegangan yang lebih jelas untuk mengambil keputusan",
  };
}

function activeFunnelFor(topic) {
  const upper = topic.toUpperCase();
  if (upper.includes("MOFU") || upper.includes("CONSIDERATION")) return funnelMeta.mofu;
  if (upper.includes("BOFU") || upper.includes("CONVERSION")) return funnelMeta.bofu;
  if (upper.includes("TOFU") || upper.includes("AWARENESS")) return funnelMeta.tofu;
  return {
    name: "GENERAL",
    job: "membuat konten bernilai",
    intent: "membantu audiens memahami masalah, melihat value, dan tahu langkah berikutnya",
    cta: "ajak audiens merespons dengan cara yang natural",
  };
}

function getScriptSettings() {
  const type = $("#contentType")?.value || "Reels";
  const duration = $("#contentDuration")?.value || "45";
  const platform = $("#contentPlatform")?.value || "Instagram";
  return { type, duration, platform };
}

function scriptSettingsPrompt() {
  const settings = getScriptSettings();
  return `Jenis konten: ${settings.type}\nDurasi target: ${settings.duration} detik\nPlatform: ${settings.platform}`;
}

function cleanIdea(topic) {
  return topic
    .replace(/\b(TOFU|MOFU|BOFU)\b/gi, "")
    .replace(/\b(AWARENESS|CONSIDERATION|CONVERSION)\b/gi, "")
    .replace(/\bAngle:\s*/gi, "")
    .replace(/\bIde:\s*/gi, "")
    .replace(/\bValue:\s*/gi, "")
    .replace(/\bFormat:\s*/gi, "")
    .replace(/\s*\|\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function hookSubject(topic) {
  const words = cleanIdea(topic).split(" ").filter(Boolean);
  return words.slice(0, 4).join(" ") || "ini";
}

function scriptLine(text) {
  const match = text.match(/NASKAH:\s*"([^"]+)"/s);
  if (match) return match[1].trim();
  const bodyMatch = text.match(/NASKAH:\s*([\s\S]*?)(?:\n\nVALUE:|\n\nNILAI:|$)/);
  if (bodyMatch) return bodyMatch[1].replace(/^"|"$/g, "").trim();
  const ctaMatch = text.match(/CTA:\s*"([^"]+)"/s);
  if (ctaMatch) return ctaMatch[1].trim();
  return text;
}

function parseFullScript(text) {
  const sections = { hook: "", foreshadow: "", body: "", cta: "" };
  const normalized = text.replace(/\r/g, "").trim();
  const patterns = {
    hook: /(?:^|\n)\s*(?:HOOK|1\.\s*HOOK)\s*[:\-]?\s*\n?([\s\S]*?)(?=\n\s*(?:FORESHADOW|2\.\s*FORESHADOW|ISI|BODY|3\.\s*(?:ISI|BODY)|CTA|4\.\s*CTA)\s*[:\-]?|\s*$)/i,
    foreshadow: /(?:^|\n)\s*(?:FORESHADOW|2\.\s*FORESHADOW)\s*[:\-]?\s*\n?([\s\S]*?)(?=\n\s*(?:ISI|BODY|3\.\s*(?:ISI|BODY)|CTA|4\.\s*CTA)\s*[:\-]?|\s*$)/i,
    body: /(?:^|\n)\s*(?:ISI|BODY|3\.\s*(?:ISI|BODY))\s*[:\-]?\s*\n?([\s\S]*?)(?=\n\s*(?:CTA|4\.\s*CTA)\s*[:\-]?|\s*$)/i,
    cta: /(?:^|\n)\s*(?:CTA|4\.\s*CTA)\s*[:\-]?\s*\n?([\s\S]*?)\s*$/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = normalized.match(pattern);
    sections[key] = match ? normalizeOptionText(match[1]) : "";
  }

  if (!sections.hook && !sections.foreshadow && !sections.body && !sections.cta) {
    sections.body = normalized;
  }
  return sections;
}

async function generateFullScript(topic, parts, draftTarget, trigger) {
  const cleanTopic = topic.trim();
  if (!cleanTopic) {
    showToast("Isi atau pilih topik dulu.");
    return;
  }

  setLoading(trigger, true);
  const draft = $(draftTarget);
  draft.textContent = "AI sedang membuat full script sekaligus...";
  try {
    const text = await askAI({
      topic: `${cleanTopic}\n\nSETTING SCRIPT\n${scriptSettingsPrompt()}`,
      instruction:
        `Buat satu draft script lengkap. Kamu berperan sebagai content director, copywriter, dan creator assistant. Script harus mengikuti blueprint brand aktif, target market, keresahan audiens, jenis konten, durasi target, platform, dan funnel bila topik memuat Awareness/Consideration/Conversion. Jangan memberi opsi, langsung buat draft terbaik. ${hookRule}`,
      format:
        "Format wajib persis dengan heading ini:\nHOOK\n...\n\nFORESHADOW\n...\n\nISI\n...\n\nCTA\n...\n\nHOOK wajib 1 kalimat pendek untuk 3-5 detik pertama, maksimal 8-12 kata atau 90 karakter. HOOK tidak boleh berisi penjelasan edukasi; simpan edukasi di ISI. Sesuaikan panjang script dengan durasi target. Untuk Story buat lebih ringan dan direct. Untuk Carousel buat alur per slide. Untuk Feed buat caption/isi yang padat. Untuk Reels/TikTok/Shorts buat ritme video pendek. Gunakan Bahasa Indonesia yang natural, relate, bernilai, dan siap dipakai. Jangan tambahkan catatan di luar empat heading itu.",
    });
    const parsed = parseFullScript(text);
    parts.hook = parsed.hook || "-";
    parts.foreshadow = parsed.foreshadow || "-";
    parts.body = parsed.body || "-";
    parts.cta = parsed.cta || "-";
    updateDraft(draftTarget, parts);
    showToast("Full script berhasil dibuat.");
  } catch (error) {
    draft.textContent = friendlyAIError(error.message);
  }
  setLoading(trigger, false);
}

function splitAIOptions(text) {
  const cleaned = text
    .trim()
    .replace(/\r/g, "")
    .replace(/^```(?:\w+)?|```$/gm, "")
    .replace(/^\s*---+\s*$/gm, "\n");

  const matches = [...cleaned.matchAll(/(?:^|\n)\s*(?:\*\*)?\s*(?:OPSI|OPTION)\s*\d+\s*[:.\-]?\s*(?:\*\*)?[\s\S]*?(?=\n\s*(?:\*\*)?\s*(?:OPSI|OPTION)\s*\d+\s*[:.\-]?\s*(?:\*\*)?|\s*$)/gi)];
  if (matches.length > 1) {
    return matches.map((match) => normalizeOptionText(match[0])).filter(Boolean);
  }

  const numbered = [...cleaned.matchAll(/(?:^|\n)\s*\d+\.\s+[\s\S]*?(?=\n\s*\d+\.\s+|\s*$)/g)];
  if (numbered.length > 1) {
    return numbered.map((match) => normalizeOptionText(match[0])).filter(Boolean);
  }

  return [normalizeOptionText(cleaned)];
}

function normalizeOptionText(text) {
  return text
    .replace(/^\s*---+\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderAIText(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const html = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    let heading = line.match(/^\*\*(.+?)\*\*:?$/);
    if (!heading) heading = line.match(/^([A-Z][A-Z0-9 /&()_-]{3,}):?$/);
    if (heading) {
      closeList();
      html.push(`<h3>${formatInline(heading[1])}</h3>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${formatInline(bullet[1])}</li>`);
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s+(.+)/);
    if (numbered) {
      closeList();
      html.push(`<p class="numbered"><strong>${numbered[1]}.</strong> ${formatInline(numbered[2])}</p>`);
      continue;
    }

    closeList();
    html.push(`<p>${formatInline(line)}</p>`);
  }

  closeList();
  return html.join("");
}

function formatInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function generationInstruction(part) {
  const map = {
    hook:
      `Buat 5 pilihan hook untuk konten. ${hookRule} Ikuti jenis konten, durasi, dan platform yang dipilih pengguna. Berikan variasi tipe hook: Question, Fact/Stats, Controversial, Storytelling, Comedy, Negative/Fear-based, How-to, atau Visual. Setiap opsi wajib punya TIPE, ANGLE, NASKAH, ARAH VISUAL, dan VALUE. Bagian NASKAH khusus hook wajib pendek, bukan paragraf, bukan foreshadow, dan bukan isi. Kalau tipe Visual, NASKAH tetap pendek; detail gerakan/objek taruh di ARAH VISUAL. Jangan generik. Jangan pakai pembuka/penutup di luar opsi.`,
    foreshadow:
      "Buat 3 pilihan foreshadow/janji konten. Ikuti jenis konten, durasi, dan platform yang dipilih pengguna. Foreshadow harus membuat audiens punya alasan lanjut menonton/membaca. Setiap opsi wajib punya NASKAH, ARAH CERITA, dan VALUE. Jangan pakai pembuka/penutup di luar opsi.",
    body:
      "Buat 3 pilihan ISI konten, bukan hook. Ikuti jenis konten, durasi, dan platform yang dipilih pengguna. Isi harus berupa naskah utama yang menjelaskan value secara lengkap, relate dengan keresahan audiens, dan siap dibacakan/dieksekusi. Untuk Reels/TikTok/Shorts, buat isi dalam bentuk alur presenter + arahan visual yang cukup untuk durasi target. Untuk Carousel, buat per slide. Untuk Story, buat frame singkat berurutan. Untuk Feed, buat copy/caption padat. Setiap opsi wajib punya NASKAH PANJANG, VALUE, dan ARAH VISUAL. Jangan buat kalimat hook pendek. Jangan pakai pembuka/penutup di luar opsi.",
    cta:
      "Buat 3 pilihan CTA yang natural. Ikuti jenis konten, durasi, dan platform yang dipilih pengguna. Variasikan CTA untuk komentar, save/share, follow, konsultasi/chat, atau soft selling sesuai konteks. Setiap opsi wajib punya CTA dan TUJUAN. Jangan pakai pembuka/penutup di luar opsi.",
  };
  return map[part];
}

function optionFormatInstruction(part) {
  const settings = getScriptSettings();
  const duration = Number(settings.duration || 45);
  const bodyLength =
    duration >= 60
      ? "minimal 140-190 kata atau 8-12 baris presenter"
      : duration >= 45
        ? "minimal 100-150 kata atau 6-9 baris presenter"
        : "minimal 70-110 kata atau 4-7 baris presenter";

  if (part === "hook") {
    return `WAJIB hanya keluarkan daftar opsi, tanpa kalimat pembuka. Pisahkan setiap opsi dengan judul OPSI 1:, OPSI 2:, OPSI 3: dan seterusnya.

Format per opsi:
OPSI 1:
TIPE HOOK: ...
FORMAT: jenis konten, durasi, platform
ANGLE: ...
NASKAH: "..."
ARAH VISUAL: ...
VALUE/TUJUAN: ...

NASKAH hook wajib 1 kalimat pendek maksimal 8-12 kata atau 90 karakter untuk 0-5 detik pertama. Jangan masukkan penjelasan edukasi di hook.`;
  }

  if (part === "body") {
    return `WAJIB hanya keluarkan daftar opsi ISI KONTEN, tanpa kalimat pembuka. Pisahkan setiap opsi dengan judul OPSI 1:, OPSI 2:, OPSI 3:.

Format per opsi:
OPSI 1:
JENIS ISI: edukasi / bukti / cerita / checklist / breakdown
FORMAT: jenis konten, durasi, platform
ANGLE: ...
NASKAH:
"..."
VALUE/TUJUAN: ...
ARAH VISUAL: ...

NASKAH untuk bagian ISI wajib panjang dan substansial, ${bodyLength}. Jangan buat hook pendek. Jangan cuma 1 kalimat. Isi harus menjelaskan poin utama, contoh/bukti, dan alasan kenapa audiens perlu peduli.`;
  }

  if (part === "foreshadow") {
    return `WAJIB hanya keluarkan daftar opsi FORESHADOW, tanpa kalimat pembuka. Pisahkan setiap opsi dengan judul OPSI 1:, OPSI 2:, OPSI 3:.

Format per opsi:
OPSI 1:
JENIS FORESHADOW: ...
FORMAT: jenis konten, durasi, platform
NASKAH: "..."
ARAH CERITA: ...
VALUE/TUJUAN: ...

Foreshadow harus berupa janji isi/alasan lanjut menonton, bukan hook dan bukan isi panjang.`;
  }

  return `WAJIB hanya keluarkan daftar opsi CTA, tanpa kalimat pembuka. Pisahkan setiap opsi dengan judul OPSI 1:, OPSI 2:, OPSI 3:.

Format per opsi:
OPSI 1:
TIPE CTA: komentar / simpan / share / follow / chat / konsultasi
FORMAT: jenis konten, durasi, platform
CTA: "..."
TUJUAN: ...

CTA harus natural, spesifik, dan sesuai tahap konten.`;
}

const generators = {
  hook: (topic) => {
    const v = valuePromise(topic);
    const f = activeFunnelFor(topic);
    const subject = hookSubject(topic);
    return [
      `TIPE: Question Hook\nFUNNEL JOB: ${f.job}\nANGLE: Menyasar keresahan audiens dan membuat mereka merasa "ini masalah gue".\nNASKAH: "Yakin ${subject} benar-benar aman?"\nARAH VISUAL: Buka dengan dua contoh berdampingan, tahan 1 detik, lalu beri teks pertanyaan besar.\nVALUE: Audiens terdorong berhenti scroll karena pertanyaannya dekat dengan rasa ragu mereka.`,
      `TIPE: Negative / Fear-based Hook\nFUNNEL JOB: ${f.job}\nANGLE: Mencegah audiens melakukan kesalahan sebelum mengambil keputusan.\nNASKAH: "Jangan pilih sebelum cek tanda ini."\nARAH VISUAL: Close-up objek utama, lalu cut cepat ke detail kecil yang sering dilewatkan.\nVALUE: Audiens merasa ada risiko yang harus dicegah, bukan sekadar informasi biasa.`,
      `TIPE: Fact / Credibility Hook\nFUNNEL JOB: ${f.job}\nANGLE: Membuka dengan fakta lapangan agar brand terlihat paham proses.\nNASKAH: "Kesalahan mahal sering dimulai dari satu asumsi."\nARAH VISUAL: Tampilkan proses nyata, checklist, atau suasana kerja yang memperkuat kredibilitas.\nVALUE: Membangun trust karena edukasi terasa berasal dari pengalaman, bukan teori kosong.`,
      `TIPE: Storytelling Hook\nFUNNEL JOB: ${f.job}\nANGLE: Cerita pendek yang relatable untuk membuat edukasi tidak terasa menggurui.\nNASKAH: "Dulu yakin aman, ternyata detail kecilnya salah."\nARAH VISUAL: Mulai dari cerita kasus, lalu tampilkan detail yang jadi pelajaran.\nVALUE: Cerita membantu ${v.audience} belajar tanpa merasa disalahkan.`,
      `TIPE: Controversial Hook\nFUNNEL JOB: ${f.job}\nANGLE: Melawan asumsi umum agar audiens penasaran.\nNASKAH: "Yang menarik belum tentu layak dipilih."\nARAH VISUAL: Tampilkan contoh yang tampak menarik, lalu beri teks "belum tentu".\nVALUE: Memancing perhatian karena audiens merasa keyakinannya ditantang.`,
      `TIPE: How-to Hook\nFUNNEL JOB: ${f.job}\nANGLE: Menawarkan pegangan praktis yang bisa langsung dipakai.\nNASKAH: "Ini cara cek tanpa cuma menebak."\nARAH VISUAL: Gunakan 3 poin di layar: lihat, cek, pastikan.\nVALUE: Audiens tahu mereka akan pulang dengan checklist yang berguna.`,
    ];
  },
  foreshadow: (topic) => {
    const v = valuePromise(topic);
    const f = activeFunnelFor(topic);
    const idea = cleanIdea(topic);
    return [
      `NASKAH: "Di akhir video ini, kamu punya checklist singkat untuk menilai ${idea} dengan lebih tenang."\nARAH CERITA: Mulai dari masalah umum, tunjukkan tanda yang sering dilewatkan, lalu beri kesimpulan sederhana.\nVALUE: Cocok untuk ${f.name} karena ${f.intent}.`,
      `NASKAH: "Aku akan tunjukkan 3 tanda yang sering tidak diperhatikan, padahal ini bisa membedakan pilihan asal menarik dengan pilihan yang benar-benar layak."\nARAH CERITA: Buat tiap tanda sebagai mini-bab: lihat, artikan, contohkan.\nVALUE: Membantu ${v.audience} mengubah rasa ragu menjadi cara menilai yang lebih jelas.`,
      `NASKAH: "Kita bukan bahas teori. Kita bedah contoh yang bisa kamu lihat langsung, supaya kamu tahu mana klaim dan mana bukti."\nARAH CERITA: Pakai bahasa santai, potongan visual nyata, dan alasan kenapa tanda itu penting.\nVALUE: Konten terasa kredibel karena berangkat dari bukti, bukan klaim kosong.`,
    ];
  },
  body: (topic) => {
    const v = valuePromise(topic);
    const f = activeFunnelFor(topic);
    const idea = cleanIdea(topic);
    return [
      `NASKAH: "Pertama, jangan nilai ${idea} dari satu tanda saja. Banyak orang terlalu cepat percaya karena tampilan luarnya meyakinkan. Padahal yang lebih penting adalah konsistensi: prosesnya, kondisinya, dan bukti yang bisa dilihat. Kalau tiga hal ini nyambung, penilaiannya jauh lebih kuat. Tapi kalau ada yang janggal, jangan buru-buru yakin."\n\nVALUE: Membantu audiens punya cara berpikir yang lebih hati-hati sebelum mengambil keputusan.\nARAH VISUAL: Tampilkan 3 poin di layar: proses, kondisi, bukti.`,
      `NASKAH: "Kesalahan yang sering terjadi adalah melihat ${idea} hanya dari bagian yang paling bagus. Yang difoto bagus, yang diceritakan bagus, tapi detail kecilnya tidak dicek. Coba tanya: apakah penjelasannya masuk akal? Apakah ada bukti prosesnya? Apakah hasilnya konsisten? Dari situ kamu bisa bedakan mana yang benar-benar layak dan mana yang cuma kelihatan menarik."\n\nVALUE: Audiens belajar membedakan klaim dan bukti.\nARAH VISUAL: Pakai split-screen: 'kelihatan bagus' vs 'bukti yang perlu dicek'.`,
      `NASKAH: "Banyak pemula mengalami ${v.pain}. Wajar, karena dari luar semuanya bisa terlihat meyakinkan. Tapi keputusan yang bagus biasanya lahir dari pengamatan kecil yang konsisten. Untuk ${idea}, lihat tanda yang berulang, bukan momen terbaiknya saja. Kalau bagusnya cuma dari satu sudut atau penjelasannya tidak lengkap, itu tanda kamu perlu tanya lebih jauh."\n\nVALUE: Audiens merasa ditemani dan dibantu membaca situasi dengan lebih kritis.\nARAH VISUAL: Buka dengan cerita singkat, lalu masuk ke contoh nyata.`,
      `NASKAH: "Kalau konten ini masuk tahap ${f.name}, tugasnya adalah ${f.job}. Jadi jangan hanya memberi info. Buat audiens merasa paham, percaya, lalu tahu langkah berikutnya. Untuk ${idea}, pesan utamanya sederhana: keputusan yang baik datang dari indikator yang jelas, bukan dari feeling atau ikut-ikutan."\n\nVALUE: Menghubungkan isi konten dengan strategi funnel.\nARAH VISUAL: Akhiri dengan ringkasan satu kalimat di layar.`,
    ];
  },
  cta: (topic) => [
    `CTA: "Kalau kamu mau, tulis di komentar: bagian mana dari ${cleanIdea(topic)} yang paling bikin kamu ragu? Nanti aku bedah satu-satu."\nTUJUAN: Komentar dan diskusi.`,
    `CTA: "Simpan video ini, biar nanti pas kamu menilai ${cleanIdea(topic)}, kamu punya checklist yang bisa dibuka lagi."\nTUJUAN: Save dan repeat value.`,
    `CTA: "Kalau kamu mau dibantu menilai ${cleanIdea(topic)} dengan lebih aman, kirim pertanyaanmu. Kita lihat bareng sebelum kamu ambil keputusan."\nTUJUAN: Trust dan soft conversion.`,
    `CTA: "${activeFunnelFor(topic).cta}. Kalau butuh arahan, mulai dari kirim topik atau kebutuhanmu dulu."\nTUJUAN: Selaras dengan stage funnel.`,
  ],
};

const funnelIdeas = {
  tofu: [
    "AWARENESS | Angle: Bongkar mitos | Ide: Domba Garut yang terlihat besar belum tentu paling aman dipilih | Value: Audiens belajar tidak menilai dari tampilan luar saja | Format: Before-after / split-screen.",
    "AWARENESS | Angle: Edukasi pemula | Ide: 3 tanda sederhana domba aktif dan sehat yang bisa dilihat orang awam | Value: Memberi checklist visual yang gampang diingat | Format: Pointing video di kandang.",
    "AWARENESS | Angle: Fear-based | Ide: Jangan beli bibit domba cuma karena murah sebelum cek 3 hal ini | Value: Mencegah audiens rugi karena tergoda harga | Format: Talking head + contoh visual.",
    "AWARENESS | Angle: Storytelling | Ide: Cerita pemula yang salah pilih domba karena cuma percaya foto | Value: Membuat audiens merasa relate dan lebih hati-hati | Format: Narasi kasus.",
    "AWARENESS | Angle: Humor edukatif | Ide: Domba juga bisa 'modal tampang', tapi peternak harus lihat bukti | Value: Menghibur sambil mengajarkan indikator sehat | Format: Komedi ringan + edukasi.",
  ],
  mofu: [
    "CONSIDERATION | Angle: Trust builder | Ide: Kenapa proses perawatan harian lebih penting daripada klaim 'domba bagus' | Value: Audiens memahami standar kualitas Sedjati Eco Farm | Format: Behind the scene.",
    "CONSIDERATION | Angle: Checklist | Ide: 5 pertanyaan yang harus ditanyakan sebelum beli Domba Garut | Value: Membantu calon pembeli merasa lebih siap | Format: Listicle cepat.",
    "CONSIDERATION | Angle: Proof content | Ide: Bedah kandang bersih, pakan, dan monitoring sebagai bukti perawatan | Value: Membangun kredibilitas lewat proses nyata | Format: Tour kandang.",
    "CONSIDERATION | Angle: Comparison | Ide: Beda domba yang dirawat sistematis vs asal jalan | Value: Menjelaskan kenapa hasil tidak muncul secara instan | Format: Perbandingan visual.",
    "CONSIDERATION | Angle: Objection handling | Ide: 'Kenapa harga bisa beda?' Ini faktor yang memengaruhi kualitas domba | Value: Menjawab keberatan harga tanpa hard selling | Format: Edukasi singkat.",
  ],
  bofu: [
    "CONVERSION | Angle: Decision helper | Ide: Bingung pilih bibit? Ini cara Sedjati membantu calon pembeli menilai kebutuhan | Value: Mengurangi rasa takut salah beli | Format: Konsultasi simulasi.",
    "CONVERSION | Angle: Soft selling | Ide: Kalau mau mulai ternak, jangan cuma beli domba, pastikan ada arah perawatannya | Value: Menjual pendampingan sebagai keamanan keputusan | Format: Talking head tegas.",
    "CONVERSION | Angle: Visit invitation | Ide: Lihat langsung kondisi kandang sebelum percaya klaim kualitas | Value: Mengajak audiens mengambil langkah konkret | Format: Invitation video.",
    "CONVERSION | Angle: Qurban/fattening | Ide: Pilih domba untuk qurban atau fattening? Kebutuhannya beda | Value: Membantu calon pembeli memilih sesuai tujuan | Format: Decision tree.",
    "CONVERSION | Angle: Risk reversal | Ide: Sebelum transfer, konsultasikan dulu kebutuhanmu supaya tidak asal pilih | Value: Membuat CTA terasa membantu, bukan memaksa | Format: Direct response.",
  ],
};

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function getCopyTextById(id) {
  const element = $(`#${id}`);
  if (!element) return "";
  if ("value" in element) return element.value;
  return element.innerText || element.textContent || "";
}

async function copyText(text) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    showToast("Tidak ada teks untuk disalin.");
    return;
  }

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(cleanText);
      showToast("Teks disalin.");
      return;
    }
  } catch (error) {
    // Fall through to legacy copy.
  }

  const temp = document.createElement("textarea");
  temp.value = cleanText;
  temp.setAttribute("readonly", "");
  temp.style.position = "fixed";
  temp.style.left = "-9999px";
  temp.style.top = "0";
  document.body.appendChild(temp);
  temp.focus();
  temp.select();

  try {
    document.execCommand("copy");
    showToast("Teks disalin.");
  } catch (error) {
    showToast("Gagal menyalin. Blok teks lalu tekan Ctrl+C.");
  } finally {
    temp.remove();
  }
}

function setLoading(element, isLoading, label = "Generate") {
  if (!element) return;
  element.disabled = isLoading;
  element.dataset.originalText ||= element.textContent;
  element.textContent = isLoading ? "AI sedang berpikir..." : element.dataset.originalText || label;
}

function getAIContext() {
  return getBrandContext();
}

function requireLoginForAI() {
  if (authState.user) return true;
  showToast("Silakan login Google dulu untuk menggunakan fitur AI.");
  return false;
}

async function askAI({ topic, instruction, format }) {
  if (!requireLoginForAI()) {
    throw new Error("LOGIN_REQUIRED");
  }
  let response;
  const session = authState.client ? (await authState.client.auth.getSession()).data.session : null;
  try {
    response = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        topic,
        instruction,
        format,
        context: getAIContext(),
        workspaceId: getActiveWorkspaceId(),
        user: authState.user ? { id: authState.user.id, email: authState.user.email } : null,
      }),
    });
  } catch (error) {
    throw new Error(IS_LOCAL_APP ? "Server AI lokal belum aktif." : "API AI cloud gagal dihubungi.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `API AI gagal merespons. Status: ${response.status}`);
  }
  if (data.usage?.day && data.usage?.bucket) {
    state.usage[data.usage.day] = data.usage.bucket;
  }
  state.lastProvider = data.provider || state.lastProvider || "";
  state.lastModel = data.model || state.lastModel || "";
  state.lastGeneratedAt = new Date().toISOString();
  state.lastUserEmail = authState.user?.email || state.lastUserEmail || "";
  recordGeneration({
    type: "Generate AI",
    input: topic,
    output: data.text,
    provider: data.provider,
    model: data.model,
    skipUsage: Boolean(data.usage),
  });
  if (isAdminUser() && data.provider && data.provider !== "gemini") {
    showToast(`AI fallback aktif: hasil dibuat via ${data.provider}.`);
  }
  return data.text;
}

async function transcribeMedia(file) {
  if (!requireLoginForAI()) {
    throw new Error("LOGIN_REQUIRED");
  }
  const base64 = await fileToBase64(file);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  const session = authState.client ? (await authState.client.auth.getSession()).data.session : null;

  const response = await fetch(`${API_BASE}/api/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    signal: controller.signal,
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      dataBase64: base64,
      context: getAIContext(),
      workspaceId: getActiveWorkspaceId(),
      user: authState.user ? { id: authState.user.id, email: authState.user.email } : null,
    }),
  }).catch(() => {
    throw new Error(IS_LOCAL_APP ? "Server AI lokal belum aktif atau transkripsi terlalu lama." : "API AI cloud gagal dihubungi atau transkripsi terlalu lama.");
  }).finally(() => {
    clearTimeout(timeout);
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Transkripsi gagal. Status: ${response.status}`);
  }
  recordGeneration({
    type: "Transkripsi",
    input: file.name,
    output: data.text,
    provider: data.provider,
    model: "Gemini multimodal",
  });
  return data.text;
}

function recordGeneration({ type, input, output, provider, model, skipUsage = false }) {
  if (!skipUsage) {
    const day = todayKey();
    const bucket = state.usage[day] || { total: 0, generate: 0, transcribe: 0 };
    bucket.total += 1;
    if (/transkripsi/i.test(type)) bucket.transcribe += 1;
    else bucket.generate += 1;
    state.usage[day] = bucket;
  }

  state.history.unshift({
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    input: shortText(input, 900),
    output: shortText(output, 4000),
    provider: provider || "-",
    model: model || "-",
    brand: getBrandContext().brandName,
    userEmail: authState.user?.email || "",
    createdAt: new Date().toISOString(),
  });
  state.history = state.history.slice(0, 100);
  storage.write("creatorHistory", state.history);
  storage.write("creatorUsage", state.usage);
  renderHistory();
  db.saveSoon();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Gagal membaca file video/audio."));
    reader.readAsDataURL(file);
  });
}

async function readBrandDnaFile(file) {
  if (!file) throw new Error("Pilih file Brand DNA dulu.");
  if (file.size > 700 * 1024) throw new Error("File Brand DNA terlalu besar. Maksimal 700 KB.");
  return (await file.text()).trim();
}

async function initAuth() {
  renderAuthUI();
  try {
    const response = await fetch(`${API_BASE}/api/config`);
    if (!response.ok) throw new Error("Config auth tidak tersedia.");
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      authState.ready = false;
      authState.error = "Konfigurasi login belum lengkap. Cek SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di Vercel.";
      renderAuthUI();
      return;
    }

    const sdkReady = await ensureSupabaseSdk();
    if (!sdkReady) {
      authState.ready = false;
      authState.error = "Library login Supabase gagal dimuat. Coba reload halaman atau nonaktifkan extension yang memblokir CDN.";
      renderAuthUI();
      return;
    }

    authState.client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
    const { data } = await authState.client.auth.getSession();
    authState.user = data.session?.user || null;
    authState.ready = true;
    authState.error = "";

    authState.client.auth.onAuthStateChange(async (event, session) => {
      const previousUserId = authState.user?.id || null;
      authState.user = session?.user || null;
      renderAuthUI();
      const nextUserId = authState.user?.id || null;
      if (event !== "INITIAL_SESSION" && previousUserId !== nextUserId) {
        await loadWorkspaceState();
      }
    });
  } catch (error) {
    authState.ready = false;
    authState.error = "Login Google belum siap. Cek /api/config dan redeploy Vercel.";
    renderAuthUI();
  }
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function ensureSupabaseSdk() {
  if (window.supabase?.createClient) return true;

  const sources = [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js",
  ];

  for (const src of sources) {
    try {
      await loadExternalScript(src);
      if (window.supabase?.createClient) return true;
    } catch (error) {
      // Try the next CDN.
    }
  }

  return false;
}

function renderAuthUI() {
  const loginButton = $("#loginGoogle");
  const logoutButton = $("#logoutGoogle");
  const accountName = $("#accountName");
  const accountEmail = $("#accountEmail");
  if (!loginButton || !logoutButton || !accountName || !accountEmail) return;
  const adminVisible = isAdminUser();
  $$(".admin-only").forEach((item) => {
    item.hidden = false;
    item.classList.toggle("is-hidden", !adminVisible);
  });

  if (!authState.ready) {
    loginButton.hidden = false;
    loginButton.disabled = true;
    loginButton.textContent = "Login belum aktif";
    logoutButton.hidden = true;
    accountName.textContent = "Digital Creative";
    accountEmail.textContent = "Mode device lokal";
    return;
  }

  const user = authState.user;
  loginButton.hidden = Boolean(user);
  loginButton.disabled = false;
  loginButton.textContent = "Login Google";
  logoutButton.hidden = !user;
  accountName.textContent = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Digital Creative";
  accountEmail.textContent = user?.email || "Data tersimpan di device ini";
}

async function loginWithGoogle() {
  if (!authState.client) {
    showToast(authState.error || "Login Google belum siap. Reload halaman lalu coba lagi.");
    return;
  }

  const { error } = await authState.client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) showToast(error.message);
}

async function logoutGoogle() {
  if (!authState.client) return;
  const { error } = await authState.client.auth.signOut();
  if (error) {
    showToast(error.message);
    return;
  }
  authState.user = null;
  renderAuthUI();
  clearLocalSessionState();
  renderWorkspaceState();
  showToast("Logout berhasil.");
}

function clearLocalSessionState() {
  ["creatorPlans", "creatorBlueprints", "activeBlueprintId", "creatorWorkspaceId"].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // Ignore localStorage cleanup errors.
    }
  });

  state.plans = {};
  state.blueprints = [];
  state.activeBlueprintId = null;
  state.history = [];
  state.usage = {};
  state.lastBlueprintResult = "";
  state.lastProvider = "";
  state.lastModel = "";
  state.lastGeneratedAt = null;
  state.lastUserEmail = "";
  state.blueprintCreatesNew = false;
  state.scriptParts = {};
  state.funnelParts = {};
  state.funnelTopic = "";
  state.selectedDate = null;

  setBrandContext({});
  $("#scriptTopic").value = "";
  $("#videoFile").value = "";
  $("#videoScript").value = "";
  $("#remixTopic").value = "";
  $("#remixResult").value = "";
  $("#planTitle").value = "";
  $("#planScript").value = "";
  $("#ideaInput").value = "";
  $("#chatBox").innerHTML =
    '<div class="bubble assistant">Halo. Tulis saja: "Aku harus bikin konten apa?" atau masukkan keresahan audiens yang mau kamu bahas.</div>';
  $("#blueprintResultContent").innerHTML = emptyBlueprintHtml;
  $("#planEditor").classList.remove("active");
}

function renderWorkspaceState() {
  $("#scriptDraft").textContent = "Belum ada script. Generate tiap bagian di atas.";
  $("#funnelDraft").textContent = "Belum ada script.";
  $("#funnelTopic").textContent = "Pilih salah satu ide. Setelah itu pilih Hook, Foreshadow, Isi, dan CTA.";
  $("#scriptChoices").innerHTML = "";
  $("#funnelChoices").innerHTML = "";
  renderCalendar();
  renderSavedBlueprints();
  renderHistory();
}

function showAIError(container, error) {
  const wrap = $(container);
  const message = friendlyAIError(error.message);
  if (!wrap) {
    showToast(message);
    return;
  }
  wrap.innerHTML = "";
  const box = document.createElement("div");
  box.className = "ai-error";
  box.textContent = message;
  wrap.appendChild(box);
}

function friendlyAIError(message) {
  const text = message || "";
  if (/LOGIN_REQUIRED/i.test(text)) {
    return "Silakan login Google dulu untuk menggunakan fitur AI.";
  }
  if (/Limit generate harian/i.test(text)) {
    return text;
  }
  if (/Semua provider gagal/i.test(text)) {
    return isAdminUser()
      ? "Semua provider AI gagal. Cek key Gemini, OpenRouter, dan Groq di Environment Variables Vercel, lalu redeploy."
      : "Maaf, saat ini AI belum bisa generate. Coba ulangi beberapa saat lagi.";
  }
  if (/quota|rate limit|exceeded|Too Many Requests|429/i.test(text)) {
    return "Limit AI sedang habis di provider utama. Sistem akan coba fallback ke OpenRouter/Groq kalau key-nya aktif. Kalau tetap gagal, cek Environment Variables provider fallback di Vercel.";
  }
  if (/API key not valid|API_KEY_INVALID|invalid api key/i.test(text)) {
    return "Gemini API key belum valid. Cek lagi GEMINI_API_KEY di file .env, lalu restart server.";
  }
  if (/GEMINI_API_KEY belum diset/i.test(text)) {
    return "GEMINI_API_KEY belum diset di file .env. Isi key Gemini dulu, lalu restart server.";
  }
  if (/fetch|ECONNREFUSED|Server AI lokal/i.test(text)) {
    return "Server AI lokal belum aktif. Jalankan start-ai-server.bat, lalu reload halaman.";
  }
  if (/abort|terlalu lama|timed out|timeout/i.test(text)) {
    return "Transkripsi terlalu lama. Coba pakai potongan video/audio yang lebih pendek atau kompres file dulu.";
  }
  if (/API AI cloud|API AI gagal|server/i.test(text)) {
    return isAdminUser()
      ? "API AI cloud gagal merespons. Coba ulangi sekali lagi. Kalau masih gagal, cek Environment Variables dan Function Logs di Vercel."
      : "Maaf, saat ini AI belum bisa merespons. Coba ulangi beberapa saat lagi.";
  }
  return text;
}

function getBrandContext() {
  return {
    brandName: $("#brandName").value.trim() || "brand kamu",
    mainOffer: $("#mainOffer").value.trim() || "produk utama",
    audience: $("#audience").value.trim() || "target audiens",
    painPoint: $("#painPoint").value.trim() || "keresahan audiens",
    brandTone: $("#brandTone").value.trim() || "edukatif, hangat, dan jelas",
    contentGoal: $("#contentGoal").value.trim() || "membangun awareness, trust, dan konversi",
    brandDna: ($("#blueprintResultContent").innerText || "").trim(),
  };
}

function setBrandContext(context) {
  $("#brandName").value = context.brandName || "";
  $("#mainOffer").value = context.mainOffer || "";
  $("#audience").value = context.audience || "";
  $("#painPoint").value = context.painPoint || "";
  $("#brandTone").value = context.brandTone || "";
  $("#contentGoal").value = context.contentGoal || "";
}

function blueprintTitle(context) {
  const brand = context.brandName || "Brand tanpa nama";
  const niche = context.mainOffer || context.contentGoal || "Brand DNA upload";
  return `${brand} - ${niche}`.slice(0, 90);
}

function persistBlueprints() {
  storage.write("creatorBlueprints", state.blueprints);
  storage.write("activeBlueprintId", state.activeBlueprintId);
  db.saveSoon();
}

function updateDraft(target, parts) {
  const draft = Object.entries(partLabels)
    .map(([key, label]) => `${label}\n${parts[key] ? scriptLine(parts[key]) : "-"}`)
    .join("\n\n");
  $(target).textContent = draft;
}

async function generateOptions(part, topic, container, parts, draftTarget, trigger) {
  const cleanTopic = topic.trim();
  if (!cleanTopic) {
    showToast("Isi topik dulu.");
    return;
  }

  const wrap = $(container);
  wrap.innerHTML = "";
  const loading = document.createElement("div");
  loading.className = "ai-loading";
  loading.textContent = "AI sedang membaca blueprint dan menyusun opsi terbaik...";
  wrap.appendChild(loading);
  setLoading(trigger, true);

  let options = [];
  try {
    const text = await askAI({
      topic: `${cleanTopic}\n\nSETTING SCRIPT\n${scriptSettingsPrompt()}`,
      instruction: generationInstruction(part),
      format: `${optionFormatInstruction(part)}\n\nBuat output dalam Bahasa Indonesia, spesifik untuk brand, target market, jenis konten, durasi, dan platform.`,
    });
    options = splitAIOptions(text);
  } catch (error) {
    showAIError(container, error);
    setLoading(trigger, false);
    return;
  }

  wrap.innerHTML = "";
  options.forEach((text, index) => {
    const optionText = text.match(/^OPSI|\d+\./i) ? text : `OPSI ${index + 1}:\n${text}`;
    const card = document.createElement("div");
    card.className = "choice";

    const content = document.createElement("div");
    content.className = "choice-text";
    content.innerHTML = renderAIText(optionText);

    const actions = document.createElement("div");
    actions.className = "choice-actions";

    const selectButton = document.createElement("button");
    selectButton.className = "choice-action primary";
    selectButton.type = "button";
    selectButton.textContent = "Pilih";
    selectButton.addEventListener("click", () => {
      wrap.querySelectorAll(".choice").forEach((choice) => choice.classList.remove("selected"));
      card.classList.add("selected");
      parts[part] = text;
      updateDraft(draftTarget, parts);
    });

    const copyButton = document.createElement("button");
    copyButton.className = "choice-action";
    copyButton.type = "button";
    copyButton.textContent = "Salin";
    copyButton.addEventListener("click", () => copyText(scriptLine(text)));

    actions.append(selectButton, copyButton);
    card.append(content, actions);
    wrap.appendChild(card);
  });
  setLoading(trigger, false);
}

async function renderFunnelIdeas(type) {
  state.currentFunnel = type;
  const list = $("#funnelIdeas");
  list.innerHTML = "";
  const meta = funnelMeta[type];
  const intro = document.createElement("div");
  intro.className = "funnel-note";
  intro.textContent = `${meta.name}: ${meta.job}. Tujuannya ${meta.intent}.`;
  list.appendChild(intro);

  if (!authState.user) {
    const box = document.createElement("div");
    box.className = "ai-error";
    box.textContent = "Login Google dulu untuk generate ide konten funnel.";
    list.appendChild(box);
    return;
  }

  const loading = document.createElement("div");
  loading.className = "ai-loading";
  loading.textContent = "AI sedang membuat 5 ide konten sesuai funnel dan blueprint...";
  list.appendChild(loading);

  let ideas = [];
  try {
    const text = await askAI({
      topic: `${meta.name} - ${meta.job}`,
      instruction: `Buat 5 ide konten untuk tahap ${meta.name}. Fungsi tahap ini: ${meta.intent}. Setiap ide harus sesuai dengan blueprint brand, punya angle, value yang disampaikan, format eksekusi, dan janji ke audiens.`,
      format:
        "Format wajib:\nOPSI 1:\nFUNNEL: AWARENESS/CONSIDERATION/CONVERSION\nANGLE: ...\nIDE: ...\nVALUE: ...\nFORMAT: ...\nJANJI KE AUDIENS: ...\n\nBuat 5 opsi. Jangan buat script dulu.",
    });
    ideas = splitAIOptions(text);
  } catch (error) {
    list.removeChild(loading);
    const box = document.createElement("div");
    box.className = "ai-error";
    box.textContent = friendlyAIError(error.message);
    list.appendChild(box);
    return;
  }

  list.removeChild(loading);
  ideas.forEach((idea, index) => {
    const button = document.createElement("button");
    button.className = "idea-card";
    button.type = "button";
    button.textContent = idea.match(/^OPSI|\d+\./i) ? idea : `OPSI ${index + 1}:\n${idea}`;
    button.addEventListener("click", () => {
      list.querySelectorAll(".idea-card").forEach((card) => card.classList.remove("selected"));
      button.classList.add("selected");
      state.funnelTopic = idea;
      state.funnelParts = {};
      $("#funnelTopic").textContent = `Topik: ${idea}`;
      $("#funnelChoices").innerHTML = "";
      $("#funnelDraft").textContent = "Belum ada script. Generate tiap bagian di atas.";
    });
    list.appendChild(button);
  });
}

function renderCalendar() {
  const date = state.calendarDate;
  const year = date.getFullYear();
  const month = date.getMonth();
  $("#monthLabel").textContent = `${monthNames[month]} ${year}`;
  const calendar = $("#calendar");
  calendar.innerHTML = "";

  ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].forEach((day) => {
    const node = document.createElement("div");
    node.className = "day-name";
    node.textContent = day;
    calendar.appendChild(node);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDay; i += 1) {
    calendar.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const button = document.createElement("button");
    const today = new Date();
    const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
    button.className = `day${isToday ? " today" : ""}${state.plans[key] ? " has-plan" : ""}`;
    button.type = "button";
    button.innerHTML = `<span>${day}</span>${state.plans[key] ? `<small>${state.plans[key].title}</small>` : ""}`;
    button.addEventListener("click", () => openPlanEditor(key));
    calendar.appendChild(button);
  }
}

function openPlanEditor(key) {
  state.selectedDate = key;
  const [year, month, day] = key.split("-");
  $("#selectedDateTitle").textContent = `${Number(day)} ${monthNames[Number(month) - 1]} ${year}`;
  $("#planTitle").value = state.plans[key]?.title || "";
  $("#planScript").value = state.plans[key]?.script || "";
  $("#planEditor").classList.add("active");
}

function renderSavedBlueprints() {
  const list = $("#savedBlueprints");
  if (!list) return;
  list.innerHTML = "";

  if (!state.blueprints.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Belum ada blueprint tersimpan. Generate Brand DNA dulu, lalu klik Simpan Blueprint.";
    list.appendChild(empty);
    return;
  }

  state.blueprints.forEach((profile) => {
    const card = document.createElement("div");
    card.className = `saved-profile${profile.id === state.activeBlueprintId ? " active" : ""}`;

    const info = document.createElement("div");
    info.innerHTML = `<strong>${profile.title}</strong><span>${profile.context.audience || "Target market belum diisi"}</span>`;

    const useButton = document.createElement("button");
    useButton.className = "tiny-btn";
    useButton.type = "button";
    useButton.textContent = profile.id === state.activeBlueprintId ? "Aktif" : "Pakai";
    useButton.addEventListener("click", () => activateBlueprint(profile.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "tiny-btn danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Hapus";
    deleteButton.addEventListener("click", () => deleteBlueprint(profile.id));

    card.append(info, useButton, deleteButton);
    list.appendChild(card);
  });
}

function renderHistory() {
  const usageWrap = $("#usageSummary");
  const historyWrap = $("#historyList");
  if (!usageWrap || !historyWrap) return;

  const today = state.usage[todayKey()] || { total: 0, generate: 0, transcribe: 0 };
  usageWrap.innerHTML = [
    ["Total hari ini", today.total || 0],
    ["Generate teks", today.generate || 0],
    ["Transkripsi", today.transcribe || 0],
  ]
    .map(([label, value]) => `<div class="usage-card"><strong>${value}</strong><span>${label}</span></div>`)
    .join("");

  historyWrap.innerHTML = "";
  if (!state.history.length) {
    historyWrap.innerHTML = '<p class="muted">Belum ada riwayat generate.</p>';
    return;
  }

  state.history.forEach((item) => {
    const card = document.createElement("article");
    card.className = "history-item";
    const date = new Date(item.createdAt);
    card.innerHTML = `
      <h3>${escapeHtml(item.type)} - ${escapeHtml(item.brand || "Brand")}</h3>
      <div class="history-meta">${date.toLocaleString("id-ID")} | ${escapeHtml(item.provider || "-")} | ${escapeHtml(item.model || "-")}</div>
      <p><strong>Input:</strong> ${escapeHtml(item.input)}</p>
      <p><strong>Output:</strong> ${escapeHtml(item.output)}</p>
      <div class="history-actions">
        <button class="tiny-btn" type="button">Salin Output</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", () => copyText(item.output));
    historyWrap.appendChild(card);
  });
}

async function loadAdminDashboard() {
  if (!isAdminUser()) {
    $("#adminRows").innerHTML = '<tr><td colspan="10">Dashboard admin hanya untuk akun admin.</td></tr>';
    $("#adminSummary").innerHTML = "";
    return;
  }

  $("#adminRows").innerHTML = '<tr><td colspan="10">Memuat data admin...</td></tr>';
  try {
    const session = authState.client ? (await authState.client.auth.getSession()).data.session : null;
    const response = await fetch(`${API_BASE}/api/admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ email: authState.user.email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error([data.error, data.detail].filter(Boolean).join(" - ") || "Gagal membaca data admin.");
    renderAdminDashboard(data);
  } catch (error) {
    $("#adminRows").innerHTML = `<tr><td colspan="10">Gagal membaca data admin: ${escapeHtml(error.message)}</td></tr>`;
    $("#adminSummary").innerHTML = "";
  }
}

async function updateAdminPackage(workspaceId, packagePlan, dailyLimitOverride, button) {
  if (!isAdminUser()) return;
  setLoading(button, true, "Simpan");
  try {
    const session = authState.client ? (await authState.client.auth.getSession()).data.session : null;
    const response = await fetch(`${API_BASE}/api/admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        email: authState.user.email,
        action: "updatePackage",
        workspaceId,
        packagePlan,
        dailyLimitOverride,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Gagal update paket.");
    showToast("Paket user berhasil diupdate.");
    await loadAdminDashboard();
  } catch (error) {
    showToast(error.message || "Gagal update paket user.");
  } finally {
    setLoading(button, false, "Simpan");
  }
}

function renderAdminDashboard(data) {
  const users = data.users || [];
  const totalGenerate = users.reduce((sum, user) => sum + Number(user.generateToday || 0), 0);
  const totalTranscribe = users.reduce((sum, user) => sum + Number(user.transcribeToday || 0), 0);
  const activeUsers = users.filter((user) => user.generateToday || user.transcribeToday).length;
  const paidUsers = users.filter((user) => user.packagePlan === "paid").length;
  const lastAiUser =
    data.latestAi ||
    users
      .filter((user) => user.lastProvider && user.lastProvider !== "-")
      .sort((a, b) => String(b.lastGeneratedAt || "").localeCompare(String(a.lastGeneratedAt || "")))[0];
  const lastAiLabel = lastAiUser ? `${lastAiUser.provider || lastAiUser.lastProvider}${(lastAiUser.model || lastAiUser.lastModel) && (lastAiUser.model || lastAiUser.lastModel) !== "-" ? ` / ${lastAiUser.model || lastAiUser.lastModel}` : ""}` : "-";

  $("#adminSummary").innerHTML = [
    ["User tersimpan", users.length],
    ["Aktif hari ini", activeUsers],
    ["Generate hari ini", totalGenerate],
    ["Transkripsi hari ini", totalTranscribe],
    ["User berbayar", paidUsers],
    ["AI aktif terakhir", lastAiLabel],
  ]
    .map(([label, value]) => `<div class="usage-card"><strong>${value}</strong><span>${label}</span></div>`)
    .join("");

  if (!users.length) {
    $("#adminRows").innerHTML = '<tr><td colspan="10">Belum ada data user.</td></tr>';
    return;
  }

  $("#adminRows").innerHTML = users
    .map((user) => {
      const date = user.updatedAt ? new Date(user.updatedAt).toLocaleString("id-ID") : "-";
      const generatedAt = user.lastGeneratedAt ? new Date(user.lastGeneratedAt).toLocaleString("id-ID") : "-";
      return `
        <tr data-admin-user="${escapeHtml(user.id)}">
          <td><strong>${escapeHtml(user.email || "-")}</strong><span>${escapeHtml(user.workspaceIds?.length > 1 ? `${user.workspaceIds.length} workspace - terbaru: ${user.id}` : user.id)}</span></td>
          <td>
            <select class="admin-select" data-package-plan>
              <option value="free"${user.packagePlan === "paid" ? "" : " selected"}>Gratis</option>
              <option value="paid"${user.packagePlan === "paid" ? " selected" : ""}>Berbayar</option>
            </select>
          </td>
          <td>
            <div class="admin-limit-control">
              <input class="admin-limit-input" data-package-limit type="number" min="1" placeholder="${Number(user.dailyLimit || 0)}" value="${user.dailyLimitOverride ? Number(user.dailyLimitOverride) : ""}" />
              <button class="tiny-btn" data-package-save type="button">Simpan</button>
            </div>
            <span>Aktif: ${Number(user.dailyLimit || 0)} generate/hari</span>
          </td>
          <td>${escapeHtml(user.activeBrand || "-")}</td>
          <td>${escapeHtml(user.lastProvider || "-")}<span>${escapeHtml(user.lastModel || "-")}</span><span>${escapeHtml(generatedAt)}</span></td>
          <td>${Number(user.generateToday || 0)}</td>
          <td>${Number(user.transcribeToday || 0)}</td>
          <td>${Number(user.blueprintCount || 0)}</td>
          <td>${Number(user.historyCount || 0)}</td>
          <td>${escapeHtml(date)}</td>
        </tr>
      `;
    })
    .join("");

  $$("[data-admin-user]").forEach((row) => {
    const saveButton = row.querySelector("[data-package-save]");
    saveButton?.addEventListener("click", () => {
      updateAdminPackage(
        row.dataset.adminUser,
        row.querySelector("[data-package-plan]")?.value || "free",
        row.querySelector("[data-package-limit]")?.value || "",
        saveButton,
      );
    });
  });
}

function activateBlueprint(id) {
  const profile = state.blueprints.find((item) => item.id === id);
  if (!profile) return;
  state.activeBlueprintId = id;
  state.blueprintCreatesNew = false;
  setBrandContext(profile.context);
  state.lastBlueprintResult = profile.result || "";
  if (profile.result) $("#blueprintResultContent").innerHTML = profile.result;
  persistBlueprints();
  renderSavedBlueprints();
  state.scriptParts = {};
  state.funnelParts = {};
  $("#scriptDraft").textContent = "Belum ada script. Generate tiap bagian di atas.";
  $("#funnelDraft").textContent = "Belum ada script.";
  showToast("Blueprint aktif dipakai generator.");
}

function deleteBlueprint(id) {
  state.blueprints = state.blueprints.filter((item) => item.id !== id);
  if (state.activeBlueprintId === id) state.activeBlueprintId = null;
  if (!state.activeBlueprintId) state.blueprintCreatesNew = true;
  persistBlueprints();
  renderSavedBlueprints();
  showToast("Blueprint dihapus.");
}

function saveCurrentBlueprint() {
  const context = getBrandContext();
  const hasContent = Object.values(context).some((value) => value && !["brand kamu", "produk utama", "target audiens", "keresahan audiens"].includes(value));
  if (!hasContent) {
    showToast("Isi blueprint dulu sebelum disimpan.");
    return;
  }

  const existingId = state.blueprintCreatesNew ? null : state.activeBlueprintId;
  const id = existingId || `bp-${Date.now()}`;
  const profile = {
    id,
    title: blueprintTitle(context),
    context,
    result: state.lastBlueprintResult || $("#blueprintResultContent").innerHTML,
    updatedAt: new Date().toISOString(),
  };

  const index = state.blueprints.findIndex((item) => item.id === id);
  if (index >= 0) {
    state.blueprints[index] = profile;
  } else {
    state.blueprints.unshift(profile);
  }

  state.activeBlueprintId = id;
  state.blueprintCreatesNew = false;
  persistBlueprints();
  renderSavedBlueprints();
  showToast("Blueprint tersimpan dan aktif.");
}

function planRows() {
  return Object.entries(state.plans)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, plan]) => ({
      date,
      title: plan.title || "",
      script: plan.script || "",
    }));
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCalendarCsv() {
  const rows = planRows();
  if (!rows.length) {
    showToast("Belum ada plan untuk diexport.");
    return;
  }
  const header = ["Tanggal", "Ide Konten", "Script"];
  const csv = [
    header.map(csvEscape).join(","),
    ...rows.map((row) => [row.date, row.title, row.script].map(csvEscape).join(",")),
  ].join("\n");
  downloadTextFile("kalendar-konten.csv", csv, "text/csv;charset=utf-8");
}

function exportCalendarJson() {
  const rows = planRows();
  if (!rows.length) {
    showToast("Belum ada plan untuk diexport.");
    return;
  }
  downloadTextFile("kalendar-konten.json", JSON.stringify(rows, null, 2), "application/json;charset=utf-8");
}

function generateIdeaResponse(topic) {
  const context = getBrandContext();
  return `Siap. Aku posisikan diri sebagai content director untuk "${topic}".\n\nBRIEF CEPAT:\nBrand: ${context.brandName}\nTarget: ${context.audience}\nKeresahan: ${context.painPoint}\nGaya: ${context.brandTone}\n\n5 IDE KONTEN BERNILAI:\n1. AWARENESS - Question angle\n   Ide: "Apa kesalahan yang sering terjadi saat orang menilai ${topic}?"\n   Value: memancing rasa ingin tahu dan membuat audiens sadar ada hal yang perlu dicek.\n   Format: talking head + teks pertanyaan besar.\n\n2. AWARENESS - Visual angle\n   Ide: "Tebak mana yang lebih layak: contoh A atau B?"\n   Value: audiens ikut berpikir, bukan hanya menonton pasif.\n   Format: split-screen / perbandingan visual.\n\n3. CONSIDERATION - Proof angle\n   Ide: "Bedah contoh nyata dari ${context.brandName}: mana klaim, mana bukti."\n   Value: membangun trust lewat proses dan alasan yang jelas.\n   Format: behind the scene / tour proses.\n\n4. CONSIDERATION - Checklist angle\n   Ide: "Checklist sebelum percaya klaim tentang ${topic}."\n   Value: konten bisa disimpan dan dipakai ulang.\n   Format: listicle 3-5 poin.\n\n5. CONVERSION - Decision helper\n   Ide: "Kalau kamu mau ambil keputusan soal ${topic}, mulai dari cek kebutuhanmu dulu."\n   Value: mengarahkan ke konsultasi tanpa hard selling.\n   Format: direct response + soft CTA.\n\nARAH EKSEKUSI:\nPilih satu ide yang paling kuat, buat script, sesuaikan dengan gaya kamu, lalu jadwalkan di Kalendar Konten.`;
}

function goHome() {
  const homeNav = $('.nav-item[data-section="blueprint"]');
  if (homeNav) homeNav.click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleSidebar(forceOpen = null) {
  const shouldOpen = forceOpen ?? document.body.classList.contains("sidebar-collapsed");
  document.body.classList.toggle("sidebar-collapsed", !shouldOpen);
  $("#menuToggle").setAttribute("aria-label", shouldOpen ? "Tutup menu" : "Buka menu");
}

function initResponsiveSidebar() {
  if (window.innerWidth <= 920) toggleSidebar(false);
}

$$("[data-home]").forEach((button) => {
  button.addEventListener("click", goHome);
});

$("#menuToggle").addEventListener("click", () => toggleSidebar(true));
$("#sidebarClose").addEventListener("click", () => toggleSidebar(false));

$$(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    $$(".nav-item").forEach((nav) => nav.classList.remove("active"));
    $$(".view").forEach((view) => view.classList.remove("active"));
    item.classList.add("active");
    $(`#${item.dataset.section}`).classList.add("active");
    if (item.dataset.section === "admin") loadAdminDashboard();
    if (window.innerWidth <= 920) toggleSidebar(false);
  });
});

$("#loginGoogle").addEventListener("click", loginWithGoogle);
$("#logoutGoogle").addEventListener("click", logoutGoogle);

$("#blueprintSample").addEventListener("click", () => {
  state.activeBlueprintId = null;
  state.blueprintCreatesNew = true;
  $("#brandName").value = "Sedjati Eco Farm";
  $("#mainOffer").value = "Domba Garut sehat, edukasi ternak, dan pendampingan peternak.";
  $("#audience").value = "Peternak pemula, calon pembeli domba, dan orang yang ingin mulai usaha ternak.";
  $("#painPoint").value = "Takut salah beli bibit, bingung pakan, kandang kurang ideal, dan ragu hasil ternak tidak berkembang.";
  $("#brandTone").value = "Santai, edukatif, jujur, humoris, dan berbasis pengalaman lapangan.";
  $("#contentGoal").value = "Membangun trust, edukasi harian, meningkatkan konsultasi, dan mengarahkan calon pembeli ke keputusan yang tepat.";
});

$("#generateBlueprint").addEventListener("click", async (event) => {
  const context = getBrandContext();
  const result = $("#blueprintResultContent");
  state.blueprintCreatesNew = !state.activeBlueprintId;
  setLoading(event.currentTarget, true);
  result.innerHTML = "<h2>AI sedang menyusun Master Blueprint...</h2><p>Membaca assessment dan merumuskan arah konten.</p>";
  try {
    const text = await askAI({
      topic: JSON.stringify(context, null, 2),
      instruction:
        "Buat Master Blueprint / Brand DNA untuk kreator ini. Jelaskan positioning, content mission, target market insight, pilar konten, tone of voice, jenis konten yang harus sering dibuat, dan aturan eksekusi agar konten tidak random.",
      format:
        "Format dengan heading pendek: IDENTITAS, TARGET MARKET, INSIGHT AUDIENS, CONTENT MISSION, PILAR KONTEN, TONE OF VOICE, AWARENESS/CONSIDERATION/CONVERSION STRATEGY, ATURAN EKSEKUSI. Gunakan HTML sederhana: <h2>, <p>, <strong>, <br>.",
    });
    result.innerHTML = text;
    state.lastBlueprintResult = text;
  } catch (error) {
    const errorHtml = `<h2>AI belum tersambung</h2><p>${friendlyAIError(error.message)}</p>`;
    result.innerHTML = errorHtml;
    state.lastBlueprintResult = errorHtml;
  }
  setLoading(event.currentTarget, false);
});

$("#generateBlueprintFromFile").addEventListener("click", async (event) => {
  const file = $("#brandDnaFile").files[0];
  const result = $("#blueprintResultContent");
  state.activeBlueprintId = null;
  state.blueprintCreatesNew = true;
  setLoading(event.currentTarget, true);
  result.innerHTML = "<h2>AI sedang membaca Brand DNA...</h2><p>Mencermati konsep, arah, experience, dan peluang kontennya.</p>";
  try {
    const fileText = await readBrandDnaFile(file);
    const fileName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    $("#brandName").value = fileName || "Brand dari upload";
    $("#mainOffer").value = "Brand DNA dari file upload";
    $("#audience").value = "";
    $("#painPoint").value = "";
    $("#brandTone").value = "";
    $("#contentGoal").value = "";

    const text = await askAI({
      topic: `NAMA FILE: ${file.name}\n\nBRAND DNA ASLI:\n${fileText}`,
      instruction:
        "Kamu berperan sebagai brand strategist, content director, copywriter, dan creator experience planner. Cermati Brand DNA yang diupload pengguna, pahami konsep brand, arah komunikasi, personality, target market, value, dan experience yang ingin dibangun. Lalu generate ulang menjadi Master Blueprint / Brand DNA yang lebih rapi, tajam, operasional, dan siap dipakai sebagai panduan AI untuk membuat konten.",
      format:
        "Format dengan HTML sederhana: <h2>, <p>, <strong>, <ul>, <li>. Wajib ada heading: IDENTITAS BRAND, BRAND ESSENCE, TARGET MARKET, INSIGHT AUDIENS, VALUE PROPOSITION, CONTENT MISSION, PILAR KONTEN, TONE OF VOICE, EXPERIENCE YANG DIBANGUN, AWARENESS/CONSIDERATION/CONVERSION STRATEGY, ATURAN EKSEKUSI, CONTOH ARAH KONTEN. Jangan hanya merapikan kata, tetapi tambahkan interpretasi strategis yang relevan.",
    });
    result.innerHTML = text;
    state.lastBlueprintResult = text;
    showToast("Brand DNA file berhasil digenerate ulang.");
  } catch (error) {
    const errorHtml = `<h2>Brand DNA belum bisa diproses</h2><p>${friendlyAIError(error.message)}</p>`;
    result.innerHTML = errorHtml;
    state.lastBlueprintResult = errorHtml;
  }
  setLoading(event.currentTarget, false);
});

$("#saveBlueprint").addEventListener("click", saveCurrentBlueprint);

$("#ideaForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("#ideaInput");
  const topic = input.value.trim();
  if (!topic) return;
  const chat = $("#chatBox");
  chat.insertAdjacentHTML("beforeend", `<div class="bubble user">${topic}</div>`);
  chat.insertAdjacentHTML("beforeend", `<div class="bubble assistant" id="thinkingBubble">AI sedang menyusun ide konten sesuai blueprint...</div>`);
  input.value = "";
  chat.scrollTop = chat.scrollHeight;
  try {
    const text = await askAI({
      topic,
      instruction:
        "Jawab sebagai content director. Berikan ide konten yang sesuai branding, target market, keresahan audiens, dan tujuan konten. Jangan jawab generik. Beri ide Awareness, Consideration, dan Conversion bila relevan.",
      format:
        "Format: BRIEF CEPAT, 5 IDE KONTEN BERNILAI, VALUE YANG DISAMPAIKAN, FORMAT EKSEKUSI, ARAH SCRIPT. Gunakan baris baru yang rapi.",
    });
    $("#thinkingBubble").innerHTML = renderAIText(text);
    $("#thinkingBubble").removeAttribute("id");
  } catch (error) {
    $("#thinkingBubble").textContent = friendlyAIError(error.message);
    $("#thinkingBubble").removeAttribute("id");
  }
  chat.scrollTop = chat.scrollHeight;
});

$$("[data-generate]").forEach((button) => {
  button.addEventListener("click", () => {
    generateOptions(button.dataset.generate, $("#scriptTopic").value, "#scriptChoices", state.scriptParts, "#scriptDraft", button);
  });
});

$$("[data-generate-full]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.generateFull === "script") {
      generateFullScript($("#scriptTopic").value, state.scriptParts, "#scriptDraft", button);
      return;
    }
    generateFullScript(state.funnelTopic, state.funnelParts, "#funnelDraft", button);
  });
});

$("#transcribeVideo").addEventListener("click", async (event) => {
  const file = $("#videoFile").files[0];
  if (!file) {
    showToast("Upload video/audio dulu.");
    return;
  }

  const maxBytes = IS_LOCAL_APP ? 18 * 1024 * 1024 : 4 * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast(IS_LOCAL_APP ? "File terlalu besar. Maksimal 18 MB." : "Di Vercel, pakai file maksimal 4 MB dulu.");
    return;
  }

  setLoading(event.currentTarget, true);
  $("#remixResult").value = "";
  $("#videoScript").value = "AI sedang mendengarkan percakapan dan mengubahnya menjadi text...";
  try {
    $("#videoScript").value = await transcribeMedia(file);
  } catch (error) {
    $("#videoScript").value = friendlyAIError(error.message);
  } finally {
    setLoading(event.currentTarget, false);
  }
});

$("#resetVideoFile").addEventListener("click", () => {
  $("#videoFile").value = "";
  $("#videoScript").value = "";
  $("#remixTopic").value = "";
  $("#remixResult").value = "";
  const button = $("#transcribeVideo");
  button.disabled = false;
  button.textContent = button.dataset.originalText || "Ambil Percakapan ke Text";
  showToast("Video ke Text direset.");
});

["contentType", "contentDuration", "contentPlatform"].forEach((id) => {
  $(`#${id}`).addEventListener("change", () => {
    state.scriptParts = {};
    $("#scriptChoices").innerHTML = "";
    $("#scriptDraft").textContent = "Belum ada script. Generate tiap bagian di atas.";
  });
});

$("#remixScript").addEventListener("click", async (event) => {
  const topic = $("#remixTopic").value.trim();
  if (!topic) {
    showToast("Isi topik remix dulu.");
    return;
  }
  setLoading(event.currentTarget, true);
  $("#remixResult").value = "AI sedang meremix struktur referensi menjadi script baru...";
  try {
    $("#remixResult").value = await askAI({
      topic: `TOPIK BARU: ${topic}\n\nTRANSKRIP REFERENSI:\n${$("#videoScript").value}`,
      instruction:
        `Remix transkrip video referensi menjadi script baru sesuai topik baru, brand, target market, dan keresahan audiens. Jangan plagiat. Ambil pola komunikasi, ritme, hook, dan alur persuasi, bukan kata-kata mentahnya. ${hookRule}`,
      format:
        "Format script final: HOOK, FORESHADOW, ISI, CTA, ARAH VISUAL, CATATAN ADAPTASI. HOOK wajib 1 kalimat pendek maksimal 8-12 kata untuk 3-5 detik pertama. Buat siap dipakai untuk video pendek.",
    });
  } catch (error) {
    $("#remixResult").value = friendlyAIError(error.message);
  }
  setLoading(event.currentTarget, false);
});

$$("[data-funnel]").forEach((button) => {
  button.addEventListener("click", () => {
    $$("[data-funnel]").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    renderFunnelIdeas(button.dataset.funnel);
  });
});

$$("[data-funnel-generate]").forEach((button) => {
  button.addEventListener("click", () => {
    generateOptions(button.dataset.funnelGenerate, state.funnelTopic, "#funnelChoices", state.funnelParts, "#funnelDraft", button);
  });
});

$$("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => {
    copyText(getCopyTextById(button.dataset.copy));
  });
});

$$("[data-copy-value]").forEach((button) => {
  button.addEventListener("click", () => {
    copyText(getCopyTextById(button.dataset.copyValue));
  });
});

$("#prevMonth").addEventListener("click", () => {
  state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
  renderCalendar();
});

$("#nextMonth").addEventListener("click", () => {
  state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
  renderCalendar();
});

$("#savePlan").addEventListener("click", () => {
  if (!state.selectedDate) {
    showToast("Pilih tanggal dulu.");
    return;
  }
  state.plans[state.selectedDate] = {
    title: $("#planTitle").value.trim() || "Konten tanpa judul",
    script: $("#planScript").value.trim(),
  };
  storage.write("creatorPlans", state.plans);
  db.saveSoon();
  renderCalendar();
  showToast("Plan tersimpan.");
});

$("#exportCsv").addEventListener("click", exportCalendarCsv);
$("#exportJson").addEventListener("click", exportCalendarJson);
$("#refreshAdmin").addEventListener("click", loadAdminDashboard);
$("#clearHistory").addEventListener("click", () => {
  state.history = [];
  state.usage = {};
  storage.write("creatorHistory", state.history);
  storage.write("creatorUsage", state.usage);
  renderHistory();
  db.saveSoon();
  showToast("Riwayat generate dihapus.");
});

async function loadWorkspaceState() {
  const isLoggedIn = Boolean(authState.user);
  const localPlans = storage.read("creatorPlans", "{}");
  const localBlueprints = storage.read("creatorBlueprints", "[]");
  const localActiveBlueprintId = storage.read("activeBlueprintId", "null");
  const localHistory = storage.read("creatorHistory", "[]");
  const localUsage = storage.read("creatorUsage", "{}");
  state.plans = isLoggedIn ? {} : localPlans;
  state.blueprints = isLoggedIn ? [] : localBlueprints;
  state.activeBlueprintId = isLoggedIn ? null : localActiveBlueprintId;
  state.history = isLoggedIn ? [] : localHistory;
  state.usage = isLoggedIn ? {} : localUsage;
  state.lastBlueprintResult = "";

  const data = await db.load();
  if (data) {
    const backendHasData =
      Object.keys(data.plans || {}).length ||
      (data.blueprints || []).length ||
      (data.history || []).length ||
      Object.keys(data.usage || {}).length;

    if (backendHasData) {
      state.plans = data.plans || {};
      state.blueprints = data.blueprints || [];
      state.activeBlueprintId = data.activeBlueprintId || null;
      state.history = data.history || [];
      state.usage = data.usage || {};
      state.lastProvider = data.lastProvider || "";
      state.lastModel = data.lastModel || "";
      state.lastGeneratedAt = data.lastGeneratedAt || null;
      state.lastUserEmail = data.lastUserEmail || "";
    } else if (!isLoggedIn && (Object.keys(localPlans).length || localBlueprints.length || localHistory.length || Object.keys(localUsage).length)) {
      state.plans = localPlans;
      state.blueprints = localBlueprints;
      state.history = localHistory;
      state.usage = localUsage;
      db.saveNow();
    }
  }

  state.scriptParts = {};
  state.funnelParts = {};
  state.funnelTopic = "";
  renderWorkspaceState();
  loadActiveBlueprint();
}

async function initApp() {
  initResponsiveSidebar();
  await initAuth();
  renderFunnelIdeas("tofu");
  await loadWorkspaceState();
}

function loadActiveBlueprint() {
  if (!state.activeBlueprintId) return;
  const activeProfile = state.blueprints.find((profile) => profile.id === state.activeBlueprintId);
  if (activeProfile) {
    setBrandContext(activeProfile.context);
    state.lastBlueprintResult = activeProfile.result || "";
    if (activeProfile.result) $("#blueprintResultContent").innerHTML = activeProfile.result;
    renderSavedBlueprints();
  }
}

initApp();
