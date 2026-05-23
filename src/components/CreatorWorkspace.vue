<template>
  <main class="workspace">
      <header class="workspace-topbar">
        <label class="topbar-search" aria-label="Search">
          <input type="search" placeholder="Search something here..." />
          <span>⌕</span>
        </label>
        <div class="topbar-actions">
          <span class="status-pill">{{ workspaceStatus }}</span>
          <button class="icon-action" type="button" aria-label="Notifications">●</button>
          <button class="profile-chip" type="button" @click="goHome">YN</button>
        </div>
      </header>

      <section class="metric-strip" aria-label="Ringkasan workspace">
        <article class="metric-card"><span>Blueprint</span><strong>{{ state.blueprints.length }}</strong><small>Brand tersimpan <b>+12%</b></small></article>
        <article class="metric-card"><span>Script Parts</span><strong>{{ Object.keys(state.scriptParts).length }}</strong><small>Draft aktif <b class="down">-4%</b></small></article>
        <article class="metric-card"><span>Content Plans</span><strong>{{ Object.keys(state.plans).length }}</strong><small>Kalendar <b>+18%</b></small></article>
        <article class="metric-card"><span>AI History</span><strong>{{ state.history.length }}</strong><small>Generate total <b>+32%</b></small></article>
      </section>

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
        <label>Jenis konten<select v-model="scriptSettings.type"><option>Reels</option><option>TikTok</option><option>Shorts</option><option>Story</option><option>Carousel</option><option>Feed</option></select></label>
        <label>Durasi target<select v-model="scriptSettings.duration"><option>15</option><option>30</option><option>45</option><option>60</option><option>90</option></select></label>
        <label>Platform<select v-model="scriptSettings.platform"><option>Instagram</option><option>TikTok</option><option>YouTube Shorts</option><option>Facebook</option><option>LinkedIn</option></select></label>
      </div>
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
</template>

<script setup lang="ts">
import { inject } from "vue";
import { creatorAppKey } from "../composables/creatorAppContext";

const app = inject(creatorAppKey);
if (!app) throw new Error("Creator app context belum tersedia.");

const {
  activeFunnel,
  activeView,
  blueprintPlainText,
  blueprintResult,
  brand,
  calendarBlanks,
  calendarDays,
  chatBox,
  chatMessages,
  copyText,
  activateBlueprint,
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
  loading,
  monthLabel,
  moveMonth,
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
  state,
  submitIdea,
  transcribeVideo,
  videoScript,
  workspaceStatus,
} = app;
</script>
