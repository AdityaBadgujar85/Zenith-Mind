import WordScore from "../models/wordScore.model.js";

/**
 * POST /api/wordscramble/score
 * body: { name, score, bestStreak }
 * If req.user exists (JWT), we'll attach it; otherwise anonymous allowed.
 * Responds with { ok, data, rank }
 */
export const submitScore = async (req, res) => {
  try {
    const { name, score, bestStreak } = req.body || {};
    const displayName = (name || "").toString().trim() || "Player";

    const s = Number(score);
    const bs = Number(bestStreak);
    if (!Number.isFinite(s) || s < 0) {
      return res.status(400).json({ ok: false, error: "Invalid score" });
    }
    if (!Number.isFinite(bs) || bs < 0) {
      return res.status(400).json({ ok: false, error: "Invalid bestStreak" });
    }

    const doc = await WordScore.create({
      user: req.user?._id || undefined,
      name: displayName,
      score: s,
      bestStreak: bs,
      ip: req.ip,
      ua: req.headers["user-agent"] || "",
    });

    // rank = number of strictly better docs + 1
    const betterCount = await WordScore.countDocuments({
      $or: [
        { score: { $gt: s } },
        { score: s, bestStreak: { $gt: bs } },
        { score: s, bestStreak: bs, createdAt: { $lt: doc.createdAt } },
      ],
    });

    return res.json({
      ok: true,
      data: {
        _id: doc._id,
        name: doc.name,
        score: doc.score,
        bestStreak: doc.bestStreak,
        createdAt: doc.createdAt,
      },
      rank: betterCount + 1,
    });
  } catch (e) {
    console.error("submitScore:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * GET /api/wordscramble/leaderboard?limit=10
 * Public leaderboard
 */
export const getLeaderboard = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));

    const rows = await WordScore.find({})
      .sort({ score: -1, bestStreak: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const data = rows.map((r) => ({
      _id: r._id,
      name: r.name,
      score: r.score,
      bestStreak: r.bestStreak,
      createdAt: r.createdAt,
    }));

    return res.json({ ok: true, data });
  } catch (e) {
    console.error("getLeaderboard:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};

/**
 * (Optional) GET /api/wordscramble/me/history
 * If you have auth and want personal history. Returns [] if not signed in.
 */
export const getMyHistory = async (req, res) => {
  try {
    if (!req.user?._id) return res.json({ ok: true, data: [] });
    const data = await WordScore.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.json({ ok: true, data });
  } catch (e) {
    console.error("getMyHistory:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
