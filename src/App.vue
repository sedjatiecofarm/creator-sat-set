<template>
  <div class="app-shell">
    <AppSidebar
      :account-email="accountEmail"
      :account-name="accountName"
      :active-view="activeView"
      :auth-ready="auth.ready"
      :has-user="Boolean(auth.user)"
      :nav-items="navItems"
      @home="goHome"
      @login="loginWithGoogle"
      @logout="logoutGoogle"
      @navigate="activeView = $event"
    />

    <main class="workspace">
      <header class="workspace-topbar">
        <label class="topbar-search" aria-label="Search">
          <input type="search" placeholder="Search..." />
          <span>⌕</span>
        </label>
        <div class="topbar-actions">
          <span class="status-pill">{{ workspaceStatus }}</span>
          <button class="icon-action" type="button" aria-label="Notifications">●</button>
          <button class="profile-chip" type="button" @click="goHome">YN</button>
        </div>
      </header>

    <section class="panel view" :class="{ active: activeView === 'blueprint' }" id="blueprint">
      <div class="section-head">
        <div>
          <p class="eyebrow">Assessment</p>
          <h1>Blueprint</h1>
          <p class="muted">Isi bagian ini dulu supaya AI mengenal siapa kamu, siapa targetmu, dan arah kontenmu.</p>
        </div>
        <button class="ghost-btn" type="button" @click="fillBlueprintSample">Isi Contoh</button>
      </div>

      <div class="blueprint-grid">
        <label>Kamu siapa / brand kamu<textarea v-model="brand.brandName" placeholder="Contoh: Sedjati Eco Farm, peternak Domba Garut yang edukatif dan humoris"></textarea></label>
        <label>Apa yang kamu tawarkan<textarea v-model="brand.mainOffer" placeholder="Contoh: bibit Domba Garut, fattening, domba qurban, edukasi ternak, pendampingan"></textarea></label>
        <label>Target market kamu<textarea v-model="brand.audience" placeholder="Siapa yang ingin kamu bantu? Pemula, calon pembeli, peternak, pebisnis, dll."></textarea></label>
        <label>Keresahan / masalah target market<textarea v-model="brand.painPoint" placeholder="Apa yang bikin mereka bingung, takut, salah paham, atau ragu?"></textarea></label>
        <label>Gaya komunikasi kamu<textarea v-model="brand.brandTone" placeholder="Contoh: santai, jujur, edukatif, humoris, tegas, membumi"></textarea></label>
        <label>Topik utama dan tujuan konten<textarea v-model="brand.contentGoal" placeholder="Topik apa yang mau sering dibahas? Tujuannya awareness, trust, edukasi, jualan, komunitas?"></textarea></label>
      </div>

      <button class="primary-btn" type="button" :disabled="loading.blueprint" @click="generateBlueprint">
        {{ loading.blueprint ? "AI sedang berpikir..." : "Generate Brand DNA" }}
      </button>

      <article class="result-card" id="blueprintResult">
        <button class="copy-btn" type="button" @click="copyText(blueprintPlainText)">Salin</button>
        <div v-html="blueprintResult"></div>
      </article>

      <section class="saved-blueprints">
        <div class="section-head slim">
          <div>
            <h2>Brand / Niche Tersimpan</h2>
            <p class="muted">Simpan blueprint, lalu pilih lagi kapan pun agar generator mengikuti brand tersebut.</p>
          </div>
          <button class="primary-btn" type="button" @click="saveCurrentBlueprint">Simpan Blueprint</button>
        </div>
        <div class="saved-list">
          <p v-if="!state.blueprints.length" class="muted">Belum ada blueprint tersimpan. Generate Brand DNA dulu, lalu klik Simpan Blueprint.</p>
          <div
            v-for="profile in state.blueprints"
            :key="profile.id"
            class="saved-profile"
            :class="{ active: profile.id === state.activeBlueprintId }"
          >
            <div>
              <strong>{{ profile.title }}</strong>
              <span>{{ profile.context.audience || "Target market belum diisi" }}</span>
            </div>
            <button class="tiny-btn" type="button" @click="activateBlueprint(profile.id)">
              {{ profile.id === state.activeBlueprintId ? "Aktif" : "Pakai" }}
            </button>
            <button class="tiny-btn danger" type="button" @click="deleteBlueprint(profile.id)">Hapus</button>
          </div>
        </div>
      </section>
    </section>

    <section class="panel view" :class="{ active: activeView === 'ideation' }" id="ideation">
      <div class="section-head">
        <div>
          <p class="eyebrow">Cari ide konten</p>
          <h1>Cari Ide</h1>
          <p class="muted">Tanyakan ide, angle, atau referensi konten. Output akan mengikuti blueprint kamu.</p>
        </div>
      </div>
      <div class="chat-box" ref="chatBox">
        <div v-for="message in chatMessages" :key="message.id" class="bubble" :class="message.role" v-html="message.html"></div>
      </div>
      <form class="chat-form" @submit.prevent="submitIdea">
        <input v-model="ideaInput" type="text" placeholder="Contoh: aku harus bikin konten apa untuk calon pembeli domba qurban?" />
        <button class="primary-btn" type="submit">Kirim</button>
      </form>
    </section>

    <section class="panel view" :class="{ active: activeView === 'script' }" id="script">
      <div class="section-head">
        <div>
          <p class="eyebrow">Hook - Foreshadow - Isi - CTA</p>
          <h1>Bikin Script</h1>
          <p class="muted">Masukkan ide konten, generate tiap bagian, pilih yang paling kuat, lalu sesuaikan dengan gaya kamu.</p>
        </div>
      </div>
      <label class="wide-input">Ide konten / topik yang mau dibuat script<textarea v-model="scriptTopic" placeholder="Contoh: kenapa domba Garut yang terlihat besar belum tentu paling aman dipilih"></textarea></label>
      <div class="action-row">
        <button class="primary-btn" type="button" :disabled="loading.scriptFull" @click="generateFullScript('script')">Full Script</button>
        <button v-for="part in scriptParts" :key="part" class="soft-btn" type="button" :disabled="loading.scriptPart === part" @click="generateOptions(part, 'script')">{{ partLabel(part) }}</button>
      </div>
      <div class="choice-grid">
        <div v-for="(option, index) in scriptChoices" :key="index" class="choice" :class="{ selected: selectedScriptChoice === index }">
          <div class="choice-text" v-html="renderAIText(option.text)"></div>
          <div class="choice-actions">
            <button class="choice-action primary" type="button" @click="selectScriptChoice(option, index)">Pilih</button>
            <button class="choice-action" type="button" @click="copyText(scriptLine(option.text))">Salin</button>
          </div>
        </div>
      </div>
      <article class="draft-card">
        <button class="copy-btn" type="button" @click="copyText(scriptDraft)">Salin</button>
        <h2>Draft Script Terkini</h2>
        <pre>{{ scriptDraft }}</pre>
      </article>
    </section>

    <section class="panel view" :class="{ active: activeView === 'video' }" id="video">
      <div class="section-head">
        <div>
          <p class="eyebrow">Ambil referensi, buat versi baru</p>
          <h1>Video ke Text</h1>
          <p class="muted">Upload video/audio referensi untuk mengambil percakapan menjadi teks, lalu remix ke script baru sesuai niche kamu.</p>
          <p class="muted">Maksimal file video/audio: 4 MB.</p>
        </div>
      </div>
      <input class="file-input" type="file" accept="video/*,audio/*" @change="setVideoFile" />
      <button class="primary-btn" type="button" :disabled="loading.transcribe" @click="transcribeVideo">Ambil Percakapan ke Text</button>
      <textarea class="large-textarea" v-model="videoScript" placeholder="Transkrip percakapan/caption dari video akan muncul di sini."></textarea>
      <button class="ghost-btn copy-inline" type="button" @click="copyText(videoScript)">Salin Text</button>
      <input class="text-input" v-model="remixTopic" type="text" placeholder="Topik baru untuk remix script..." />
      <button class="primary-btn" type="button" :disabled="loading.remix" @click="remixScript">Remix Jadi Script Baru</button>
      <textarea class="large-textarea" v-model="remixResult" placeholder="Hasil remix akan muncul di sini."></textarea>
      <button class="ghost-btn copy-inline" type="button" @click="copyText(remixResult)">Salin Remix</button>
    </section>

    <section class="view" :class="{ active: activeView === 'funnel' }" id="funnel">
      <div class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Awareness, Consideration, Conversion</p>
            <h1>Konten Express</h1>
            <p class="muted">Pilih tahap funnel: Awareness untuk tarik perhatian, Consideration untuk bangun trust, Conversion untuk jualan.</p>
          </div>
        </div>
        <div class="funnel-tabs">
          <button v-for="(meta, key) in funnelMeta" :key="key" type="button" :class="{ active: state.currentFunnel === key }" @click="renderFunnelIdeas(key)">
            <strong>{{ meta.name }}</strong><span>{{ meta.job }}</span>
          </button>
        </div>
        <div class="idea-list">
          <div class="funnel-note">{{ activeFunnel.name }}: {{ activeFunnel.job }}. Tujuannya {{ activeFunnel.intent }}.</div>
          <div v-if="loading.funnelIdeas" class="ai-loading">AI sedang membuat 5 ide konten sesuai funnel dan blueprint...</div>
          <div v-if="funnelError" class="ai-error">{{ funnelError }}</div>
          <button
            v-for="(idea, index) in funnelIdeas"
            :key="index"
            class="idea-card"
            :class="{ selected: state.funnelTopic === idea }"
            type="button"
            @click="selectFunnelIdea(idea)"
          >
            {{ idea.match(/^OPSI|\d+\./i) ? idea : `OPSI ${index + 1}:\n${idea}` }}
          </button>
        </div>
      </div>
      <div class="panel compact-builder">
        <div class="section-head slim">
          <div>
            <h2>Bikin Script</h2>
            <p class="muted">{{ state.funnelTopic ? `Topik: ${state.funnelTopic}` : "Pilih salah satu ide. Setelah itu pilih Hook, Foreshadow, Isi, dan CTA." }}</p>
          </div>
        </div>
        <div class="action-row">
          <button class="primary-btn" type="button" :disabled="loading.funnelFull" @click="generateFullScript('funnel')">Full Script</button>
          <button v-for="part in scriptParts" :key="part" class="soft-btn" type="button" :disabled="loading.funnelPart === part" @click="generateOptions(part, 'funnel')">{{ partLabel(part) }}</button>
        </div>
        <div class="choice-grid">
          <div v-for="(option, index) in funnelChoices" :key="index" class="choice" :class="{ selected: selectedFunnelChoice === index }">
            <div class="choice-text" v-html="renderAIText(option.text)"></div>
            <div class="choice-actions">
              <button class="choice-action primary" type="button" @click="selectFunnelChoice(option, index)">Pilih</button>
              <button class="choice-action" type="button" @click="copyText(scriptLine(option.text))">Salin</button>
            </div>
          </div>
        </div>
        <article class="draft-card">
          <button class="copy-btn" type="button" @click="copyText(funnelDraft)">Salin Script</button>
          <h2>Draft Script Terkini</h2>
          <pre>{{ funnelDraft }}</pre>
        </article>
      </div>
    </section>

    <section class="view" :class="{ active: activeView === 'plan' }" id="plan">
      <div class="panel">
        <div class="calendar-head">
          <div>
            <h1>Kalendar Konten</h1>
            <p class="muted">Tempel script final, tentukan tanggal posting, lalu simpan agar konsisten.</p>
          </div>
          <div class="calendar-actions">
            <div class="month-switcher">
              <button class="month-btn" type="button" @click="moveMonth(-1)">‹</button>
              <strong>{{ monthLabel }}</strong>
              <button class="month-btn" type="button" @click="moveMonth(1)">›</button>
            </div>
            <div class="export-actions">
              <button class="ghost-btn" type="button" @click="exportCalendarCsv">CSV</button>
              <button class="ghost-btn" type="button" @click="exportCalendarJson">JSON</button>
            </div>
          </div>
        </div>
        <div class="calendar">
          <div v-for="day in dayNames" :key="day" class="day-name">{{ day }}</div>
          <div v-for="blank in calendarBlanks" :key="`blank-${blank}`"></div>
          <button
            v-for="item in calendarDays"
            :key="item.key"
            class="day"
            :class="{ today: item.isToday, 'has-plan': Boolean(state.plans[item.key]) }"
            type="button"
            @click="openPlanEditor(item.key)"
          >
            <span>{{ item.day }}</span>
            <small v-if="state.plans[item.key]">{{ state.plans[item.key].title }}</small>
          </button>
        </div>
      </div>
      <div class="panel plan-editor" :class="{ active: Boolean(state.selectedDate) }">
        <h2>{{ selectedDateTitle }}</h2>
        <label>Ide konten<input class="text-input" v-model="planTitle" type="text" placeholder="Tulis ide konten kamu..." /></label>
        <label>Script<textarea class="large-textarea" v-model="planScript" placeholder="Tempel atau tulis script kamu di sini..."></textarea></label>
        <button class="primary-btn" type="button" @click="savePlan">Simpan Plan</button>
      </div>
    </section>
    </main>
  </div>

  <div class="toast" :class="{ show: toast }">{{ toast }}</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import AppSidebar from "./components/AppSidebar.vue";
