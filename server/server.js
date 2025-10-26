import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import axios from "axios";
import { connectDB } from "./src/config/db.js";

import authRoutes from "./src/routes/auth.routes.js";
import adminAuthRoutes from "./src/routes/admin.auth.routes.js";
import therapistAuthRoutes from "./src/routes/therapist.auth.routes.js";
import sleepRoutes from "./src/routes/sleep.routes.js";
import googleFitRoutes from "./src/routes/googlefit.routes.js";
import adminDashboardRoutes from "./src/routes/admin.dashboard.routes.js";
import appointmentRoutes from "./src/routes/appointment.routes.js";
import exerciseRoutes from "./src/routes/exercises.routes.js";
import moodRoutes from "./src/routes/mood.routes.js";
import stressRoutes from "./src/routes/stress.routes.js";
import wordScrambleRoutes from "./src/routes/wordScramble.routes.js";
import quickMathRoutes from "./src/routes/quickMath.routes.js";
import nutritionRoutes from "./src/routes/nutrition.routes.js";
import activityRoutes from "./src/routes/activity.routes.js"; // << NEW
import { notFound, errorHandler } from "./src/middleware/error.js";
import { requireAuth, requireRole } from "./src/middleware/auth.js";
// server/index.js
import aiRoutes from "./src/routes/ai.routes.js";


/* ---------------- Env ---------------- */
dotenv.config({ path: process.env.ENV_PATH || path.join(__dirname, ".env") });

const app = express();

/* If deploying behind a proxy/ingress (e.g., Render, Railway, Nginx),
   this ensures secure cookies work when X-Forwarded-Proto = https. */
app.set("trust proxy", 1);

/* ---------------- Security & Core ---------------- */
app.disable("x-powered-by");
app.set("etag", false);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  })
);

/* ------- CORS (credentials + explicit origin) ------- */
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
/* Allow multiple comma-separated origins via env if needed */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || FRONTEND_URL)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOrigin =
  process.env.NODE_ENV === "production"
    ? (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`Blocked by CORS: ${origin}`));
      }
    : true;

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "X-Requested-With",
      "x-access-token",
    ],
  })
);
app.options("*", cors());

/* parse cookies so auth can read req.cookies.token */
app.use(cookieParser());

/* body parsing */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
  app.use((req, _res, next) => {
    console.log("[REQ]", req.method, req.originalUrl);
    next();
  });
}

/* ---------------- HTTP + Socket.IO ---------------- */
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? allowedOrigins : "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});
app.use((req, _res, next) => {
  req.io = io;
  next();
});

/* Anti-cache for Google Fit endpoints */
app.use("/api/googlefit", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

/* ---------------- Dev env debug ---------------- */
if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug/env", (_req, res) => {
    const mask = (v) => (v ? String(v).slice(0, 8) + "…" : null);
    res.json({
      NODE_ENV: process.env.NODE_ENV || "development",
      FRONTEND_URL: process.env.FRONTEND_URL || null,
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || null,
      GOOGLE_CLIENT_ID: mask(process.env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? mask(process.env.GOOGLE_CLIENT_SECRET) : null,
      ALLOWED_ORIGINS: allowedOrigins,
    });
  });
}

/* ---------------- Minimal chat schemas (demo) ---------------- */
const messageSchema = new mongoose.Schema(
  {
    group: String,
    sender: String,
    text: String,
    time: { type: Date, default: Date.now },
  },
  { indexes: [{ group: 1, time: -1 }] }
);

const onlineUserSchema = new mongoose.Schema(
  {
    group: String,
    socketId: { type: String, unique: true },
    username: String,
    joinedAt: { type: Date, default: Date.now },
  },
  { indexes: [{ group: 1 }, { socketId: 1, unique: true }] }
);

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
const OnlineUser = mongoose.models.OnlineUser || mongoose.model("OnlineUser", onlineUserSchema);

/* ======================================================================
   ================  GEMINI 2.5 INLINE ROUTES (OPTIONAL)  ===============
   ====================================================================== */
