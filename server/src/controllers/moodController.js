import MoodEntry from "../models/moodEntry.model.js";

const getUserId = (req) => req.user?._id || req.user?.id;

/** Normalize and validate a YYYY-MM-DD date string */
const normDate = (d) => {
  if (typeof d !== "string") return null;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
};

const normTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 50);
};

/**
 * GET /api/mood
 * Optional: ?start=YYYY-MM-DD&end=YYYY-MM-DD (inclusive)
 * Returns { ok, mood: MoodEntry[] }
 */
export const listMood = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { start, end } = req.query || {};
    const q = { user: userId };

    if (start || end) {
      const s = start ? normDate(start) : null;
      const e = end ? normDate(end) : null;
      if ((start && !s) || (end && !e)) {
        return res.status(400).json({ ok: false, error: "Invalid start/end" });
      }
      q.date = {};
      if (s) q.date.$gte = s;
      if (e) q.date.$lte = e;
    }

    const rows = await MoodEntry.find(q).sort({ date: 1 }).lean().exec();
    return res.json({ ok: true, mood: rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * POST /api/mood
 * body: { date (YYYY-MM-DD), mood (1..5), tags?, note?, createdAt? }
 * Upsert by (user,date)
 */
export const upsertMood = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const date = normDate(req.body?.date);
    const mood = Number(req.body?.mood);
    const tags = normTags(req.body?.tags);
    const note = String(req.body?.note || "");

    if (!date) return res.status(400).json({ ok: false, error: "Invalid 'date' (YYYY-MM-DD)" });
    if (!(mood >= 1 && mood <= 5)) return res.status(400).json({ ok: false, error: "Invalid 'mood' (1..5)" });

    const doc = await MoodEntry.findOneAndUpdate(
      { user: userId, date },
      { $set: { mood, tags, note } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ ok: true, mood: doc });
  } catch (e) {
    // unique index conflict fallback (rare race)
    if (e?.code === 11000) {
      try {
        const date = normDate(req.body?.date);
        const mood = Number(req.body?.mood);
        const tags = normTags(req.body?.tags);
        const note = String(req.body?.note || "");
        const doc = await MoodEntry.findOneAndUpdate(
          { user: getUserId(req), date },
          { $set: { mood, tags, note } },
          { new: true }
        ).lean();
        return res.json({ ok: true, mood: doc });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    }
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * DELETE /api/mood/:id
 * Delete a single entry by _id (scoped to user)
 */
export const deleteMood = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { id } = req.params || {};
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

    const doc = await MoodEntry.findOneAndDelete({ _id: id, user: userId }).exec();
    if (!doc) return res.status(404).json({ ok: false, error: "Not found" });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * DELETE /api/mood/all
 * Danger: removes ALL mood entries for this user
 */
export const deleteAllMood = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    await MoodEntry.deleteMany({ user: userId });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * POST /api/mood/import
 * body: { entries: [{date,mood,tags?,note?,createdAt?}, ...] }
 * Bulk upsert by (user,date)
 */
export const importMood = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (!entries.length) return res.json({ ok: true, upserted: 0 });

    const ops = [];
    for (const row of entries) {
      const date = normDate(row.date);
      const mood = Number(row.mood);
      if (!date || !(mood >= 1 && mood <= 5)) continue;

      const tags = normTags(row.tags);
      const note = String(row.note || "");

      ops.push({
        updateOne: {
          filter: { user: userId, date },
          update: {
            $setOnInsert: { user: userId, date },
            $set: { mood, tags, note, updatedAt: new Date() },
          },
          upsert: true,
        },
      });
    }

    if (!ops.length) return res.json({ ok: true, upserted: 0 });

    const result = await MoodEntry.bulkWrite(ops, { ordered: false });
    const upserted = (result?.upsertedCount || 0) + (result?.modifiedCount || 0);

    // Return the latest state so client can refresh if desired
    const rows = await MoodEntry.find({ user: userId }).sort({ date: 1 }).lean().exec();
    return res.json({ ok: true, upserted, mood: rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
