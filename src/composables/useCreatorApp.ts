import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { emptyBlueprintHtml, funnelMeta, generationInstruction, monthNames, partLabels } from "../data/content";
import { generateContent, isLocalApp, loadDb, saveDb, transcribeContent } from "../services/api";
import type { AiResult, AskAIPayload, BlueprintProfile, BrandContext, CalendarDay, ChatMessage, FunnelStage, GenerationHistoryItem, NavItem, NavView, PlanItem, PlanRow, ScriptChoice, ScriptPart, ScriptSettings, UsageBucket } from "../types";
import { storage } from "../utils/storage";
import { escapeHtml, renderAIText, scriptLine, splitAIOptions } from "../utils/text";

export function useCreatorApp() {
const navItems: NavItem[] = [
  { id: "blueprint", label: "Blueprint", icon: "□" },
  { id: "ideation", label: "Cari Ide", icon: "?" },
  { id: "script", label: "Bikin Script", icon: "✎" },
  { id: "video", label: "Video ke Text", icon: "▶" },
  { id: "funnel", label: "Konten Express", icon: "↗" },
  { id: "plan", label: "Kalendar Konten", icon: "▦" },
];
const scriptParts: ScriptPart[] = ["hook", "foreshadow", "body", "cta"];
const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const activeView = ref<NavView>("blueprint");
const toast = ref("");
const chatBox = ref<HTMLElement | null>(null);
const ideaInput = ref("");
const scriptTopic = ref("");
const videoFile = ref<File | null>(null);
const videoScript = ref("");
const remixTopic = ref("");
const remixResult = ref("");
const blueprintResult = ref(emptyBlueprintHtml);
const planTitle = ref("");
const planScript = ref("");
const selectedScriptChoice = ref<number | null>(null);
const selectedFunnelChoice = ref<number | null>(null);
const scriptChoices = ref<ScriptChoice[]>([]);
const funnelChoices = ref<ScriptChoice[]>([]);
const funnelIdeas = ref<string[]>([]);
const funnelError = ref("");

const scriptSettings = reactive<ScriptSettings>({
  type: "Reels",
  duration: "45",
  platform: "Instagram",
});

const brand = reactive<BrandContext>({
  brandName: "",
  mainOffer: "",
  audience: "",
  painPoint: "",
  brandTone: "",
  contentGoal: "",
});

const auth = reactive({
  client: null as null,
  user: null as null,
  ready: false,
});

const state = reactive({
  scriptParts: {} as Partial<Record<ScriptPart, string>>,
  funnelParts: {} as Partial<Record<ScriptPart, string>>,
  funnelTopic: "",
  currentFunnel: "tofu" as FunnelStage,
  selectedDate: null as string | null,
  calendarDate: new Date(),
  plans: storage.read<Record<string, PlanItem>>("creatorPlans", "{}"),
  blueprints: storage.read<BlueprintProfile[]>("creatorBlueprints", "[]"),
  activeBlueprintId: storage.read<string | null>("activeBlueprintId", "null"),
  history: storage.read<GenerationHistoryItem[]>("creatorHistory", "[]"),
  usage: storage.read<Record<string, UsageBucket>>("creatorUsage", "{}"),
  lastBlueprintResult: "",
  blueprintCreatesNew: false,
});

const loading = reactive({
  blueprint: false,
  scriptFull: false,
  scriptPart: "",
  funnelFull: false,
  funnelPart: "",
  funnelIdeas: false,
  transcribe: false,
  remix: false,
});

const chatMessages = ref<ChatMessage[]>([
  {
    id: crypto.randomUUID(),
    role: "assistant",
    html: "Halo. Tulis saja: &quot;Aku harus bikin konten apa?&quot; atau masukkan keresahan audiens yang mau kamu bahas.",
  },
]);

const WORKSPACE_ID = getWorkspaceId();

const activeFunnel = computed(() => funnelMeta[state.currentFunnel]);
const accountName = computed(() => "Digital Creative");
const accountEmail = computed(() => {
  if (!auth.ready) return "Menyiapkan database";
  return "Data tersimpan di SQL database";
});
const activePageTitle = computed(() => navItems.find((item) => item.id === activeView.value)?.label || "Workspace");
const workspaceStatus = computed(() => (workspaceReady.value ? "SQL sync aktif" : "Mode lokal"));
const monthLabel = computed(() => `${monthNames[state.calendarDate.getMonth()]} ${state.calendarDate.getFullYear()}`);
const calendarBlanks = computed(() => Array.from({ length: new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), 1).getDay() }, (_, index) => index));
const calendarDays = computed<CalendarDay[]>(() => {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const today = new Date();
    return { day, key, isToday: year === today.getFullYear() && month === today.getMonth() && day === today.getDate() };
  });
});
const selectedDateTitle = computed(() => {
  if (!state.selectedDate) return "Pilih tanggal";
  const [year, month, day] = state.selectedDate.split("-");
  return `${Number(day)} ${monthNames[Number(month) - 1]} ${year}`;
});
const scriptDraft = computed(() => draftFromParts(state.scriptParts));
const funnelDraft = computed(() => draftFromParts(state.funnelParts));
const blueprintPlainText = computed(() => blueprintResult.value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

let toastTimer: number | undefined;
function showToast(message: string) {
  toast.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.value = "";
  }, 1800);
}

