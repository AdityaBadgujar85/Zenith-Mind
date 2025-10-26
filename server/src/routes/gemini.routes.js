// server/src/routes/gemini.routes.js
import express from "express";
import axios from "axios";

const router = express.Router();

const GEMINI_API_VER = "v1beta";
const MODEL_CANDIDATES = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-flash-002",
  "gemini-pro",
];

const getGeminiKey = (override) =>
  String(override || process.env.GEMINI_API_KEY || "").trim();

/** Sanity-check endpoint */
router.get("/debug", (_req, res) => {
  const masked = (process.env.GEMINI_API_KEY || "").replace(/^(.{6}).+(.{4})$/, "$1…$2");
  res.json({
    ok: true,
    where: "gemini.routes.js",
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    keyMasked: masked || "(missing)",
  });
});

/** Main generate endpoint: POST /api/ai/gemini */
router.post("/gemini", async (req, res) => {
  try {
    const { prompt, model, apiKey } = req.body || {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ ok: false, error: "Missing or invalid 'prompt' string" });
    }

    const KEY = getGeminiKey(apiKey);
    if (!KEY) {
      return res.status(500).json({ ok: false, error: "No GEMINI_API_KEY configured on server" });
    }

    const candidates = model
      ? [String(model).trim(), ...MODEL_CANDIDATES.filter((m) => m !== model)]
      : MODEL_CANDIDATES.slice();

    for (const mdl of candidates) {
      const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VER}/models/${encodeURIComponent(
        mdl
      )}:generateContent?key=${encodeURIComponent(KEY)}`;

      const body = { contents: [{ role: "user", parts: [{ text: String(prompt) }] }] };

      const upstream = await axios.post(url, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
        validateStatus: () => true,
      });

      if (upstream.status >= 200 && upstream.status < 300) {
        const text =
          upstream.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          (upstream.data?.candidates?.[0]?.content?.parts || [])
            .map((p) => p?.text)
            .filter(Boolean)
            .join("\n");
        if (text) return res.json({ ok: true, model: mdl, text });
        // empty content -> try next model
        continue;
      }

      if (upstream.status === 400 || upstream.status === 404) {
        // bad/unknown model -> try next
        continue;
      }

      return res.status(upstream.status).json({
        ok: false,
        error: upstream.data?.error?.message || "Upstream error",
        upstreamStatus: upstream.status,
        triedModel: mdl,
      });
    }

    return res.status(502).json({ ok: false, error: "No Gemini model responded with content" });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error:
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        "Gemini request failed",
    });
  }
});

/** Legacy alias some clients used: /api/googlefit/api/ai/gemini */
router.post("/legacy/googlefit-gemini", async (req, res, next) => {
  // we just reuse the handler above by changing the path when mounting
  next();
});

export default router;
