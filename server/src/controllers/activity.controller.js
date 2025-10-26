// server/src/controllers/activity.controller.js
import ActivityDay from "../models/ActivityDay.js";

/* ---------- Mirror frontend thresholds ---------- */
const STEP_THRESHOLD = 5000;
const EXERCISE_MINUTES_THRESHOLD = 60;
const POINTS_PER_QUALIFYING_DAY = 10;
const CHALLENGE_DAYS = 30;
const MONTHLY_BONUS_POINTS = 100;

const LOCAL_TZ = "Asia/Kolkata";

/** "YYYY-MM-DD" in given tz */
const toDateKeyTz = (d, tz = LOCAL_TZ) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));

const computeQualifies = (steps, minutes) =>
  Number(steps) >= STEP_THRESHOLD && Number(minutes) >= EXERCISE_MINUTES_THRESHOLD;

const computePoints = (qualifies) => (qualifies ? POINTS_PER_QUALIFYING_DAY : 0);

/** GET /api/activity/me */
export async function whoAmI(req, res) {
  try {
    return res.json({
      ok: true,
      user: {
        id: req.user?.id || null,
        role: req.user?.role || "user",
        imp: !!req.user?.imp,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

/**
 * POST /api/activity/sync
 * Body:
 * {
 *   tz?: "Asia/Kolkata",
 *   days: [{ dateKey?: "YYYY-MM-DD", steps: number, minutes?: number }]
 * }
 */
export async function syncActivity(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });

    const tz = req.body?.tz || LOCAL_TZ;
    const items = Array.isArray(req.body?.days) ? req.body.days : [];
    if (!items.length) return res.status(400).json({ ok: false, error: "No days to sync" });

    const ops = items.map((d) => {
      const dateKey = d?.dateKey || toDateKeyTz(Date.now(), tz);
      const steps = Math.max(0, Number(d?.steps || 0));
      const minutes = Math.max(0, Number(d?.minutes || 0));
      const qualifies = computeQualifies(steps, minutes);
      const points = computePoints(qualifies);
      return {
        updateOne: {
          filter: { user: userId, dateKey },
          update: {
            $set: {
              steps,
              minutes,
              qualifies,
              points,
              meta: { tz, computedAt: new Date(), source: "client-sync" },
            },
          },
          upsert: true,
        },
      };
    });

    const bulk = await ActivityDay.bulkWrite(ops, { ordered: false });
    return res.json({
      ok: true,
      upserted: bulk?.upsertedCount || 0,
      modified: bulk?.modifiedCount || 0,
      matched: bulk?.matchedCount || 0,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

/**
 * GET /api/activity/summary?days=30
 * Returns rows >= (today - days) ascending by dateKey
 */
export async function getSummary(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });

    const days = Math.max(1, Math.min(120, Number(req.query.days || 30)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sinceKey = toDateKeyTz(since);

    const rows = await ActivityDay.find({
      user: userId,
      dateKey: { $gte: sinceKey },
    })
      .sort({ dateKey: 1 })
      .lean()
      .exec();

    return res.json({ ok: true, days, rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

/**
 * GET /api/activity/rewards?days=30
 * Computes streak, progress pct, and last-30 points (+bonus if complete)
 */
export async function getRewards(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthenticated" });

    const days = Math.max(1, Math.min(120, Number(req.query.days || CHALLENGE_DAYS)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sinceKey = toDateKeyTz(since);

    const rows = await ActivityDay.find({
      user: userId,
      dateKey: { $gte: sinceKey },
    })
      .sort({ dateKey: 1 })
      .lean()
      .exec();

    // index by date
    const byDay = {};
    for (const r of rows) byDay[r.dateKey] = r;

    // build continuous window of dateKeys in local tz
    const todayKey = toDateKeyTz(Date.now());
    const keys = [];
    const base = new Date(`${todayKey}T00:00:00`);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      keys.push(toDateKeyTz(d));
    }

    // compute streak from the end of window
    let currentConsecutive = 0;
    for (let i = keys.length - 1; i >= 0; i--) {
      if (byDay[keys[i]]?.qualifies) currentConsecutive += 1;
      else break;
    }
    currentConsecutive = Math.min(currentConsecutive, CHALLENGE_DAYS);

    const pointsSum = keys.reduce((acc, k) => acc + (byDay[k]?.points || 0), 0);
    const complete = currentConsecutive >= CHALLENGE_DAYS;
    const pointsLast30 = pointsSum + (complete ? MONTHLY_BONUS_POINTS : 0);
    const progressPct = Math.round((currentConsecutive / CHALLENGE_DAYS) * 100);

    const today = byDay[todayKey] || { steps: 0, minutes: 0, qualifies: false, points: 0 };

    return res.json({
      ok: true,
      config: {
        STEP_THRESHOLD,
        EXERCISE_MINUTES_THRESHOLD,
        POINTS_PER_QUALIFYING_DAY,
        CHALLENGE_DAYS,
        MONTHLY_BONUS_POINTS,
      },
      today: {
        steps: today.steps,
        minutes: today.minutes,
        qualifiesToday: !!today.qualifies,
        pointsToday: today.points,
      },
      streakDays: currentConsecutive,
      progressPct,
      complete,
      pointsLast30,
      windowDays: days,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
