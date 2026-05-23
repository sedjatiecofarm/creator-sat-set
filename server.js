const http = require("http");
const fs = require("fs");
const path = require("path");
const authHandler = require("./api/auth");
const { verifyPinToken } = require("./api/authService");
const { defaultDb, readDb, writeDb } = require("./api/stateDb");

const root = __dirname;
const publicRoot = fs.existsSync(path.join(root, "dist")) ? path.join(root, "dist") : root;
loadEnvFile();

const port = Number(process.env.PORT || 8787);
const provider = (process.env.AI_PROVIDER || "9router").toLowerCase();
const nineRouterApiKey = process.env.NINE_ROUTER_API_KEY || process.env.ROUTER9_API_KEY || process.env.AI_API_KEY || "";
const nineRouterModel = process.env.NINE_ROUTER_MODEL || "content-ai";
const nineRouterEndpoint = (process.env.NINE_ROUTER_ENDPOINT || "https://9router.crsdigi.tech/v1").replace(/\/+$/, "");

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

  const requestUrl = new URL(req.url || "/", "http://localhost");

  if (requestUrl.pathname === "/api/auth") {
    await authHandler(req, res);
    return;
  }

  if (requestUrl.pathname.startsWith("/api/") && requestUrl.pathname !== "/api/config" && !isAuthorized(req)) {
    sendJson(res, 401, { error: "Login PIN diperlukan." });
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

  if (requestUrl.pathname === "/api/config" && req.method === "GET") {
    sendJson(res, 200, { authProvider: "pin" });
    return;
  }

  if (requestUrl.pathname === "/api/db" && req.method === "GET") {
    try {
      sendJson(res, 200, await readDb(requestUrl.searchParams.get("workspaceId")));
    } catch (error) {
      sendJson(res, 200, defaultDb());
    }
    return;
  }

  if (requestUrl.pathname === "/api/db" && req.method === "POST") {
    await handleSaveDb(req, res);
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

function isAuthorized(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return verifyPinToken(token);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
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
    }, workspaceId);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Gagal menyimpan database." });
  }
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
  return "Kamu adalah AI content director, copywriter, dan content creator assistant berbahasa Indonesia. Output harus praktis, spesifik, relate, punya value, dan siap dipakai kreator. Jangan memberi teori generik kecuali diminta.";
}

async function handleGenerate(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const prompt = buildPrompt(body);
    const result = await callWithFallback(prompt);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Terjadi error di server AI." });
  }
}

async function handleTranscribe(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const text = await transcribeWithNineRouter(body);
    sendJson(res, 200, { text, provider: "9router", model: nineRouterModel });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Terjadi error saat transkripsi." });
  }
}

async function callWithFallback(prompt) {
  if (provider !== "9router") {
    throw new Error("Provider lama sudah dinonaktifkan. Set AI_PROVIDER=9router.");
  }
  if (!nineRouterApiKey) throw new Error("NINE_ROUTER_API_KEY belum diset.");
  return { text: await callNineRouter(prompt), provider: "9router", model: nineRouterModel };
}

async function callNineRouter(prompt) {
  const response = await fetch(`${nineRouterEndpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${nineRouterApiKey}`,
    },
    body: JSON.stringify({
      model: nineRouterModel,
      messages: [
        { role: "system", content: systemInstruction() },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
    }),
  });

  const data = await parseNineRouterResponse(response);
  if (!response.ok) throw new Error(data.error?.message || data.message || "Gagal memanggil 9router API.");
  return extractChatText(data);
}

async function transcribeWithNineRouter() {
  throw new Error("Transkripsi video/audio belum didukung oleh provider 9router model content-ai.");
}

async function parseNineRouterResponse(response) {
  const raw = await response.text();
  const jsonText = raw.replace(/\ndata:\s*\[DONE\]\s*$/i, "").trim();
  if (!jsonText) return {};
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    const firstJson = jsonText.match(/\{[\s\S]*\}/)?.[0];
    return firstJson ? JSON.parse(firstJson) : {};
  }
}

function extractChatText(data) {
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("9router tidak mengembalikan teks. Coba ulangi request.");
  return text;
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const safePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(publicRoot, safePath));

  if (!filePath.startsWith(publicRoot)) {
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
