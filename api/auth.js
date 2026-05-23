const { parseBody, sendJson } = require("./_shared");
const { createPinToken, verifyPin, verifyPinToken } = require("./authService");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const body = await parseBody(req);
      if (!verifyPin(body.pin)) {
        sendJson(res, 401, { error: "PIN salah." });
        return;
      }
      sendJson(res, 200, { ok: true, token: createPinToken() });
      return;
    }

    if (req.method === "GET") {
      const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      sendJson(res, 200, { ok: verifyPinToken(token) });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Auth error." });
  }
};
