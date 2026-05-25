const { defaultDb, parseBody, readSupabaseDb, sendJson, writeSupabaseDb } = require("./_shared");

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
        history: Array.isArray(body.history) ? body.history.slice(0, 100) : [],
        usage: body.usage && Object.keys(body.usage).length ? body.usage : current.usage || {},
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
