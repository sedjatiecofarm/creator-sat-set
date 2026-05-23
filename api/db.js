const { parseBody, sendJson } = require("./_shared");
const { defaultDb, readDb, writeDb } = require("./stateDb");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const requestUrl = new URL(req.url || "/api/db", "https://creator-sat-set.vercel.app");
      sendJson(res, 200, await readDb(requestUrl.searchParams.get("workspaceId")));
      return;
    }

    if (req.method === "POST") {
      const body = await parseBody(req);
      const current = await readDb(body.workspaceId);
      await writeDb({
        plans: body.plans || current.plans || {},
        blueprints: body.blueprints || current.blueprints || [],
        activeBlueprintId: body.activeBlueprintId ?? current.activeBlueprintId ?? null,
        history: body.history || current.history || [],
        usage: body.usage || current.usage || {},
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
