const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const providerOrder = (process.env.AI_PROVIDER_ORDER || provider)
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const fallbackEnabled = process.env.AI_FALLBACK !== "false";
const openAIModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseTable = process.env.SUPABASE_TABLE || "creator_app_state";
const supabaseStateId = process.env.SUPABASE_STATE_ID || "creator-sat-set";
const dailyGenerateLimit = Number(process.env.DAILY_GENERATE_LIMIT || 20);
const adminEmails = (process.env.ADMIN_EMAILS || "sedjatiecofarm@gmail.com")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const openRouterModels = (process.env.OPENROUTER_MODELS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function defaultDb() {
  return {
    plans: {},
    blueprints: [],
    activeBlueprintId: null,
    history: [],
    usage: {},
    lastProvider: "",
    lastModel: "",
    lastGeneratedAt: null,
    lastUserEmail: "",
    updatedAt: null,
  };
}

function todayKey() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getRequester(body) {
  const user = body.user || {};
  const email = normalizeEmail(user.email);
  const id = String(user.id || "").trim();
  const workspaceId = String(body.workspaceId || (id ? `user-${id}` : "") || "").trim();
  return {
    id,
    email,
    workspaceId,
    isAdmin: email ? adminEmails.includes(email) : false,
  };
}

function requireLoggedInUser(body) {
  const requester = getRequester(body || {});
  if (!requester.id || !requester.email) {
    const error = new Error("Login Google diperlukan untuk menggunakan AI.");
    error.statusCode = 401;
    throw error;
  }
  return requester;
}

function limitError(limit, used) {
  const error = new Error(`Limit generate harian kamu sudah habis (${used}/${limit}). Coba lagi besok, atau gunakan akun admin.`);
  error.statusCode = 429;
  return error;
}

async function enforceDailyGenerateLimit(body) {
  const requester = requireLoggedInUser(body || {});
  if (requester.isAdmin) return { requester, usage: null, day: todayKey(), skipped: true };

  const workspaceId = requester.workspaceId || resolveStateId(body?.workspaceId);
  const db = await readSupabaseDb(workspaceId);
  const day = todayKey();
  const bucket = db.usage?.[day] || { total: 0, generate: 0, transcribe: 0 };
  const used = Number(bucket.generate || 0);
  if (used >= dailyGenerateLimit) throw limitError(dailyGenerateLimit, used);
  return { requester, usage: db.usage || {}, day, workspaceId };
}

async function recordServerGenerateUsage(limitState, result = {}) {
  if (!limitState) return null;
  if (limitState.skipped) {
    return { day: limitState.day, limit: null, remaining: null, admin: true };
  }
  const db = await readSupabaseDb(limitState.workspaceId);
  const usage = db.usage || {};
  const bucket = usage[limitState.day] || { total: 0, generate: 0, transcribe: 0 };
  bucket.total = Number(bucket.total || 0) + 1;
  bucket.generate = Number(bucket.generate || 0) + 1;
  usage[limitState.day] = bucket;
  await writeSupabaseDb(
    {
      ...db,
      usage,
      lastProvider: result.provider || db.lastProvider || "",
      lastModel: result.model || db.lastModel || "",
      lastGeneratedAt: new Date().toISOString(),
      lastUserEmail: limitState.requester?.email || db.lastUserEmail || "",
    },
    limitState.workspaceId,
  );
  return {
    day: limitState.day,
    bucket,
    limit: dailyGenerateLimit,
    remaining: Math.max(dailyGenerateLimit - bucket.generate, 0),
    admin: false,
  };
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 30_000_000) {
        reject(new Error("Request terlalu besar."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(JSON.parse(body || "{}")));
    req.on("error", reject);
  });
}