function getWorkspaceId(): string {
  const param = new URLSearchParams(window.location.search).get("workspace");
  if (param) {
    const cleanParam = cleanWorkspaceId(param);
    storage.write("creatorWorkspaceId", cleanParam);
    return cleanParam;
  }
  const existing = cleanWorkspaceId(storage.read<string | null>("creatorWorkspaceId", "null"));
  if (existing) return existing;
  const next = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  storage.write("creatorWorkspaceId", next);
  return next;
}

function cleanWorkspaceId(value: unknown): string {
  return String(value || "")
    .replace(/^"+|"+$/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
}

function getActiveWorkspaceId(): string {
  return WORKSPACE_ID;
}

function getBrandContext(): BrandContext {
  return {
    brandName: brand.brandName.trim() || "brand kamu",
    mainOffer: brand.mainOffer.trim() || "produk utama",
    audience: brand.audience.trim() || "target audiens",
    painPoint: brand.painPoint.trim() || "keresahan audiens",
    brandTone: brand.brandTone.trim() || "edukatif, hangat, dan jelas",
    contentGoal: brand.contentGoal.trim() || "membangun awareness, trust, dan konversi",
    brandDna: blueprintPlainText.value || state.lastBlueprintResult.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  };
}

function setBrandContext(context: Partial<BrandContext> = {}) {
  Object.assign(brand, {
    brandName: context.brandName || "",
    mainOffer: context.mainOffer || "",
    audience: context.audience || "",
    painPoint: context.painPoint || "",
    brandTone: context.brandTone || "",
    contentGoal: context.contentGoal || "",
  });
}

async function askAI({ topic, instruction, format }: AskAIPayload): Promise<string> {
  const result = await generateContent({ topic, instruction, format, context: getBrandContext() });
  recordGeneration({ type: "Generate AI", input: topic || instruction, result });
  return result.text;
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shortText(value: unknown, limit = 700): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function scriptSettingsPrompt(): string {
  return `Jenis konten: ${scriptSettings.type}\nDurasi target: ${scriptSettings.duration} detik\nPlatform: ${scriptSettings.platform}`;
}

function recordGeneration({ type, input, result, skipUsage = false }: { type: string; input: string; result: AiResult; skipUsage?: boolean }) {
  if (result.usage?.day && result.usage.bucket) {
    state.usage[result.usage.day] = result.usage.bucket;
  } else if (!skipUsage) {
    const day = todayKey();
    const bucket = state.usage[day] || { total: 0, generate: 0, transcribe: 0 };
    bucket.total = Number(bucket.total || 0) + 1;
    if (/transkripsi/i.test(type)) bucket.transcribe = Number(bucket.transcribe || 0) + 1;
    else bucket.generate = Number(bucket.generate || 0) + 1;
    state.usage[day] = bucket;
  }

  state.history.unshift({
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    input: shortText(input, 900),
    output: shortText(result.text, 4000),
    provider: result.provider || "-",
    model: result.model || "-",
    brand: getBrandContext().brandName,
    createdAt: new Date().toISOString(),
  });
  state.history = state.history.slice(0, 100);
  storage.write("creatorHistory", state.history);
  storage.write("creatorUsage", state.usage);
  saveWorkspaceSoon();
}

function friendlyAIError(message: unknown): string {
  const text = String(message || "");
  if (/quota|rate limit|exceeded|Too Many Requests|429/i.test(text)) return "Limit 9router sedang habis untuk model ini. Tunggu beberapa saat atau cek paket/provider.";
  if (/API key not valid|API_KEY_INVALID|invalid api key/i.test(text)) return "9router API key belum valid. Cek NINE_ROUTER_API_KEY di file .env, lalu restart server.";
  if (/NINE_ROUTER_API_KEY belum diset/i.test(text)) return "NINE_ROUTER_API_KEY belum diset di file .env. Isi key 9router dulu, lalu restart server.";
  if (/fetch|ECONNREFUSED|Server AI lokal/i.test(text)) return "Server AI lokal belum aktif. Jalankan start-ai-server.bat atau node server.js, lalu reload halaman.";
  if (/API AI cloud|API AI gagal|server/i.test(text)) return "API AI cloud gagal merespons. Coba ulangi sekali lagi. Kalau masih gagal, cek Environment Variables dan Function Logs di Vercel.";
  return text;
}

function partLabel(part: ScriptPart): string {
  return partLabels[part] || part;
}

function draftFromParts(parts: Partial<Record<ScriptPart, string>>): string {
  return Object.entries(partLabels)
    .map(([key, label]) => `${label}\n${parts[key as ScriptPart] ? scriptLine(parts[key as ScriptPart]) : "-"}`)
    .join("\n\n");
}

function parseFullScript(text: string): Record<ScriptPart, string> {
  const sections: Record<ScriptPart, string> = { hook: "", foreshadow: "", body: "", cta: "" };
  const normalized = String(text || "").replace(/\r/g, "").trim();
  const patterns = {
    hook: /(?:^|\n)\s*(?:HOOK|1\.\s*HOOK)\s*[:\-]?\s*\n?([\s\S]*?)(?=\n\s*(?:FORESHADOW|2\.\s*FORESHADOW|ISI|BODY|3\.\s*(?:ISI|BODY)|CTA|4\.\s*CTA)\s*[:\-]?|\s*$)/i,
    foreshadow: /(?:^|\n)\s*(?:FORESHADOW|2\.\s*FORESHADOW)\s*[:\-]?\s*\n?([\s\S]*?)(?=\n\s*(?:ISI|BODY|3\.\s*(?:ISI|BODY)|CTA|4\.\s*CTA)\s*[:\-]?|\s*$)/i,
    body: /(?:^|\n)\s*(?:ISI|BODY|3\.\s*(?:ISI|BODY))\s*[:\-]?\s*\n?([\s\S]*?)(?=\n\s*(?:CTA|4\.\s*CTA)\s*[:\-]?|\s*$)/i,
    cta: /(?:^|\n)\s*(?:CTA|4\.\s*CTA)\s*[:\-]?\s*\n?([\s\S]*?)\s*$/i,
  };
  for (const [key, pattern] of Object.entries(patterns) as [ScriptPart, RegExp][]) {
    const match = normalized.match(pattern);
    sections[key] = match ? match[1].trim() : "";
  }
  if (!sections.hook && !sections.foreshadow && !sections.body && !sections.cta) sections.body = normalized;
  return sections;
}

async function copyText(text: string) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    showToast("Tidak ada teks untuk disalin.");
    return;
  }
  try {
    await navigator.clipboard.writeText(cleanText);
    showToast("Teks disalin.");
  } catch {
    showToast("Gagal menyalin. Blok teks lalu tekan Ctrl+C.");
  }
}

