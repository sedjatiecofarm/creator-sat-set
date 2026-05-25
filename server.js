const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "creator-db.json");
loadEnvFile();

const port = Number(process.env.PORT || 8787);
const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const providerOrder = (process.env.AI_PROVIDER_ORDER || provider)
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const fallbackEnabled = process.env.AI_FALLBACK !== "false";
const openAIModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/generate" && req.method === "POST") {
    await handleGenerate(req, res);
    return;
  }

  if (req.url === "/api/transcribe" && req.method === "POST") {
    await handleTranscribe(req, res);
    return;
  }

  const requestUrl = new URL(req.url || "/", "http://localhost");

  if (requestUrl.pathname === "/api/config" && req.method === "GET") {
    sendJson(res, 200, {
      supabaseUrl,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "",
    });
    return;
  }

  if (requestUrl.pathname === "/api/db" && req.method === "GET") {
    sendJson(res, 200, await readDb(requestUrl.searchParams.get("workspaceId")));
    return;
  }

  if (requestUrl.pathname === "/api/db" && req.method === "POST") {
    await handleSaveDb(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/admin" && req.method === "POST") {
    await handleAdmin(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Creator Generator AI server running at http://localhost:${port}`);
});

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

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

async function readDb(workspaceId) {
  const cloudDb = await readSupabaseDb(workspaceId);
  if (cloudDb) return cloudDb;

  try {
    if (!fs.existsSync(dbPath)) return defaultDb();
    const stored = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    if (stored.workspaces) {
      return { ...defaultDb(), ...(stored.workspaces[resolveStateId(workspaceId)] || {}) };
    }
    return { ...defaultDb(), ...stored };
  } catch (error) {
    return defaultDb();
  }
}

async function writeDb(data, workspaceId) {
  const savedToSupabase = await writeSupabaseDb(data, workspaceId);
  if (savedToSupabase) return;

  fs.mkdirSync(dataDir, { recursive: true });
  let stored = { workspaces: {} };
  if (fs.existsSync(dbPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      stored = existing.workspaces ? existing : { workspaces: { [supabaseStateId]: existing } };
    } catch (error) {
      stored = { workspaces: {} };
    }
  }
  stored.workspaces[resolveStateId(workspaceId)] = { ...defaultDb(), ...data, updatedAt: new Date().toISOString() };
  fs.writeFileSync(dbPath, JSON.stringify(stored, null, 2));
}

function todayKey() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getRequester(body) {
  const user = body.user || {};
  const email = String(user.email || "").trim().toLowerCase();
  const id = String(user.id || "").trim();
  const workspaceId = String(body.workspaceId || (id ? `user-${id}` : "") || "").trim();
  return {
    email,
    workspaceId: workspaceId || supabaseStateId,
    isAdmin: email ? adminEmails.includes(email) : false,
  };
}

function requireLoggedInUser(body) {
  const requester = getRequester(body || {});
  if (!requester.email || !requester.workspaceId.startsWith("user-")) {
    const error = new Error("Login Google diperlukan untuk menggunakan AI.");
    error.statusCode = 401;
    throw error;
  }
  return requester;
}

async function enforceDailyGenerateLimit(body) {
  const requester = requireLoggedInUser(body || {});
  const day = todayKey();
  if (requester.isAdmin) return { skipped: true, day };

  const db = await readDb(requester.workspaceId);
  const bucket = db.usage?.[day] || { total: 0, generate: 0, transcribe: 0 };
  const used = Number(bucket.generate || 0);
  if (used >= dailyGenerateLimit) {
    const error = new Error(`Limit generate harian kamu sudah habis (${used}/${dailyGenerateLimit}). Coba lagi besok, atau gunakan akun admin.`);
    error.statusCode = 429;
    throw error;
  }

  return { skipped: false, day, workspaceId: requester.workspaceId, requester };
}

async function recordServerGenerateUsage(limitState, result = {}, body = {}) {
  if (!limitState) return null;
  if (limitState.skipped) return { day: limitState.day, limit: null, remaining: null, admin: true };

  const db = await readDb(limitState.workspaceId);
  const usage = db.usage || {};
  const bucket = usage[limitState.day] || { total: 0, generate: 0, transcribe: 0 };
  bucket.total = Number(bucket.total || 0) + 1;
  bucket.generate = Number(bucket.generate || 0) + 1;
  usage[limitState.day] = bucket;
  const createdAt = new Date().toISOString();
  const history = Array.isArray(db.history) ? db.history.slice(0, 100) : [];
  history.unshift({
    id: `server-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "Generate AI",
    input: String(body.topic || "").slice(0, 900),
    output: String(result.text || "").slice(0, 4000),
    provider: result.provider || "-",
    model: result.model || "-",
    brand: body.context?.brandName || "",
    userEmail: limitState.requester?.email || "",
    createdAt,
  });
  await writeDb(
    {
      ...db,
      usage,
      history: history.slice(0, 100),
      lastProvider: result.provider || db.lastProvider || "",
      lastModel: result.model || db.lastModel || "",
      lastGeneratedAt: createdAt,
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

function mergeUsage(current = {}, incoming = {}) {
  const merged = { ...current };
  for (const [day, bucket] of Object.entries(incoming || {})) {
    const existing = merged[day] || { total: 0, generate: 0, transcribe: 0 };
    merged[day] = {
      total: Math.max(Number(existing.total || 0), Number(bucket.total || 0)),
      generate: Math.max(Number(existing.generate || 0), Number(bucket.generate || 0)),
      transcribe: Math.max(Number(existing.transcribe || 0), Number(bucket.transcribe || 0)),
    };
  }
  return merged;
}

function mergeHistory(current = [], incoming = []) {
  const items = [...(Array.isArray(current) ? current : []), ...(Array.isArray(incoming) ? incoming : [])];
  const seen = new Set();
  return items
    .filter((item) => {
      const key = item.id || `${item.createdAt || ""}-${item.type || ""}-${item.input || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 100);
}

async function handleSaveDb(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const workspaceId = body.workspaceId;
    const current = await readDb(workspaceId);
    await writeDb({
      plans: body.plans || current.plans || {},
      blueprints: body.blueprints || current.blueprints || [],
      activeBlueprintId: body.activeBlueprintId ?? current.activeBlueprintId ?? null,
      history: mergeHistory(current.history, body.history),
      usage: mergeUsage(current.usage, body.usage),
      lastProvider: body.lastProvider || current.lastProvider || "",
      lastModel: body.lastModel || current.lastModel || "",
      lastGeneratedAt: body.lastGeneratedAt || current.lastGeneratedAt || null,
      lastUserEmail: body.lastUserEmail || current.lastUserEmail || "",
    }, workspaceId);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Gagal menyimpan database lokal." });
  }
}

function summarizeWorkspace(row) {
  const data = row.data || {};
  const day = todayKey();
  const today = data.usage?.[day] || { total: 0, generate: 0, transcribe: 0 };
  const activeBlueprint = (data.blueprints || []).find((item) => item.id === data.activeBlueprintId);
  const latestHistory = (data.history || [])[0];

  return {
    id: row.id,
    email: data.lastUserEmail || latestHistory?.userEmail || data.userEmail || "",
    activeBrand: activeBlueprint?.context?.brandName || latestHistory?.brand || "-",
    lastProvider: data.lastProvider || latestHistory?.provider || "-",
    lastModel: data.lastModel || latestHistory?.model || "-",
    lastGeneratedAt: data.lastGeneratedAt || latestHistory?.createdAt || null,
    generateToday: Number(today.generate || 0),
    transcribeToday: Number(today.transcribe || 0),
    totalToday: Number(today.total || 0),
    historyCount: (data.history || []).length,
    blueprintCount: (data.blueprints || []).length,
    updatedAt: data.updatedAt || null,
  };
}

async function handleAdmin(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const requesterEmail = String(body.email || "").trim().toLowerCase();
    if (!adminEmails.includes(requesterEmail)) {
      sendJson(res, 403, { error: "Dashboard admin hanya untuk akun admin." });
      return;
    }

    const rows = await readSupabaseWorkspaces();
    const users = rows
      .map(summarizeWorkspace)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    sendJson(res, 200, {
      today: todayKey(),
      users,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Gagal membaca dashboard admin." });
  }
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
  if (!hasSupabaseConfig()) return null;

  const url = `${supabaseUrl}/rest/v1/${supabaseTable}?id=eq.${encodeURIComponent(resolveStateId(workspaceId))}&select=data`;
  const response = await fetch(url, {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    console.warn(`Supabase read failed: ${response.status}`);
    return null;
  }

  const rows = await response.json();
  const data = rows?.[0]?.data;
  return data ? { ...defaultDb(), ...data } : defaultDb();
}

async function readSupabaseWorkspaces() {
  if (!hasSupabaseConfig()) return [];

  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseTable}?select=id,data`, {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    console.warn(`Supabase admin read failed: ${response.status}`);
    return [];
  }

  return response.json();
}

async function writeSupabaseDb(data, workspaceId) {
  if (!hasSupabaseConfig()) return false;

  const payload = [
    {
      id: resolveStateId(workspaceId),
      data: { ...defaultDb(), ...data, updatedAt: new Date().toISOString() },
    },
  ];

  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseTable}?on_conflict=id`, {
    method: "POST",
    headers: supabaseHeaders({
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.warn(`Supabase write failed: ${response.status}`);
    return false;
  }

  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 30_000_000) {
        reject(new Error("Request terlalu besar."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleGenerate(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const limitState = await enforceDailyGenerateLimit(body);
    const prompt = buildPrompt(body);
    const result = await callWithFallback(prompt);
    const usage = await recordServerGenerateUsage(limitState, result, body);
    sendJson(res, 200, { ...result, usage });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || "Terjadi error di server AI." });
  }
}

async function handleTranscribe(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    await enforceDailyGenerateLimit(body);
    const text = await transcribeWithGemini(body);
    sendJson(res, 200, { text, provider: "gemini" });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || "Terjadi error saat transkripsi." });
  }
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
  if (!response.ok) {
    throw new Error(data.error?.message || "Gagal memanggil OpenAI API.");
  }
  return extractOpenAIText(data);
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction() }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.8,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Gagal memanggil Gemini API.");
  }
  return extractGeminiText(data);
}

async function callOpenRouter(prompt) {
  const models = openRouterModels.length ? openRouterModels : await getOpenRouterFreeModels();
  if (!models.length) {
    throw new Error("Tidak ada model OpenRouter free yang tersedia. Isi OPENROUTER_MODELS di .env.");
  }

  const errors = [];
  for (const model of models) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:8787",
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
      if (!response.ok) {
        throw new Error(data.error?.message || `OpenRouter gagal untuk model ${model}.`);
      }
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
  if (!response.ok) {
    throw new Error(data.error?.message || "Gagal memanggil Groq API.");
  }
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

function systemInstruction() {
  return "Kamu adalah AI content director, copywriter, dan content creator assistant berbahasa Indonesia. Output harus praktis, spesifik, relate, punya value, dan siap dipakai kreator. Jika membuat HOOK, hook wajib sangat pendek untuk 3-5 detik pertama: 1 kalimat, maksimal 8-12 kata atau 90 karakter, bukan isi edukasi. Jangan memberi teori generik kecuali diminta.";
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

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const safePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(root, safePath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "text/plain; charset=utf-8" });
    res.end(data);
  });
}
