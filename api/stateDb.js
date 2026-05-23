const prisma = require("./prisma");

const defaultStateId = process.env.APP_STATE_ID || "creator-sat-set";

function defaultDb() {
  return {
    plans: {},
    blueprints: [],
    activeBlueprintId: null,
    updatedAt: null,
  };
}

function resolveStateId(workspaceId) {
  const cleanId = String(workspaceId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return cleanId || defaultStateId;
}

async function readDb(workspaceId) {
  const row = await prisma.appState.findUnique({
    where: { id: resolveStateId(workspaceId) },
  });

  return row?.data ? { ...defaultDb(), ...row.data } : defaultDb();
}

async function writeDb(data, workspaceId) {
  const payload = { ...defaultDb(), ...data, updatedAt: new Date().toISOString() };

  await prisma.appState.upsert({
    where: { id: resolveStateId(workspaceId) },
    create: {
      id: resolveStateId(workspaceId),
      data: payload,
    },
    update: {
      data: payload,
    },
  });
}

module.exports = {
  defaultDb,
  readDb,
  resolveStateId,
  writeDb,
};
