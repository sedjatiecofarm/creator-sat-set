const { parseBody, sendJson } = require("./_shared");

const adminEmails = (process.env.ADMIN_EMAILS || "sedjatiecofarm@gmail.com")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseTable = process.env.SUPABASE_TABLE || "creator_app_state";

function todayKey() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function jakartaDay(value) {
  if (!value) return "";
  return new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function summarizeWorkspace(row) {
  const data = row.data || {};
  const day = todayKey();
  const today = data.usage?.[day] || { total: 0, generate: 0, transcribe: 0 };
  const history = Array.isArray(data.history) ? data.history : [];
  const activeBlueprint = (data.blueprints || []).find((item) => item.id === data.activeBlueprintId);
  const latestHistory = history[0];
  const generateFromHistory = history.filter((item) => !/transkripsi/i.test(item.type || "") && jakartaDay(item.createdAt) === day).length;
  const transcribeFromHistory = history.filter((item) => /transkripsi/i.test(item.type || "") && jakartaDay(item.createdAt) === day).length;
  const email = data.lastUserEmail || latestHistory?.userEmail || data.userEmail || "";

  return {
    id: row.id,
    email,
    activeBrand: activeBlueprint?.context?.brandName || latestHistory?.brand || "-",
    lastProvider: data.lastProvider || latestHistory?.provider || "-",
    lastModel: data.lastModel || latestHistory?.model || "-",
    lastGeneratedAt: data.lastGeneratedAt || latestHistory?.createdAt || null,
    generateToday: Math.max(Number(today.generate || 0), generateFromHistory),
    transcribeToday: Math.max(Number(today.transcribe || 0), transcribeFromHistory),
    totalToday: Number(today.total || 0),
    historyCount: history.length,
    blueprintCount: (data.blueprints || []).length,
    updatedAt: data.updatedAt || null,
  };
}

function supabaseHeaders() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };
}

async function readAdminWorkspaces() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env belum lengkap.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseTable}?select=id,data`, {
    headers: supabaseHeaders(),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase admin read failed: ${response.status} ${text.slice(0, 180)}`);
  }
  return JSON.parse(text || "[]");
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

    const rows = await readAdminWorkspaces();
    const users = rows
      .map(summarizeWorkspace)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const latestAi = users
      .filter((user) => user.lastProvider && user.lastProvider !== "-" && user.lastGeneratedAt)
      .sort((a, b) => String(b.lastGeneratedAt || "").localeCompare(String(a.lastGeneratedAt || "")))[0] || null;
    sendJson(res, 200, {
      today: todayKey(),
      latestAi: latestAi
        ? {
            provider: latestAi.lastProvider,
            model: latestAi.lastModel,
            generatedAt: latestAi.lastGeneratedAt,
            email: latestAi.email,
          }
        : null,
      users,
    });
  } catch (error) {
    sendJson(res, 500, {
      error: error.message || "Gagal membaca dashboard admin.",
      detail: "Cek SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, dan nama tabel creator_app_state di Vercel.",
    });
  }
};
