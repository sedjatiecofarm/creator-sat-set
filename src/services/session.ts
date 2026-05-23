const SESSION_TOKEN_KEY = "creatorPinSessionToken";

export function getSessionToken(): string {
  return localStorage.getItem(SESSION_TOKEN_KEY) || "";
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
