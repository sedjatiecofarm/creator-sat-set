const provider = (process.env.AI_PROVIDER || "9router").toLowerCase();
const nineRouterApiKey = process.env.NINE_ROUTER_API_KEY || process.env.ROUTER9_API_KEY || process.env.AI_API_KEY || "";
const nineRouterModel = process.env.NINE_ROUTER_MODEL || "content-ai";
const nineRouterEndpoint = (process.env.NINE_ROUTER_ENDPOINT || "https://9router.crsdigi.tech/v1").replace(/\/+$/, "");

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
  return "Kamu adalah AI content director, copywriter, dan content creator assistant berbahasa Indonesia. Output harus praktis, spesifik, relate, punya value, dan siap dipakai kreator. Jangan memberi teori generik kecuali diminta.";
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
  const jsonText = extractFirstJsonObject(raw);
  if (!jsonText) return {};
  return JSON.parse(jsonText);
}

function extractFirstJsonObject(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }

  return "";
}

function extractChatText(data) {
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("9router tidak mengembalikan teks. Coba ulangi request.");
  return text;
}

module.exports = {
  buildPrompt,
  callWithFallback,
  parseBody,
  sendJson,
  transcribeWithNineRouter,
};