const GEMINI_API_VER = "v1beta";
const MODEL_CANDIDATES = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

const getGeminiKey = (override) => String(override || process.env.GEMINI_API_KEY || "").trim();

function extractTextFromCandidates(up) {
  try {
    const cands = up?.candidates || [];
    if (!cands.length) return "";
    const out = [];
    for (const c of cands) {
      for (const p of c?.content?.parts || []) {
        if (typeof p?.text === "string") out.push(p.text);
        if (Array.isArray(p?.executedCode?.output)) out.push(p.executedCode.output.join("\n"));
        if (p?.functionResponse?.response) out.push(JSON.stringify(p.functionResponse.response));
      }
    }
    return out.join("\n").trim();
  } catch {
    return "";
  }
}

app.get("/api/ai/debug", (_req, res) => {
  const masked = (process.env.GEMINI_API_KEY || "").replace(/^(.{6}).+(.{4})$/, "$1…$2");
  res.json({
    ok: true,
    where: "server.js inline",
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    keyMasked: masked || "(missing)",
  });
});

app.get("/api/ai/models", async (_req, res) => {
  try {
    const KEY = getGeminiKey();
    if (!KEY) return res.status(500).json({ ok: false, error: "No GEMINI_API_KEY configured" });
    const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VER}/models?key=${encodeURIComponent(KEY)}`;
    const r = await axios.get(url, { timeout: 15000, validateStatus: () => true });
    return res.status(r.status).json(r.data);
  } catch (e) {
    return res.status(502).json({ ok: false, error: e?.response?.data?.error?.message || e.message });
  }
});

app.post("/api/ai/gemini", async (req, res) => {
  try {
    const { prompt, model, apiKey, temperature, maxTokens } = req.body || {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ ok: false, error: "Missing or invalid 'prompt' string" });
    }

    const KEY = getGeminiKey(apiKey);
    if (!KEY) return res.status(500).json({ ok: false, error: "No GEMINI_API_KEY configured on server" });

    const generationConfig = {
      temperature: typeof temperature === "number" ? temperature : 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: typeof maxTokens === "number" ? maxTokens : 1024,
      candidateCount: 1,
    };

    const safetySettings = [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
    ];

    const tryModels = model
      ? [String(model).trim(), ...MODEL_CANDIDATES.filter((m) => m !== model)]
      : MODEL_CANDIDATES.slice();

    const callGemini = async (mdl, includeSafety) => {
      const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VER}/models/${encodeURIComponent(
        mdl
      )}:generateContent?key=${encodeURIComponent(KEY)}`;
      const body = {
        contents: [{ role: "user", parts: [{ text: String(prompt) }] }],
        generationConfig,
        ...(includeSafety ? { safetySettings } : {}),
      };
      return axios.post(url, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
        validateStatus: () => true,
      });
    };

    for (const mdl of tryModels) {
      let r = await callGemini(mdl, true);
      const badSafety = r.status === 400 && JSON.stringify(r.data || {}).toLowerCase().includes("safety_settings");
      if (badSafety) r = await callGemini(mdl, false);
      if (r.status >= 400 && r.status !== 404) {
        return res.status(r.status).json({
          ok: false,
          error: r.data?.error?.message || "Upstream error",
          upstreamStatus: r.status,
          triedModel: mdl,
          promptFeedback: r.data?.promptFeedback || null,
        });
      }
      if (r.status >= 200 && r.status < 300) {
        const txt = extractTextFromCandidates(r.data);
        if (txt) return res.json({ ok: true, model: mdl, text: txt });
        continue;
      }
    }

    return res.status(502).json({ ok: false, error: "No Gemini model responded with content" });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e?.response?.data?.error?.message || e?.message || "Gemini request failed" });
  }
});

app.post("/api/googlefit/api/ai/gemini", (req, res, next) => {
  req.url = "/api/ai/gemini";
  next();
});

/* =========================== END GEMINI ROUTES =========================== */