import { emptyBlueprintHtml, funnelMeta, generationInstruction, monthNames, partLabels } from "./data/content";
import { generateContent, isLocalApp, loadDb, saveDb, transcribeContent } from "./services/api";
import type { AskAIPayload, BlueprintProfile, BrandContext, CalendarDay, ChatMessage, FunnelStage, NavItem, NavView, PlanItem, PlanRow, ScriptChoice, ScriptPart } from "./types";
import { storage } from "./utils/storage";
import { escapeHtml, renderAIText, scriptLine, splitAIOptions } from "./utils/text";

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
  calendarDate: new Date(2026, 4, 20),
  plans: storage.read<Record<string, PlanItem>>("creatorPlans", "{}"),
  blueprints: storage.read<BlueprintProfile[]>("creatorBlueprints", "[]"),
  activeBlueprintId: storage.read<string | null>("activeBlueprintId", "null"),
  lastBlueprintResult: "",
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
const calendarDays = computed(() => {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, key, isToday: year === 2026 && month === 4 && day === 20 };
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

function askAI({ topic, instruction, format }: AskAIPayload): Promise<string> {
  return generateContent({ topic, instruction, format, context: getBrandContext() });
}

function friendlyAIError(message: unknown): string {
  const text = String(message || "");
  if (/quota|rate limit|exceeded|Too Many Requests|429/i.test(text)) return "Limit gratis Gemini sedang habis untuk model ini. Tunggu beberapa saat sampai kuota reset, atau ganti model/provider.";
  if (/API key not valid|API_KEY_INVALID|invalid api key/i.test(text)) return "Gemini API key belum valid. Cek lagi GEMINI_API_KEY di file .env, lalu restart server.";
  if (/GEMINI_API_KEY belum diset/i.test(text)) return "GEMINI_API_KEY belum diset di file .env. Isi key Gemini dulu, lalu restart server.";
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
  } catch (error) {
    showToast("Gagal menyalin. Blok teks lalu tekan Ctrl+C.");
  }
}