function buildPrompt(body) {
  const context = body.context || {};
  return `
KONTEKS BRAND
- Brand/kreator: ${context.brandName || "belum diisi"}
- Penawaran/topik utama: ${context.mainOffer || "belum diisi"}
- Target market: ${context.audience || "belum diisi"}
- Keresahan audiens: ${context.painPoint || "belum diisi"}
- Gaya komunikasi: ${context.brandTone || "belum diisi"}
- Tujuan konten: ${context.contentGoal || "belum diisi"}
- Brand DNA aktif: ${context.brandDna || "belum ada brand DNA aktif"}

TUGAS
${body.instruction || ""}

INPUT PENGGUNA
${body.topic || ""}

FORMAT OUTPUT
${body.format || "Jawab ringkas, spesifik, dan siap dipakai."}
`.trim();
}

function systemInstruction() {
  return "Kamu adalah AI content director, copywriter, dan content creator assistant berbahasa Indonesia. Output harus praktis, spesifik, relate, punya value, dan siap dipakai kreator. Jika membuat HOOK, hook wajib sangat pendek untuk 3-5 detik pertama: 1 kalimat, maksimal 8-12 kata atau 90 karakter, bukan isi edukasi. Jangan memberi teori generik kecuali diminta.";
}

async function callWithFallback(prompt) {
  const attempts = [];
  const chain = buildProviderChain();

  for (const name of chain) {
    try {
      if (name === "gemini") {
        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY belum diset.");
        return { text: await callGemini(prompt), provider: "gemini", model: geminiModel };
      }
      if (name === "openrouter") {
        if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY belum diset.");
        const result = await callOpenRouter(prompt);
        return { text: result.text, provider: "openrouter", model: result.model };
      }
      if (name === "groq") {
        if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY belum diset.");
        return { text: await callGroq(prompt), provider: "groq", model: groqModel };
      }
      if (name === "openai") {
        if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY belum diset.");
        return { text: await callOpenAI(prompt), provider: "openai", model: openAIModel };
      }
      throw new Error(`Provider ${name} belum didukung.`);
    } catch (error) {
      attempts.push(`${name}: ${error.message}`);
    }
  }

  throw new Error(`Semua provider gagal. ${attempts.join(" | ")}`);
}

function buildProviderChain() {
  const base = providerOrder.length ? providerOrder : [provider || "gemini"];
  const fallback = fallbackEnabled ? ["gemini", "openrouter", "groq", "openai"] : [];
  return [...new Set([...base, ...fallback].filter(Boolean))];
}

async function callOpenAI(prompt) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: openAIModel,
      instructions: systemInstruction(),
      input: prompt,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gagal memanggil OpenAI API.");
  return extractOpenAIText(data);
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction() }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8 },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gagal memanggil Gemini API.");
  return extractGeminiText(data);
}

async function callOpenRouter(prompt) {
  const models = openRouterModels.length ? openRouterModels : await getOpenRouterFreeModels();
  if (!models.length) throw new Error("Tidak ada model OpenRouter free yang tersedia. Isi OPENROUTER_MODELS di env.");

  const errors = [];
  for (const model of models) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://creator-sat-set.vercel.app",
          "X-Title": "Creator Sat Set",
        },
        body: JSON.stringify({
          model,
          temperature: 0.8,
          messages: [
            { role: "system", content: systemInstruction() },
            { role: "user", content: prompt },
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || `OpenRouter gagal untuk model ${model}.`);
      return { text: extractChatText(data), model };
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
    }
  }
  throw new Error(`OpenRouter gagal di semua model. ${errors.join(" | ")}`);
}

async function getOpenRouterFreeModels() {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  const data = await response.json();
  if (!response.ok) return [];
  const preferred = ["qwen", "deepseek", "gemma"];
  return (data.data || [])
    .filter((model) => {
      const id = String(model.id || "").toLowerCase();
      const promptPrice = Number(model.pricing?.prompt || 1);
      const completionPrice = Number(model.pricing?.completion || 1);
      return preferred.some((name) => id.includes(name)) && promptPrice === 0 && completionPrice === 0;
    })
    .sort((a, b) => {
      const aId = String(a.id || "").toLowerCase();
      const bId = String(b.id || "").toLowerCase();
      return preferred.findIndex((name) => aId.includes(name)) - preferred.findIndex((name) => bId.includes(name));
    })
    .slice(0, 6)
    .map((model) => model.id);
}

