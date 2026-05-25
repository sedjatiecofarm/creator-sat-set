const { buildPrompt, callWithFallback, enforceDailyGenerateLimit, parseBody, recordServerGenerateUsage, sendJson } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await parseBody(req);
    const limitState = await enforceDailyGenerateLimit(body);
    const prompt = buildPrompt(body);
    const result = await callWithFallback(prompt);
    const usage = await recordServerGenerateUsage(limitState, result, body);
    sendJson(res, 200, { ...result, usage });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || "Terjadi error di API generate." });
  }
};
