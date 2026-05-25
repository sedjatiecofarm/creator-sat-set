const { defaultDb, parseBody, readSupabaseDb, sendJson, writeSupabaseDb } = require("./_shared");

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

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const requestUrl = new URL(req.url || "/api/db", "https://creator-sat-set.vercel.app");
      sendJson(res, 200, await readSupabaseDb(requestUrl.searchParams.get("workspaceId")));
      return;
    }

    if (req.method === "POST") {
      const body = await parseBody(req);
      const current = await readSupabaseDb(body.workspaceId);
      await writeSupabaseDb({
        plans: body.plans || {},
        blueprints: body.blueprints || [],
        activeBlueprintId: body.activeBlueprintId ?? null,
        history: mergeHistory(current.history, body.history),
        usage: mergeUsage(current.usage, body.usage),
        lastProvider: body.lastProvider || current.lastProvider || "",
        lastModel: body.lastModel || current.lastModel || "",
        lastGeneratedAt: body.lastGeneratedAt || current.lastGeneratedAt || null,
        lastUserEmail: body.lastUserEmail || current.lastUserEmail || "",
      }, body.workspaceId);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    if (req.method === "GET") {
      sendJson(res, 200, defaultDb());
      return;
    }
    sendJson(res, 500, { error: error.message || "Terjadi error di API database." });
  }
};
