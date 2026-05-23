const crypto = require("crypto");

const sessionTtlMs = Number(process.env.PIN_SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);

function getLoginPin() {
  return String(process.env.LOGIN_PIN || process.env.APP_PIN || "123456");
}

function getSecret() {
  return String(process.env.PIN_SESSION_SECRET || process.env.LOGIN_PIN || process.env.APP_PIN || "creator-sat-set-secret");
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function createPinToken() {
  const expiresAt = Date.now() + sessionTtlMs;
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = `${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

function verifyPinToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return false;
  const [expiresAt, nonce, signature] = parts;
  const payload = `${expiresAt}.${nonce}`;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  return Number(expiresAt) > Date.now();
}

function verifyPin(pin) {
  const expected = getLoginPin();
  const actual = String(pin || "");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

module.exports = {
  createPinToken,
  verifyPin,
  verifyPinToken,
};