async function startServer() {
  try {
    await connectDB();
    console.log(`✅ MongoDB connected: ${mongoose.connection.host} / DB: ${mongoose.connection.name}`);

    app.get("/", (_req, res) => res.json({ ok: true, message: "ZenithMind API Active" }));
    app.get("/api/health", (_req, res) => res.json({ ok: true }));

    // Public auth mounts
    app.use("/api/auth", authRoutes);
    app.use("/api/admin/auth", adminAuthRoutes);
    app.use("/api/therapist/auth", therapistAuthRoutes);

    // Admin-only APIs
    app.use("/api/admin", requireAuth, requireRole("admin"), adminDashboardRoutes);

    // App routes
    app.use("/api/sleep", sleepRoutes);
    app.use("/api/googlefit", googleFitRoutes);
    app.use("/api/appointments", appointmentRoutes);

    // Exercises are protected inside the router
    app.use("/api/exercises", exerciseRoutes);

    // Mood routes are protected inside the router
    app.use("/api/mood", moodRoutes);

    // ✅ Activity snapshots (daily steps/minutes & rewards)
    app.use("/api/activity", activityRoutes);

    // ✅ Stress routes are now protected inside the router via router.use(requireAuth)
    app.use("/api/stress", stressRoutes);

    app.use("/api/wordscramble", wordScrambleRoutes);
    app.use("/api/quickmath", quickMathRoutes);
    app.use("/api/nutrition", nutritionRoutes);
    app.use("/api/ai", aiRoutes);
    /* Socket handlers (unchanged) */
    io.on("connection", (socket) => {
      socket.on("joinGroup", async ({ group, username }) => {
        try {
          if (!group || !username) return;

          const existing = await OnlineUser.findOne({ socketId: socket.id });
          if (existing) {
            await OnlineUser.updateOne(
              { socketId: socket.id },
              { $set: { group, username, joinedAt: Date.now() } }
            );
          } else {
            const userCount = await OnlineUser.countDocuments({ group });
            if (userCount >= 100) {
              socket.emit("groupFull", "Group is full (100 users max).");
              return;
            }
            await OnlineUser.updateOne(
              { socketId: socket.id },
              { $set: { group, username, joinedAt: Date.now() } },
              { upsert: true }
            );
          }

          socket.join(group);
          const messages = await Message.find({ group }).sort({ time: -1 }).limit(50).lean().exec();
          socket.emit("loadMessages", messages.reverse());
          const onlineCount = await OnlineUser.countDocuments({ group });
          io.to(group).emit("onlineUsers", onlineCount);
        } catch (e) {
          console.error("joinGroup:", e.message);
        }
      });

      socket.on("sendMessage", async ({ group, sender, text }) => {
        try {
          if (!text?.trim()) return;
          const msg = await Message.create({ group, sender, text });
          io.to(group).emit("newMessage", msg);
        } catch (e) {
          console.error("sendMessage:", e.message);
        }
      });

      const handleLeave = async () => {
        try {
          const user = await OnlineUser.findOneAndDelete({ socketId: socket.id });
          if (user) {
            socket.leave(user.group);
            const count = await OnlineUser.countDocuments({ group: user.group });
            io.to(user.group).emit("onlineUsers", count);
          }
        } catch (e) {
          console.error("handleLeave/disconnect:", e.message);
        }
      };

      socket.on("leaveGroup", handleLeave);
      socket.on("disconnect", handleLeave);
    });

    // MUST be last
    app.use(notFound);
    app.use(errorHandler);

    const PORT = Number(process.env.PORT || 7000);
    const srv = server.listen(PORT, () => {
      console.log(`🚀 Server http://localhost:${PORT}`);
    });

    const shutdown = async (signal) => {
      try {
        console.log(`\n🛑 ${signal} received, closing server...`);
        io.close();
        srv.close(() => process.exit(0));
        await mongoose.connection.close();
      } catch {
        process.exit(1);
      }
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

startServer();
