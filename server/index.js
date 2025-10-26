// server/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import axios from "axios";

const app = express();

/* ---------------- Core middleware ---------------- */
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(cors({
  origin: (origin, cb) => {
    // Allow your frontend during dev and no-origin tools like curl/Postman
    if (!origin || origin === FRONTEND_URL || process.env.NODE_ENV !== "production") {
      return cb(null, true);
    }
    return cb(new Error(`Blocked by CORS: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

/* ------------ Request logger (helps debug 404s) ------------ */
app.use((req, _res, next) => {
  console.log("[REQ]", req.method, req.originalUrl);
  next();
});

/* ---------------- Health ---------------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ---------------- Gemini inline routes ---------------- */
const GEMINI_API_VER = "v1beta";
const MODEL_CANDIDATES = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-flash-002",
  "gemini-pro",
];

const getGeminiKey = (override) =>
  String(override || process.env.GEMINI_API_KEY || "").trim();

/** Quick debug endpoint to confirm server + key presence */
app.get("/api/ai/debug", (_req, res) => {
  const masked = (process.env.GEMINI_API_KEY || "")
    .replace(/^(.{6}).+(.{4})$/, "$1…$2");
  res.json({
    ok: true,
    where: "inline",
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    keyMasked: masked || "(missing)",
  });
});

async function handleGemini(req, res) {
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
      const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VER}/models/${encodeURIComponent(mdl)}:generateContent?key=${encodeURIComponent(KEY)}`;
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
        continue; // try next model if empty content
      }

      if (upstream.status === 400 || upstream.status === 404) {
        // model not found / bad request — try next candidate
        continue;
      }

      // hard fail for other statuses
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
}

/* Primary endpoint your React app should call */
app.post("/api/ai/gemini", handleGemini);

/* Legacy alias (if your client still posts here) */
app.post("/api/googlefit/api/ai/gemini", handleGemini);

/* ---------------- 404 last (must be last) ---------------- */
app.use((req, res) => res.status(404).json({
  message: "Not found",
  path: req.originalUrl,
}));

/* ---------------- Start ---------------- */
const PORT = Number(process.env.PORT || 7000);
app.listen(PORT, () => {
  const masked = (process.env.GEMINI_API_KEY || "")
    .replace(/^(.{6}).+(.{4})$/, "$1…$2");
  console.log(`API running on :${PORT} | GEMINI_API_KEY: ${masked || "(missing)"}`);
});
