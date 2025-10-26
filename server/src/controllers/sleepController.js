// server/src/controllers/sleepController.js
import SleepLog from "../models/sleepLog.model.js";

/* Helpers */
const toDate = (v) => (v instanceof Date ? v : new Date(v));
const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

/**
 * POST /api/sleep
 * body: { start, end, duration?, quality?, notes?, soundId?, source? }
 */
export const createSleep = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { start, end, duration, quality, notes, soundId, source } = req.body || {};
    const s = toDate(start);
    const e = toDate(end);

    if (!isValidDate(s) || !isValidDate(e)) {
      return res.status(400).json({ ok: false, error: "Invalid start/end date" });
    }
    if (e <= s) {
      return res.status(400).json({ ok: false, error: "end must be after start" });
    }

    const dur = typeof duration === "number" ? duration : (e.getTime() - s.getTime());

    const doc = await SleepLog.create({
      userId,
      start: s,
      end: e,
      duration: dur,
      quality,
      notes,
      soundId,
      source: source || "timer",
    });

    return res.json({ ok: true, sleep: doc });
  } catch (e) {
    if (e?.code === 11000) {
      // duplicate (based on the unique index)
      return res.status(200).json({ ok: true, duplicate: true });
    }
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * POST /api/sleep/bulk-upsert
 * body: { sessions: Array<{start,end,duration?,quality?,notes?,soundId?,source?}> }
 */
export const bulkUpsert = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const sessions = Array.isArray(req.body?.sessions) ? req.body.sessions : [];
    if (!sessions.length) return res.json({ ok: true, upserted: 0 });

    const ops = [];
    for (const row of sessions) {
      const s = toDate(row.start);
      const e = toDate(row.end);
      if (!isValidDate(s) || !isValidDate(e) || e <= s) continue;

      const dur = typeof row.duration === "number" ? row.duration : (e.getTime() - s.getTime());
      ops.push({
        updateOne: {
          filter: { userId, start: s, end: e },
          update: {
            $setOnInsert: { userId, start: s, end: e },
            $set: {
              duration: dur,
              quality: row.quality ?? undefined,
              notes: row.notes ?? undefined,
              soundId: row.soundId ?? undefined,
              source: row.source || "googlefit",
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (!ops.length) return res.json({ ok: true, upserted: 0 });

    const result = await SleepLog.bulkWrite(ops, { ordered: false });
    const upserted = (result?.upsertedCount || 0) + (result?.modifiedCount || 0);
    return res.json({ ok: true, upserted });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * GET /api/sleep
 * query: from?, to?, limit?, page?
 */
export const getAllSleep = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { from, to, limit = 100, page = 1 } = req.query;
    const q = { userId };
    if (from || to) {
      q.start = {};
      if (from) q.start.$gte = toDate(from);
      if (to)   q.start.$lte = toDate(to);
    }

    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

    const [rows, total] = await Promise.all([
      SleepLog.find(q).sort({ start: -1 }).skip(skip).limit(lim).lean().exec(),
      SleepLog.countDocuments(q),
    ]);

    return res.json({ ok: true, total, page: Number(page), limit: lim, sleep: rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * DELETE /api/sleep/:id
 */
export const deleteSleep = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { id } = req.params;
    const doc = await SleepLog.findOneAndDelete({ _id: id, userId }).exec();
    if (!doc) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * GET /api/sleep/weekly-average
 */
export const getWeeklyAverage = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const now = new Date();
    const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const rows = await SleepLog.find({ userId, start: { $gte: start7 } }).lean().exec();

    const map = {};
    for (const r of rows) {
      const k = new Date(r.start).toISOString().slice(0, 10);
      map[k] = map[k] || { totalMs: 0, count: 0 };
      map[k].totalMs += r.duration || 0;
      map[k].count += 1;
    }

    const out = Object.entries(map).map(([date, { totalMs, count }]) => ({
      date,
      avgHours: count ? totalMs / count / 3600000 : 0,
    }));

    return res.json({ ok: true, days: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
