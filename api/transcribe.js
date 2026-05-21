const { parseBody, sendJson, transcribeWithGemini } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await parseBody(req);
    const text = await transcribeWithGemini(body);
    sendJson(res, 200, { text, provider: "gemini" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Terjadi error saat transkripsi." });
  }
};
