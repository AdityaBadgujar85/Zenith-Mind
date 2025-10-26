import StressEntry from "../models/stressEntry.model.js";

const getUserId = (req) => req.user?._id || req.user?.id || req.user;

const isDateKey = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const capArr = (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : []);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * POST /api/stress
 * Body: { date: "YYYY-MM-DD", manual?, gf? }
 */
export const upsertDay = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { date, manual, gf } = req.body || {};

    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });
    if (!isDateKey(date)) {
      return res.status(400).json({ ok: false, error: "Invalid 'date' (YYYY-MM-DD)" });
    }

    const $set = {};

    // Manual payload hardening (optional)
    if (manual && typeof manual === "object") {
      const stress = capArr(manual.stress, 50).map((s) => ({
        text: String(s?.text || "").trim().slice(0, 200),
        intensity: clamp(Number(s?.intensity ?? 0), 1, 10),
        category: String(s?.category || "Other").slice(0, 40),
      }));
      const habits = capArr(manual.habits, 50).map((h) => ({
        text: String(h?.text || "").trim().slice(0, 200),
        done: Boolean(h?.done),
        streak: clamp(Number(h?.streak ?? 0), 0, 10000),
        lastDone: String(h?.lastDone || ""),
      }));
      $set.manual = { stress, habits };
    }

    // GF payload hardening (optional)
    if (gf && typeof gf === "object") {
      const notes = capArr(gf.notes, 100).map((n) => ({
        text: String(n?.text || "").trim().slice(0, 400),
        category: String(n?.category || "Other").slice(0, 40),
        stressIndex: clamp(Number(n?.stressIndex ?? 0), 0, 100),
        addedAt: n?.addedAt ? new Date(n.addedAt) : new Date(),
      }));
      const habits = capArr(gf.habits, 50).map((h) => ({
        text: String(h?.text || "").trim().slice(0, 200),
        done: Boolean(h?.done),
        streak: clamp(Number(h?.streak ?? 0), 0, 10000),
        lastDone: String(h?.lastDone || ""),
      }));
      const stressIndex =
        gf.stressIndex == null ? undefined : clamp(Number(gf.stressIndex), 0, 100);
      $set.gf = { ...(stressIndex == null ? {} : { stressIndex }), notes, habits };
    }

    const doc = await StressEntry.findOneAndUpdate(
      { user: userId, date },
      Object.keys($set).length ? { $set } : { $setOnInsert: { user: userId, date } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ ok: true, data: doc });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * GET /api/stress?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
export const listRange = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });

    const { start, end } = req.query || {};
    if (!isDateKey(start) || !isDateKey(end)) {
      return res.status(400).json({ ok: false, error: "start & end (YYYY-MM-DD) required" });
    }

    const items = await StressEntry.find({
      user: userId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .lean();

    return res.json({ ok: true, data: items });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * GET /api/stress/:date
 */
export const getDay = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });

    const { date } = req.params || {};
    if (!isDateKey(date)) return res.status(400).json({ ok: false, error: "date param (YYYY-MM-DD) required" });

    const doc = await StressEntry.findOne({ user: userId, date }).lean();
    return res.json({ ok: true, data: doc || null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * DELETE /api/stress/:date
 */
export const removeDay = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });

    const { date } = req.params || {};
    if (!isDateKey(date)) return res.status(400).json({ ok: false, error: "date param (YYYY-MM-DD) required" });

    await StressEntry.deleteOne({ user: userId, date });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
