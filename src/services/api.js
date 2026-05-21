const API_BASE = window.location.protocol === "file:" ? "http://localhost:8787" : "";

export const isLocalApp = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);

export async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request gagal. Status: ${response.status}`);
  return data;
}

export async function fetchConfig() {
  return requestJson("/api/config");
}

export async function loadDb(workspaceId) {
  return requestJson(`/api/db?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function saveDb(payload) {
  return requestJson("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function generateContent(payload) {
  try {
    const data = await requestJson("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return data.text;
  } catch (error) {
    if (/Failed to fetch|NetworkError/i.test(error.message)) {
      throw new Error(isLocalApp ? "Server AI lokal belum aktif." : "API AI cloud gagal dihubungi.");
    }
    throw error;
  }
}

export async function transcribeContent(payload) {
  try {
    const data = await requestJson("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return data.text;
  } catch (error) {
    if (/Failed to fetch|NetworkError/i.test(error.message)) {
      throw new Error(isLocalApp ? "Server AI lokal belum aktif." : "API AI cloud gagal dihubungi.");
    }
    throw error;
  }
}