function fillBlueprintSample() {
  state.activeBlueprintId = null;
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
  const id = state.activeBlueprintId || `bp-${Date.now()}`;
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
  persistBlueprints();
  showToast("Blueprint tersimpan dan aktif.");
}

function activateBlueprint(id: string) {
  const profile = state.blueprints.find((item) => item.id === id);
  if (!profile) return;
  state.activeBlueprintId = id;
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
      topic,
      instruction: "Buat satu draft script lengkap untuk video pendek. Kamu berperan sebagai content director, copywriter, dan creator assistant. Script harus mengikuti blueprint brand aktif, target market, keresahan audiens, dan funnel bila topik memuat Awareness/Consideration/Conversion. Jangan memberi opsi, langsung buat draft terbaik.",
      format: "Format wajib persis dengan heading ini:\nHOOK\n...\n\nFORESHADOW\n...\n\nISI\n...\n\nCTA\n...\n\nGunakan Bahasa Indonesia yang natural, relate, bernilai, dan siap dipakai. Jangan tambahkan catatan di luar empat heading itu.",
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
      topic,
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
    videoScript.value = await transcribeContent({
      fileName: videoFile.value.name,
      mimeType: videoFile.value.type || "application/octet-stream",
      dataBase64: await fileToBase64(videoFile.value),
      context: getBrandContext(),
    });
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
    });
  } catch (error) {
    workspaceReady.value = false;
  }
}