function fillBlueprintSample() {
  state.activeBlueprintId = null;
  state.blueprintCreatesNew = true;
  setBrandContext({
    brandName: "Sedjati Eco Farm",
    mainOffer: "Domba Garut sehat, edukasi ternak, dan pendampingan peternak.",
    audience: "Peternak pemula, calon pembeli domba, dan orang yang ingin mulai usaha ternak.",
    painPoint: "Takut salah beli bibit, bingung pakan, kandang kurang ideal, dan ragu hasil ternak tidak berkembang.",
    brandTone: "Santai, edukatif, jujur, humoris, dan berbasis pengalaman lapangan.",
    contentGoal: "Membangun trust, edukasi harian, meningkatkan konsultasi, dan mengarahkan calon pembeli ke keputusan yang tepat.",
  });
}

async function generateBlueprint() {
  state.blueprintCreatesNew = !state.activeBlueprintId;
  loading.blueprint = true;
  blueprintResult.value = "<h2>AI sedang menyusun Master Blueprint...</h2><p>Membaca assessment dan merumuskan arah konten.</p>";
  try {
    const text = await askAI({
      topic: JSON.stringify(getBrandContext(), null, 2),
      instruction: "Buat Master Blueprint / Brand DNA untuk kreator ini. Jelaskan positioning, content mission, target market insight, pilar konten, tone of voice, jenis konten yang harus sering dibuat, dan aturan eksekusi agar konten tidak random.",
      format: "Format dengan heading pendek: IDENTITAS, TARGET MARKET, INSIGHT AUDIENS, CONTENT MISSION, PILAR KONTEN, TONE OF VOICE, AWARENESS/CONSIDERATION/CONVERSION STRATEGY, ATURAN EKSEKUSI. Gunakan HTML sederhana: <h2>, <p>, <strong>, <br>.",
    });
    blueprintResult.value = text;
    state.lastBlueprintResult = text;
  } catch (error) {
    const errorHtml = `<h2>AI belum tersambung</h2><p>${friendlyAIError(error instanceof Error ? error.message : error)}</p>`;
    blueprintResult.value = errorHtml;
    state.lastBlueprintResult = errorHtml;
  } finally {
    loading.blueprint = false;
  }
}

