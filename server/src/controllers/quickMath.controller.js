import QuickMathScore from "../models/quickMathScore.model.js";

export const submitScore = async (req, res) => {
  try {
    const { name, score, bestStreak } = req.body || {};
    const displayName = (name || "").toString().trim() || "Player";
    const s = Number(score);
    const bs = Number(bestStreak);

    if (!Number.isFinite(s) || s < 0) return res.status(400).json({ ok: false, error: "Invalid score" });
    if (!Number.isFinite(bs) || bs < 0) return res.status(400).json({ ok: false, error: "Invalid bestStreak" });

    const doc = await QuickMathScore.create({
      user: req.user?._id || undefined,
      name: displayName,
      score: s,
      bestStreak: bs,
      ip: req.ip,
      ua: req.headers["user-agent"] || "",
    });

    // Rank = count of strictly better rows + 1
    const better = await QuickMathScore.countDocuments({
      $or: [
        { score: { $gt: s } },
        { score: s, bestStreak: { $gt: bs } },
        { score: s, bestStreak: bs, createdAt: { $lt: doc.createdAt } },
      ],
    });

    res.json({ ok: true, rank: better + 1, data: { _id: doc._id, name: doc.name, score: doc.score, bestStreak: doc.bestStreak, createdAt: doc.createdAt } });
  } catch (e) {
    console.error("quickmath submitScore:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const rows = await QuickMathScore.find({})
      .sort({ score: -1, bestStreak: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      ok: true,
      data: rows.map(r => ({
        _id: r._id,
        name: r.name,
        score: r.score,
        bestStreak: r.bestStreak,
        createdAt: r.createdAt,
      })),
    });
  } catch (e) {
    console.error("quickmath getLeaderboard:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
};
