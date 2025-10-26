// server/src/routes/exercises.routes.js
import express from "express";
import mongoose from "mongoose";
import Exercise from "../models/Exercise.js";
import ExerciseSession from "../models/ExerciseSession.js";
import User from "../models/User.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/* ───────── helpers ───────── */
function toDateKeyTz(dateInput, tz = "Asia/Kolkata") {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(dateInput)); // YYYY-MM-DD
  } catch {
    return new Date(dateInput).toISOString().slice(0, 10);
  }
}
const ms = (v) => new Date(v).getTime();

/* ───────── quick auth probe (optional) ───────── */
router.get("/debug/whoami", requireAuth, (req, res) => {
  return res.json({ ok: true, user: req.user });
});

/* =====================  CATALOG  ===================== */

// GET /api/exercises  (list)
router.get("/", async (req, res) => {
  try {
    const q = {};
    if (req.query.type) q.type = req.query.type;
    if (req.query.difficulty) q.difficulty = req.query.difficulty;
    const rows = await Exercise.find(q).sort({ title: 1 }).lean().exec();
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/exercises  (admin create)
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const doc = await Exercise.create(req.body || {});
    res.json({ ok: true, data: doc });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// PATCH /api/exercises/:id  (admin update)
router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const doc = await Exercise.findByIdAndUpdate(req.params.id, req.body || {}, { new: true });
    res.json({ ok: true, data: doc });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// DELETE /api/exercises/:id  (admin delete)
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await Exercise.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/* =====================  SESSION LOGS  ===================== */

// POST /api/exercises/log
// body: { exerciseId?, title, startedAt, endedAt, durationMinutes?, source?, steps?, videoId?, tz?, difficulty?, type? }
router.post("/log", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      console.warn("[/api/exercises/log] 401 no user on req");
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const {
      exerciseId,
      title,
      startedAt,
      endedAt,
      durationMinutes,
      source = "guided",
      steps = [],
      videoId = "",
      tz = "Asia/Kolkata",
      difficulty,
      type,
    } = req.body || {};

    if (!title || !startedAt || !endedAt) {
      console.warn("[/api/exercises/log] 400 missing fields", { title, startedAt, endedAt });
      return res.status(400).json({ ok: false, error: "title, startedAt, endedAt are required" });
    }

    const s = ms(startedAt);
    const e = ms(endedAt);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
      console.warn("[/api/exercises/log] 400 invalid times", { startedAt, endedAt, s, e });
      return res.status(400).json({ ok: false, error: "Invalid startedAt/endedAt" });
    }

    const rawSeconds = Math.round((e - s) / 1000);
    const minutes =
      typeof durationMinutes === "number" && durationMinutes > 0
        ? Math.round(durationMinutes)
        : Math.max(0, Math.round(rawSeconds / 60));

    const dateKey = toDateKeyTz(s, tz);

    // 1) Create a canonical ExerciseSession document (user-scoped)
    const sessionDoc = await ExerciseSession.create({
      user: userId,
      exercise: exerciseId || undefined,
      title: String(title).trim(),
      source,
      startedAt: new Date(s),
      endedAt: new Date(e),
      minutes,
      dateKey,
      meta: { steps, videoId, tz, rawSeconds, difficulty, type },
    });

    // 2) ALSO push a compact activity item into User.activityLog (rolling latest 500)
    const activityItem = {
      kind: "exercise",
      title: String(title).trim(),
      source,
      videoId,
      exerciseSessionId: sessionDoc._id,
      startedAt: new Date(s),
      endedAt: new Date(e),
      minutes,
      dateKey,
      meta: { tz, rawSeconds, difficulty, type, steps },
    };

    await User.updateOne(
      { _id: userId },
      {
        $push: {
          activityLog: {
            $each: [activityItem],
            $slice: -500,
          },
        },
      }
    );

    res.json({ ok: true, data: sessionDoc });
  } catch (e) {
    console.error("[/api/exercises/log] 500", e);
    res.status(500).json({ ok: false, error: e.message || "Failed to log" });
  }
});

// GET /api/exercises/recent?limit=20
router.get("/recent", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const rows = await ExerciseSession.find({ user: userId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/exercises/summary?days=30
// Returns: [{ dateKey: 'YYYY-MM-DD', totalMinutes, sessions }]
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const days = Math.max(1, Math.min(120, Number(req.query.days || 30)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await ExerciseSession.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(userId)), startedAt: { $gte: since } } },
      { $group: { _id: "$dateKey", totalMinutes: { $sum: "$minutes" }, sessions: { $sum: 1 } } },
      { $project: { _id: 0, dateKey: "$_id", totalMinutes: 1, sessions: 1 } },
      { $sort: { dateKey: 1 } },
    ]).exec();

    res.json({ ok: true, days, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