function blueprintTitle(context: BrandContext): string {
  const brandName = context.brandName || "Brand tanpa nama";
  const niche = context.mainOffer || context.contentGoal || "Niche belum diisi";
  return `${brandName} - ${niche}`.slice(0, 90);
}

function persistBlueprints() {
  storage.write("creatorBlueprints", state.blueprints);
  storage.write("activeBlueprintId", state.activeBlueprintId);
  saveWorkspaceSoon();
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
    result: state.lastBlueprintResult || blueprintResult.value,
    updatedAt: new Date().toISOString(),
  };
  const index = state.blueprints.findIndex((item) => item.id === id);
  if (index >= 0) state.blueprints[index] = profile;
  else state.blueprints.unshift(profile);
  state.activeBlueprintId = id;
  state.blueprintCreatesNew = false;
  persistBlueprints();
  showToast("Blueprint tersimpan dan aktif.");
}

function activateBlueprint(id: string) {
  const profile = state.blueprints.find((item) => item.id === id);
  if (!profile) return;
  state.activeBlueprintId = id;
  state.blueprintCreatesNew = false;
  setBrandContext(profile.context);
  state.lastBlueprintResult = profile.result || "";
  if (profile.result) blueprintResult.value = profile.result;
  state.scriptParts = {};
  state.funnelParts = {};
  persistBlueprints();
  showToast("Blueprint aktif dipakai generator.");
}

function deleteBlueprint(id: string) {
  state.blueprints = state.blueprints.filter((item) => item.id !== id);
  if (state.activeBlueprintId === id) state.activeBlueprintId = null;
  if (!state.activeBlueprintId) state.blueprintCreatesNew = true;
  persistBlueprints();
  showToast("Blueprint dihapus.");
}