async function callGroq(prompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: groqModel,
      temperature: 0.8,
      messages: [
        { role: "system", content: systemInstruction() },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gagal memanggil Groq API.");
  return extractChatText(data);
}

async function transcribeWithGemini(body) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY belum diset.");
  if (!body.dataBase64 || !body.mimeType) throw new Error("File video/audio belum valid.");

  const context = body.context || {};
  const prompt = `
TUGAS
Transkrip percakapan/caption dari file video atau audio ini ke Bahasa Indonesia sejelas mungkin.

KONTEKS BRAND UNTUK CATATAN REMIX
- Brand/kreator: ${context.brandName || "belum diisi"}
- Niche/penawaran: ${context.mainOffer || "belum diisi"}
- Target market: ${context.audience || "belum diisi"}
- Gaya komunikasi: ${context.brandTone || "belum diisi"}

ATURAN
- Fokus ambil kata-kata yang terdengar di audio.
- Kalau ada bagian tidak jelas, tulis [tidak jelas].
- Jangan mengarang percakapan yang tidak terdengar.
- Setelah transkrip, beri ringkasan pola konten agar bisa diremix.

FORMAT OUTPUT
TRANSKRIP
...

POLA KONTEN
- Hook:
- Alur isi:
- CTA:
- Catatan gaya:
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: body.mimeType,
                data: body.dataBase64,
              },
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2 },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Gagal mentranskrip file dengan Gemini.");
  return extractGeminiText(data);
}

function extractOpenAIText(data) {
  if (data.output_text) return data.output_text.trim();
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function extractGeminiText(data) {
  const chunks = [];
  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.text) chunks.push(part.text);
    }
  }
  const text = chunks.join("\n").trim();
  if (!text) throw new Error("Gemini tidak mengembalikan teks. Coba ulangi request.");
  return text;
}

function extractChatText(data) {
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Provider tidak mengembalikan teks. Coba ulangi request.");
  return text;
}

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseKey);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function resolveStateId(workspaceId) {
  const cleanId = String(workspaceId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return cleanId || supabaseStateId;
}

async function readSupabaseDb(workspaceId) {
  if (!hasSupabaseConfig()) return defaultDb();
  const url = `${supabaseUrl}/rest/v1/${supabaseTable}?id=eq.${encodeURIComponent(resolveStateId(workspaceId))}&select=data`;
  const response = await fetch(url, { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase read failed: ${response.status}`);
  const rows = await response.json();
  const data = rows?.[0]?.data;
  return data ? { ...defaultDb(), ...data } : defaultDb();
}

async function readSupabaseWorkspaces() {
  if (!hasSupabaseConfig()) throw new Error("Supabase env belum lengkap.");
  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseTable}?select=id,data`, {
    headers: supabaseHeaders(),
  });
  if (!response.ok) throw new Error(`Supabase admin read failed: ${response.status}`);
  return response.json();
}

async function writeSupabaseDb(data, workspaceId) {
  if (!hasSupabaseConfig()) throw new Error("Supabase env belum lengkap.");
  const payload = [
    {
      id: resolveStateId(workspaceId),
      data: { ...defaultDb(), ...data, updatedAt: new Date().toISOString() },
    },
  ];
  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseTable}?on_conflict=id`, {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Supabase write failed: ${response.status}`);
}

module.exports = {
  buildPrompt,
  callWithFallback,
  defaultDb,
  enforceDailyGenerateLimit,
  parseBody,
  recordServerGenerateUsage,
  readSupabaseDb,
  readSupabaseWorkspaces,
  sendJson,
  transcribeWithGemini,
  writeSupabaseDb,
};
