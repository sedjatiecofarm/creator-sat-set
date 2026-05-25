const { parseBody, sendJson } = require("./_shared");

const adminEmails = (process.env.ADMIN_EMAILS || "sedjatiecofarm@gmail.com")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseTable = process.env.SUPABASE_TABLE || "creator_app_state";
const freeDailyGenerateLimit = Number(process.env.FREE_DAILY_GENERATE_LIMIT || process.env.DAILY_GENERATE_LIMIT || 20);
const paidDailyGenerateLimit = Number(process.env.PAID_DAILY_GENERATE_LIMIT || 200);

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
  const dailyLimit = Number(data.dailyLimitOverride) > 0 ? Number(data.dailyLimitOverride) : data.packagePlan === "paid" ? paidDailyGenerateLimit : freeDailyGenerateLimit;

  return {
    id: row.id,
    email,
    packagePlan: data.packagePlan || "free",
    dailyLimitOverride: data.dailyLimitOverride ?? null,
    subscriptionStatus: data.subscriptionStatus || "active",
    dailyLimit,
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

async function verifiedRequesterEmail(req, body) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return String(body.email || "").trim().toLowerCase();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Sesi admin tidak valid. Login ulang.");
  return String(data.email || "").trim().toLowerCase();
}

async function readWorkspaceById(workspaceId) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseTable}?id=eq.${encodeURIComponent(workspaceId)}&select=data`, {
    headers: supabaseHeaders(),
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error("Gagal membaca data user.");
  return rows?.[0]?.data || {};
}

async function updateWorkspacePackage({ workspaceId, packagePlan, dailyLimitOverride }) {
  if (!workspaceId) throw new Error("Workspace user belum valid.");
  const cleanPlan = packagePlan === "paid" ? "paid" : "free";
  const limitValue = Number(dailyLimitOverride);
  const cleanLimit = Number.isFinite(limitValue) && limitValue > 0 ? Math.floor(limitValue) : null;
  const current = await readWorkspaceById(workspaceId);
  const payload = [
    {
      id: workspaceId,
      data: {
        ...current,
        packagePlan: cleanPlan,
        dailyLimitOverride: cleanLimit,
        subscriptionStatus: cleanPlan === "paid" ? "paid" : "free",
        updatedAt: new Date().toISOString(),
      },
    },
  ];
  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseTable}?on_conflict=id`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Gagal update paket user.");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await parseBody(req);
    const requesterEmail = await verifiedRequesterEmail(req, body);
    if (!adminEmails.includes(requesterEmail)) {
      sendJson(res, 403, { error: "Dashboard admin hanya untuk akun admin." });
      return;
    }

    if (body.action === "updatePackage") {
      await updateWorkspacePackage(body);
      sendJson(res, 200, { ok: true });
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