async function submitIdea() {
  const topic = ideaInput.value.trim();
  if (!topic) return;
  chatMessages.value.push({ id: crypto.randomUUID(), role: "user", html: escapeHtml(topic) });
  const thinkingId = crypto.randomUUID();
  chatMessages.value.push({ id: thinkingId, role: "assistant", html: "AI sedang menyusun ide konten sesuai blueprint..." });
  ideaInput.value = "";
  await nextTick();
  scrollChat();
  try {
    const text = await askAI({
      topic,
      instruction: "Jawab sebagai content director. Berikan ide konten yang sesuai branding, target market, keresahan audiens, dan tujuan konten. Jangan jawab generik. Beri ide Awareness, Consideration, dan Conversion bila relevan.",
      format: "Format: BRIEF CEPAT, 5 IDE KONTEN BERNILAI, VALUE YANG DISAMPAIKAN, FORMAT EKSEKUSI, ARAH SCRIPT. Gunakan baris baru yang rapi.",
    });
    updateChatMessage(thinkingId, renderAIText(text));
  } catch (error) {
    updateChatMessage(thinkingId, friendlyAIError(error instanceof Error ? error.message : error));
  }
  await nextTick();
  scrollChat();
}

function updateChatMessage(id: string, html: string) {
  const message = chatMessages.value.find((item) => item.id === id);
  if (message) message.html = html;
}

function scrollChat() {
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
}

async function generateFullScript(target: "script" | "funnel") {
  const topic = target === "script" ? scriptTopic.value.trim() : state.funnelTopic.trim();
  if (!topic) {
    showToast("Isi atau pilih topik dulu.");
    return;
  }
  loading[target === "script" ? "scriptFull" : "funnelFull"] = true;
  try {
    const text = await askAI({
      topic: `${topic}\n\nSETTING SCRIPT\n${scriptSettingsPrompt()}`,
      instruction: "Buat satu draft script lengkap. Kamu berperan sebagai content director, copywriter, dan creator assistant. Script harus mengikuti blueprint brand aktif, target market, keresahan audiens, jenis konten, durasi target, platform, dan funnel bila topik memuat Awareness/Consideration/Conversion. Jangan memberi opsi, langsung buat draft terbaik.",
      format: "Format wajib persis dengan heading ini:\nHOOK\n...\n\nFORESHADOW\n...\n\nISI\n...\n\nCTA\n...\n\nSesuaikan panjang script dengan durasi target. Untuk Story buat lebih ringan dan direct. Untuk Carousel buat alur per slide. Untuk Feed buat caption/isi yang padat. Untuk Reels/TikTok/Shorts buat ritme video pendek. Gunakan Bahasa Indonesia yang natural, relate, bernilai, dan siap dipakai. Jangan tambahkan catatan di luar empat heading itu.",
    });
    const parsed = parseFullScript(text);
    const parts = target === "script" ? state.scriptParts : state.funnelParts;
    Object.assign(parts, {
      hook: parsed.hook || "-",
      foreshadow: parsed.foreshadow || "-",
      body: parsed.body || "-",
      cta: parsed.cta || "-",
    });
    showToast("Full script berhasil dibuat.");
  } catch (error) {
    showToast(friendlyAIError(error instanceof Error ? error.message : error));
  } finally {
    loading[target === "script" ? "scriptFull" : "funnelFull"] = false;
  }
}

async function generateOptions(part: ScriptPart, target: "script" | "funnel") {
  const topic = target === "script" ? scriptTopic.value.trim() : state.funnelTopic.trim();
  if (!topic) {
    showToast(target === "script" ? "Isi topik dulu." : "Pilih ide funnel dulu.");
    return;
  }
  if (target === "script") {
    loading.scriptPart = part;
    scriptChoices.value = [];
    selectedScriptChoice.value = null;
  } else {
    loading.funnelPart = part;
    funnelChoices.value = [];
    selectedFunnelChoice.value = null;
  }
  try {
    const text = await askAI({
      topic: `${topic}\n\nSETTING SCRIPT\n${scriptSettingsPrompt()}`,
      instruction: generationInstruction(part),
      format: "WAJIB hanya keluarkan daftar opsi, tanpa kalimat pembuka. Pisahkan setiap opsi dengan judul OPSI 1:, OPSI 2:, OPSI 3: dan seterusnya.\n\nFormat per opsi:\nOPSI 1:\nTIPE/CTA: ...\nANGLE: ...\nNASKAH: \"...\"\nARAH VISUAL: ...\nVALUE/TUJUAN: ...\n\nBuat output dalam Bahasa Indonesia, spesifik untuk brand dan target market.",
    });
    const options = splitAIOptions(text).map((option) => ({ part, text: option }));
    if (target === "script") scriptChoices.value = options;
    else funnelChoices.value = options;
  } catch (error) {
    showToast(friendlyAIError(error instanceof Error ? error.message : error));
  } finally {
    loading.scriptPart = "";
    loading.funnelPart = "";
  }
}

