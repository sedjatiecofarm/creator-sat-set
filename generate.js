const { buildPrompt, callWithFallback, parseBody, sendJson } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await parseBody(req);
    const prompt = buildPrompt(body);
    const result = await callWithFallback(prompt);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Terjadi error di API generate." });
  }
};