const workspaceReady = ref(false);

async function loadWorkspaceState() {
  const isLoggedIn = Boolean(auth.user);
  const localPlans = storage.read<Record<string, PlanItem>>("creatorPlans", "{}");
  const localBlueprints = storage.read<BlueprintProfile[]>("creatorBlueprints", "[]");
  const localActiveBlueprintId = storage.read<string | null>("activeBlueprintId", "null");
  state.plans = isLoggedIn ? {} : localPlans;
  state.blueprints = isLoggedIn ? [] : localBlueprints;
  state.activeBlueprintId = isLoggedIn ? null : localActiveBlueprintId;
  state.lastBlueprintResult = "";

  try {
    const data = await loadDb(getActiveWorkspaceId());
    workspaceReady.value = true;
    const backendHasData = Object.keys(data.plans || {}).length || (data.blueprints || []).length;
    if (backendHasData) {
      state.plans = data.plans || {};
      state.blueprints = data.blueprints || [];
      state.activeBlueprintId = data.activeBlueprintId || null;
    } else if (!isLoggedIn && (Object.keys(localPlans).length || localBlueprints.length)) {
      state.plans = localPlans;
      state.blueprints = localBlueprints;
      saveWorkspaceNow();
    }
  } catch (error) {
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
  ["creatorPlans", "creatorBlueprints", "activeBlueprintId", "creatorWorkspaceId"].forEach((key) => {
    try {
      storage.remove(key);
    } catch (error) {
      // Ignore local cleanup errors.
    }
  });
  state.plans = {};
  state.blueprints = [];
  state.activeBlueprintId = null;
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
</script>