function selectScriptChoice(option: ScriptChoice, index: number) {
  selectedScriptChoice.value = index;
  state.scriptParts[option.part] = option.text;
}

function selectFunnelChoice(option: ScriptChoice, index: number) {
  selectedFunnelChoice.value = index;
  state.funnelParts[option.part] = option.text;
}

async function transcribeVideo() {
  if (!videoFile.value) {
    showToast("Upload video/audio dulu.");
    return;
  }
  const maxBytes = isLocalApp ? 18 * 1024 * 1024 : 4 * 1024 * 1024;
  if (videoFile.value.size > maxBytes) {
    showToast(isLocalApp ? "File terlalu besar. Maksimal 18 MB." : "Di Vercel, pakai file maksimal 4 MB dulu.");
    return;
  }
  loading.transcribe = true;
  videoScript.value = "AI sedang mendengarkan percakapan dan mengubahnya menjadi text...";
  try {
    const result = await transcribeContent({
      fileName: videoFile.value.name,
      mimeType: videoFile.value.type || "application/octet-stream",
      dataBase64: await fileToBase64(videoFile.value),
      context: getBrandContext(),
    });
    videoScript.value = result.text;
    recordGeneration({ type: "Transkripsi", input: videoFile.value.name, result });
  } catch (error) {
    videoScript.value = friendlyAIError(error instanceof Error ? error.message : error);
  } finally {
    loading.transcribe = false;
  }
}

function setVideoFile(event: Event) {
  videoFile.value = (event.target as HTMLInputElement | null)?.files?.[0] || null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Gagal membaca file video/audio."));
    reader.readAsDataURL(file);
  });
}

async function remixScript() {
  const topic = remixTopic.value.trim();
  if (!topic) {
    showToast("Isi topik remix dulu.");
    return;
  }
  loading.remix = true;
  remixResult.value = "AI sedang meremix struktur referensi menjadi script baru...";
  try {
    remixResult.value = await askAI({
      topic: `TOPIK BARU: ${topic}\n\nTRANSKRIP REFERENSI:\n${videoScript.value}`,
      instruction: "Remix transkrip video referensi menjadi script baru sesuai topik baru, brand, target market, dan keresahan audiens. Jangan plagiat. Ambil pola komunikasi, ritme, hook, dan alur persuasi, bukan kata-kata mentahnya.",
      format: "Format script final: HOOK, FORESHADOW, ISI, CTA, ARAH VISUAL, CATATAN ADAPTASI. Buat siap dipakai untuk video pendek.",
    });
  } catch (error) {
    remixResult.value = friendlyAIError(error instanceof Error ? error.message : error);
  } finally {
    loading.remix = false;
  }
}

async function renderFunnelIdeas(type: FunnelStage) {
  state.currentFunnel = type;
  state.funnelTopic = "";
  state.funnelParts = {};
  funnelChoices.value = [];
  funnelIdeas.value = [];
  funnelError.value = "";
  loading.funnelIdeas = true;
  const meta = funnelMeta[type];
  try {
    const text = await askAI({
      topic: `${meta.name} - ${meta.job}`,
      instruction: `Buat 5 ide konten untuk tahap ${meta.name}. Fungsi tahap ini: ${meta.intent}. Setiap ide harus sesuai dengan blueprint brand, punya angle, value yang disampaikan, format eksekusi, dan janji ke audiens.`,
      format: "Format wajib:\nOPSI 1:\nFUNNEL: AWARENESS/CONSIDERATION/CONVERSION\nANGLE: ...\nIDE: ...\nVALUE: ...\nFORMAT: ...\nJANJI KE AUDIENS: ...\n\nBuat 5 opsi. Jangan buat script dulu.",
    });
    funnelIdeas.value = splitAIOptions(text);
  } catch (error) {
    funnelError.value = friendlyAIError(error instanceof Error ? error.message : error);
  } finally {
    loading.funnelIdeas = false;
  }
}

