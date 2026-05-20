const { defaultDb, parseBody, readSupabaseDb, sendJson, writeSupabaseDb } = require("./_shared");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      sendJson(res, 200, await readSupabaseDb());
      return;
    }

    if (req.method === "POST") {
      const body = await parseBody(req);
      await writeSupabaseDb({
        plans: body.plans || {},
        blueprints: body.blueprints || [],
        activeBlueprintId: body.activeBlueprintId ?? null,
      });
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
