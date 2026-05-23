import type { AiResult, GeneratePayload, SaveWorkspacePayload, TranscribePayload, WorkspaceState } from "../types";
import { authHeaders } from "./session";

const API_BASE = window.location.protocol === "file:" ? "http://localhost:8787" : "";

type ApiErrorPayload = { error?: string };
type GenerateResponse = AiResult;

export const isLocalApp = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);

export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (!response.ok) throw new Error(data.error || `Request gagal. Status: ${response.status}`);
  return data;
}

export async function loginWithPin(pin: string): Promise<{ ok: boolean; token: string }> {
  return requestJson<{ ok: boolean; token: string }>("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
}

export async function verifyPinSession(): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/api/auth");
}

export async function loadDb(workspaceId: string): Promise<WorkspaceState> {
  return requestJson<WorkspaceState>(`/api/db?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function saveDb(payload: SaveWorkspacePayload): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function generateContent(payload: GeneratePayload): Promise<AiResult> {
  try {
    const data = await requestJson<GenerateResponse>("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return data;
  } catch (error) {
    if (error instanceof Error && /Failed to fetch|NetworkError/i.test(error.message)) {
      throw new Error(isLocalApp ? "Server AI lokal belum aktif." : "API AI cloud gagal dihubungi.");
    }
    throw error;
  }
}

export async function transcribeContent(payload: TranscribePayload): Promise<AiResult> {
  try {
    const data = await requestJson<GenerateResponse>("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return data;
  } catch (error) {
    if (error instanceof Error && /Failed to fetch|NetworkError/i.test(error.message)) {
      throw new Error(isLocalApp ? "Server AI lokal belum aktif." : "API AI cloud gagal dihubungi.");
    }
    throw error;
  }
}