function selectFunnelIdea(idea: string) {
  state.funnelTopic = idea;
  state.funnelParts = {};
  funnelChoices.value = [];
  selectedFunnelChoice.value = null;
}

function moveMonth(delta: number) {
  state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + delta, 1);
}

function openPlanEditor(key: string) {
  state.selectedDate = key;
  planTitle.value = state.plans[key]?.title || "";
  planScript.value = state.plans[key]?.script || "";
}

function savePlan() {
  if (!state.selectedDate) {
    showToast("Pilih tanggal dulu.");
    return;
  }
  state.plans[state.selectedDate] = {
    title: planTitle.value.trim() || "Konten tanpa judul",
    script: planScript.value.trim(),
  };
  storage.write("creatorPlans", state.plans);
  saveWorkspaceSoon();
  showToast("Plan tersimpan.");
}

function planRows(): PlanRow[] {
  return Object.entries(state.plans)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, plan]) => ({ date, title: plan.title || "", script: plan.script || "" }));
}

function csvEscape(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, content: string, type: string) {
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
  const csv = [header.map(csvEscape).join(","), ...rows.map((row) => [row.date, row.title, row.script].map(csvEscape).join(","))].join("\n");
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

let saveTimer: number | undefined;
function saveWorkspaceSoon() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveWorkspaceNow, 250);
}

async function saveWorkspaceNow() {
  if (!workspaceReady.value) return;
  try {
    await saveDb({
      workspaceId: getActiveWorkspaceId(),
      plans: state.plans,
      blueprints: state.blueprints,
      activeBlueprintId: state.activeBlueprintId,
      history: state.history,
      usage: state.usage,
    });
  } catch {
    workspaceReady.value = false;
  }
}

const workspaceReady = ref(false);

async function loadWorkspaceState() {
  const isLoggedIn = Boolean(auth.user);
  const localPlans = storage.read<Record<string, PlanItem>>("creatorPlans", "{}");
  const localBlueprints = storage.read<BlueprintProfile[]>("creatorBlueprints", "[]");
  const localActiveBlueprintId = storage.read<string | null>("activeBlueprintId", "null");
  const localHistory = storage.read<GenerationHistoryItem[]>("creatorHistory", "[]");
  const localUsage = storage.read<Record<string, UsageBucket>>("creatorUsage", "{}");
  state.plans = isLoggedIn ? {} : localPlans;
  state.blueprints = isLoggedIn ? [] : localBlueprints;
  state.activeBlueprintId = isLoggedIn ? null : localActiveBlueprintId;
  state.history = isLoggedIn ? [] : localHistory;
  state.usage = isLoggedIn ? {} : localUsage;
  state.lastBlueprintResult = "";

  try {
    const data = await loadDb(getActiveWorkspaceId());
    workspaceReady.value = true;
    const backendHasData = Object.keys(data.plans || {}).length || (data.blueprints || []).length || (data.history || []).length || Object.keys(data.usage || {}).length;
    if (backendHasData) {
      state.plans = data.plans || {};
      state.blueprints = data.blueprints || [];
      state.activeBlueprintId = data.activeBlueprintId || null;
      state.history = data.history || [];
      state.usage = data.usage || {};
    } else if (!isLoggedIn && (Object.keys(localPlans).length || localBlueprints.length || localHistory.length || Object.keys(localUsage).length)) {
      state.plans = localPlans;
      state.blueprints = localBlueprints;
      state.history = localHistory;
      state.usage = localUsage;
      saveWorkspaceNow();
    }
  } catch {
    workspaceReady.value = false;
  }

  state.scriptParts = {};
  state.funnelParts = {};
  state.funnelTopic = "";
  loadActiveBlueprint();
}

