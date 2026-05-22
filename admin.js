const { parseBody, readSupabaseWorkspaces, sendJson } = require("./_shared");

const adminEmails = (process.env.ADMIN_EMAILS || "sedjatiecofarm@gmail.com")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

function todayKey() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function summarizeWorkspace(row) {
  const data = row.data || {};
  const day = todayKey();
  const today = data.usage?.[day] || { total: 0, generate: 0, transcribe: 0 };
  const activeBlueprint = (data.blueprints || []).find((item) => item.id === data.activeBlueprintId);
  const latestHistory = (data.history || [])[0];
  const email = latestHistory?.userEmail || data.userEmail || "";

  return {
    id: row.id,
    email,
    activeBrand: activeBlueprint?.context?.brandName || latestHistory?.brand || "-",
    generateToday: Number(today.generate || 0),
    transcribeToday: Number(today.transcribe || 0),
    totalToday: Number(today.total || 0),
    historyCount: (data.history || []).length,
    blueprintCount: (data.blueprints || []).length,
    updatedAt: data.updatedAt || null,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await parseBody(req);
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
};