function loadActiveBlueprint() {
  if (!state.activeBlueprintId) {
    blueprintResult.value = emptyBlueprintHtml;
    return;
  }
  const activeProfile = state.blueprints.find((profile) => profile.id === state.activeBlueprintId);
  if (!activeProfile) return;
  setBrandContext(activeProfile.context);
  state.lastBlueprintResult = activeProfile.result || "";
  if (activeProfile.result) blueprintResult.value = activeProfile.result;
}

function clearLocalSessionState() {
  ["creatorPlans", "creatorBlueprints", "activeBlueprintId", "creatorWorkspaceId", "creatorHistory", "creatorUsage"].forEach((key) => {
    try {
      storage.remove(key);
    } catch {
      // Ignore local cleanup errors.
    }
  });
  state.plans = {};
  state.blueprints = [];
  state.activeBlueprintId = null;
  state.history = [];
  state.usage = {};
  state.lastBlueprintResult = "";
  state.scriptParts = {};
  state.funnelParts = {};
  state.funnelTopic = "";
  state.selectedDate = null;
  setBrandContext({});
  scriptTopic.value = "";
  videoFile.value = null;
  videoScript.value = "";
  remixTopic.value = "";
  remixResult.value = "";
  planTitle.value = "";
  planScript.value = "";
  ideaInput.value = "";
  chatMessages.value = [{ id: crypto.randomUUID(), role: "assistant", html: "Halo. Tulis saja: &quot;Aku harus bikin konten apa?&quot; atau masukkan keresahan audiens yang mau kamu bahas." }];
  blueprintResult.value = emptyBlueprintHtml;
}

async function initAuth() {
  auth.client = null;
  auth.user = null;
  auth.ready = true;
}

async function loginWithGoogle() {
  showToast("Login Google dinonaktifkan. Data memakai SQL database.");
}

async function logoutGoogle() {
  auth.user = null;
  clearLocalSessionState();
  showToast("Session lokal dibersihkan.");
}

function showAuthRedirectError() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error_description") || params.get("error");
  if (!error) return;
  window.history.replaceState({}, document.title, window.location.pathname);
  showToast(`Login Google gagal: ${decodeURIComponent(error).slice(0, 140)}`);
}

function goHome() {
  activeView.value = "blueprint";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onMounted(async () => {
  showAuthRedirectError();
  await initAuth();
  await renderFunnelIdeas("tofu");
  await loadWorkspaceState();
});

  return {
    activeFunnel,
    activePageTitle,
    activeView,
    accountEmail,
    accountName,
    activateBlueprint,
    auth,
    blueprintPlainText,
    blueprintResult,
    brand,
    calendarBlanks,
    calendarDays,
    chatBox,
    chatMessages,
    copyText,
    dayNames,
    deleteBlueprint,
    exportCalendarCsv,
    exportCalendarJson,
    fillBlueprintSample,
    funnelChoices,
    funnelDraft,
    funnelError,
    funnelIdeas,
    funnelMeta,
    generateBlueprint,
    generateFullScript,
    generateOptions,
    goHome,
    ideaInput,
    initAuth,
    loadWorkspaceState,
    loading,
    loginWithGoogle,
    logoutGoogle,
    monthLabel,
    moveMonth,
    navItems,
    openPlanEditor,
    partLabel,
    planScript,
    planTitle,
    remixResult,
    remixScript,
    remixTopic,
    renderAIText,
    renderFunnelIdeas,
    saveCurrentBlueprint,
    savePlan,
    scriptChoices,
    scriptDraft,
    scriptLine,
    scriptParts,
    scriptSettings,
    scriptTopic,
    selectFunnelChoice,
    selectFunnelIdea,
    selectScriptChoice,
    selectedDateTitle,
    selectedFunnelChoice,
    selectedScriptChoice,
    setVideoFile,
    showAuthRedirectError,
    state,
    submitIdea,
    toast,
    transcribeVideo,
    videoFile,
    videoScript,
    workspaceReady,
    workspaceStatus,
  };
}
