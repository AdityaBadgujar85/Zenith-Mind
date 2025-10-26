// server/src/routes/googlefit.routes.js
import express from "express";
import axios from "axios";
import GoogleToken from "../models/googleToken.model.js";

const router = express.Router();

/* ───────────────────────────── Utilities ───────────────────────────── */

const envStr = (k, d = "") => (process.env[k] || d).trim();
const toNs = (ms) => String(BigInt(ms) * 1_000_000n);

const DEFAULT_RANGE_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Format YYYY-MM-DD for a specific IANA timezone
const dateKeyForTz = (ms, tz = "UTC") => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(Number(ms))); // -> YYYY-MM-DD
};

// Helper to get all dates between two timestamps in a specific timezone
const getDatesInRange = (startMs, endMs, tz) => {
  const dates = new Set();
  const current = new Date(startMs);
  const end = new Date(endMs);

  while (current.getTime() <= end.getTime()) {
    dates.add(dateKeyForTz(current.getTime(), tz));
    current.setDate(current.getDate() + 1);
    if (dates.size > 100) break; // safety
  }
  dates.add(dateKeyForTz(endMs, tz));
  return Array.from(dates).sort();
};

// ✅ NEW: tz-aware start/end of day helpers
const getTzOffsetString = (tz) => {
  const d = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "shortOffset",
    }).formatToParts(d);
    const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value;
    const m = offsetPart?.match(/([+-])?(\d{1,2}):(\d{2})/);
    if (m) {
      const [, sign = "+", hh, mm] = m;
      return `${sign}${String(hh).padStart(2, "0")}:${mm}`;
    }
  } catch {}
  const localOffset = -d.getTimezoneOffset();
  const sign = localOffset >= 0 ? "+" : "-";
  const abs = Math.abs(localOffset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
};
const startOfDayTz = (ms, tz = "UTC") => {
  const s = new Date(ms).toLocaleDateString("en-CA", { timeZone: tz });
  const offset = getTzOffsetString(tz);
  return new Date(`${s}T00:00:00.000${offset}`).getTime();
};
const endOfDayTz = (ms, tz = "UTC") => startOfDayTz(ms, tz) + (24 * 60 * 60 * 1000 - 1);

const ACTIVITY_MAP = {
  7: "Walking",
  8: "Running",
  9: "Cycling",
  10: "Biking",
  11: "Elliptical",
  12: "Weightlifting",
  16: "Fitness Class",
  18: "Gymnastics",
  21: "Hiking",
  24: "Meditation",
  33: "Swimming",
  36: "Yoga",
  48: "Aerobics",
  50: "Mountaineering",
  69: "HIIT",
  70: "Strength Training",
  71: "Stretching",
  73: "Other Activity",
  76: "Riding",
  80: "Circuit Training",
  82: "Water Sports",
  92: "Paddling",
};
const getActivityName = (typeId) => ACTIVITY_MAP[typeId] || `Activity (Code: ${typeId})`;

/* ────────────────────────── Token management ───────────────────────── */

async function ensureAccessToken(userId) {
  const doc = await GoogleToken.findOne({ userId });
  if (!doc) throw new Error("No tokens for user");

  const fresh =
    doc.accessToken && doc.expiryDate && doc.expiryDate - 60_000 > Date.now();
  if (fresh) return doc.accessToken;

  if (!doc.refreshToken)
    throw new Error("No refresh token - please re-link Google Fit");

  const CLIENT_ID = envStr("GOOGLE_CLIENT_ID");
  const CLIENT_SECRET = envStr("GOOGLE_CLIENT_SECRET");
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("OAuth env missing");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: doc.refreshToken,
  });

  try {
    const resp = await axios.post(
      "https://oauth2.googleapis.com/token",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const { access_token, expires_in, refresh_token: new_rt } = resp.data;
    doc.accessToken = access_token;
    doc.expiryDate = Date.now() + (expires_in || 3600) * 1000;
    if (new_rt) doc.refreshToken = new_rt; // only replace if Google sent a new one
    await doc.save();
    return access_token;
  } catch (e) {
    const code = e.response?.data?.error || "";
    const desc = e.response?.data?.error_description || "";
    console.error(`Token refresh failed for ${userId}:`, e.response?.data || e.message);

    if (code === "invalid_grant" || /invalid_grant/i.test(desc)) {
      await GoogleToken.deleteOne({ userId });
      throw new Error("Failed to refresh token (invalid_grant). Please re-link Google Fit.");
    }
    throw new Error("Temporary token refresh error. Try again.");
  }
}

const oauthFailResponse = (res, msg) => {
  res.set("Cache-Control", "no-store");
  return res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Google Fit</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica,Arial;text-align:center;padding:40px}.err{color:#b91c1c;font-weight:700;margin-bottom:8px}.muted{color:#6b7280}</style></head>
<body>
  <div class="err">Linking failed</div>
  <div class="muted">${String(msg || "Unknown error")}</div>
  <script>
    try { if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "googlefit_linked", ok:false, error: ${JSON.stringify(
        String(msg || "error")
      )} }, "*");
    }} catch(e) {}
    try { window.close(); } catch(e) {}
  </script>
</body></html>`);
};

/* ───────────────────────────── OAuth flow ───────────────────────────── */

router.get("/auth/url", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const CLIENT_ID = envStr("GOOGLE_CLIENT_ID");
    const REDIRECT_URI = envStr("GOOGLE_REDIRECT_URI");
    if (!CLIENT_ID || !REDIRECT_URI) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_ID/GOOGLE_REDIRECT_URI missing" });
    }

    const scope = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.body.read",
      "https://www.googleapis.com/auth/fitness.heart_rate.read",
      "https://www.googleapis.com/auth/fitness.sleep.read",
      "https://www.googleapis.com/auth/fitness.nutrition.read",
    ].join(" ");

    const state = Buffer.from(JSON.stringify({ userId })).toString("base64url");
    const q = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope,
      include_granted_scopes: "true",
      access_type: "offline",
      prompt: "consent",
      state,
    });

    res.json({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/callback", async (req, res) => {
  try {
    const { code, state, error, error_description, scope } = req.query;
    if (error) return oauthFailResponse(res, error_description || error);
    if (!code || !state) return oauthFailResponse(res, "Missing code/state");

    let userId;
    try {
      const decoded = JSON.parse(Buffer.from(String(state), "base64url").toString("utf8"));
      userId = decoded?.userId;
    } catch {
      return oauthFailResponse(res, "Invalid state");
    }
    if (!userId) return oauthFailResponse(res, "Invalid state (userId missing)");

    const CLIENT_ID = envStr("GOOGLE_CLIENT_ID");
    const CLIENT_SECRET = envStr("GOOGLE_CLIENT_SECRET");
    const REDIRECT_URI = envStr("GOOGLE_REDIRECT_URI");
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI)
      return oauthFailResponse(res, "OAuth env missing");

    const params = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const tok = await axios.post(
      "https://oauth2.googleapis.com/token",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tok.data;
    const expiryDate = Date.now() + (expires_in || 3600) * 1000;

    const prof = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const grantedScopes = scope ? scope.split(" ").filter(Boolean) : [];

    const update = {
      accessToken: access_token,
      expiryDate,
      email: prof.data?.email,
      name: prof.data?.name,
      picture: prof.data?.picture,
      scopes: grantedScopes,
    };
    if (refresh_token) update.refreshToken = refresh_token;

    await GoogleToken.findOneAndUpdate(
      { userId },
      { $set: update },
      { upsert: true, new: true, runValidators: true }
    );

    res.set("Cache-Control", "no-store");
    return res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Google Fit</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica,Arial;text-align:center;padding:40px}.ok{color:#16a34a;font-weight:700;margin-bottom:8px}.muted{color:#6b7280}</style></head>
<body>
  <div class="ok">Google Fit linked!</div>
  <div class="muted">You can close this window.</div>
  <script>
    (function(){
      try { if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "googlefit_linked", ok:true }, "*");
      }} catch(e) {}
      try { window.close(); } catch(e) {}
    })();
  </script>
</body></html>`);
  } catch (e) {
    console.error("OAuth callback error:", e.response?.data || e.message);
    return oauthFailResponse(res, "Server error during linking.");
  }
});

/* ─────────────────────── Status / Management ──────────────────────── */

router.get("/status/:userId", async (req, res) => {
  try {
    const doc = await GoogleToken.findOne({ userId: req.params.userId }).lean();
    if (!doc) return res.json({ linked: false });
    res.json({
      linked: true,
      email: doc.email || null,
      name: doc.name || null,
      picture: doc.picture || null,
      hasRefreshToken: !!doc.refreshToken,
      scopes: doc.scopes || [],
    });
  } catch (e) {
    res.status(500).json({ linked: false, error: e.message });
  }
});

router.delete("/:userId", async (req, res) => {
  try {
    await GoogleToken.deleteOne({ userId: req.params.userId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/startover/:userId", async (req, res) => {
  try {
    const doc = await GoogleToken.findOne({ userId: req.params.userId });
    if (doc?.accessToken) {
      try {
        await axios.post(
          "https://oauth2.googleapis.com/revoke",
          new URLSearchParams({ token: doc.accessToken }).toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
      } catch (e) {
        console.warn("Token revocation failed (may already be revoked):", e.message);
      }
    }
    await GoogleToken.deleteOne({ userId: req.params.userId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ───────────────────────── Reusable fetchers ──────────────────────── */

// tz-aware daily steps (bucket by local day)
async function fetchDailySteps(accessToken, startMs, endMs, timeZoneId = "UTC") {
  const body = {
    aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
    bucketByTime: { period: { type: "day", value: 1, timeZoneId } },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  };
  const { data } = await axios.post(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const map = new Map();
  (data.bucket || []).forEach((b) => {
    const key = dateKeyForTz(b.startTimeMillis, timeZoneId);
    const steps = b?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
    map.set(key, steps);
  });
  return map;
}

// exact steps sum in arbitrary window
async function fetchStepsSum(accessToken, startMs, endMs) {
  const body = {
    aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
    bucketByTime: { durationMillis: Math.max(1, endMs - startMs) },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  };
  const { data } = await axios.post(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const pts = data?.bucket?.[0]?.dataset?.[0]?.point || [];
  return pts.reduce((sum, p) => {
    const v = p.value?.[0];
    return sum + (v?.intVal ?? v?.fpVal ?? 0);
  }, 0);
}

async function fetchExerciseSessions(accessToken, startMs, endMs) {
  const { data: sessData } = await axios.get(
    "https://www.googleapis.com/fitness/v1/users/me/sessions",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
      },
    }
  );
  const sessions = Array.isArray(sessData?.session) ? sessData.session : [];
  return sessions
    .filter((s) => {
      const t = Number(s.activityType);
      return t !== 72; // exclude sleep
    })
    .map((s) => {
      const start = s.startTimeMillis
        ? Number(s.startTimeMillis)
        : Date.parse(s.startTime);
      const end = s.endTimeMillis
        ? Number(s.endTimeMillis)
        : Date.parse(s.endTime);
      const typeId = s.activityType || 73;
      return {
        id: s.id || String(start),
        name: s.name || getActivityName(typeId),
        activityType: getActivityName(typeId),
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        durationMinutes: Math.max(0, Math.round((end - start) / 60000)),
      };
    })
    .sort((a, b) => new Date(b.start) - new Date(a.start));
}

async function fetchAggregateSum(accessToken, dataTypeName, startMs, endMs) {
  const durationMillis = Math.max(1, endMs - startMs);
  const body = {
    aggregateBy: [{ dataTypeName }],
    bucketByTime: { durationMillis },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  };
  const { data } = await axios.post(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const points = data?.bucket?.[0]?.dataset?.[0]?.point || [];
  return points.reduce((sum, p) => {
    const v = p.value?.[0];
    return sum + (v?.fpVal ?? v?.intVal ?? 0);
  }, 0);
}

async function fetchLatestSample(accessToken, dataTypeName, startMs, endMs) {
  const body = {
    aggregateBy: [{ dataTypeName }]}
  ;
  // daily
  body.bucketByTime = { durationMillis: DAY_MS };
  body.startTimeMillis = startMs;
  body.endTimeMillis = endMs;

  const { data } = await axios.post(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const buckets = data.bucket || [];
  for (let i = buckets.length - 1; i >= 0; i--) {
    const points = buckets[i]?.dataset?.[0]?.point || [];
    for (let j = points.length - 1; j >= 0; j--) {
      const p = points[j];
      const val = p.value?.[0];
      const result = val?.fpVal ?? val?.intVal ?? null;
      if (result != null) return result;
    }
  }
  return null;
}

async function fetchRestingHR(accessToken, startMs, endMs) {
  const body = {
    aggregateBy: [{ dataTypeName: "com.google.heart_rate.bpm" }],
    bucketByTime: { durationMillis: 60 * 60 * 1000 }, // hourly
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  };
  const { data } = await axios.post(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const buckets = data.bucket || [];
  const vals = [];
  for (const b of buckets) {
    const pts = b.dataset?.[0]?.point || [];
    pts.forEach((p) => {
      const v = p.value?.[0]?.fpVal;
      if (v != null) vals.push(v);
    });
  }
  if (!vals.length) return null;
  vals.sort((a, b) => a - b);
  const cut = Math.max(1, Math.floor(vals.length * 0.1));
  const low = vals.slice(0, cut);
  const avg = low.reduce((s, x) => s + x, 0) / low.length;
  return Math.round(avg);
}

/** RAW nutrition datapoints (ns dataset id) -> daily merged */
async function fetchNutritionDaily(accessToken, startMs, endMs) {
  const DS_ID = "derived:com.google.nutrition:com.google.android.gms:merged";
  const datasetId = `${toNs(startMs)}-${toNs(endMs)}`;
  const url = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(
    DS_ID
  )}/datasets/${datasetId}`;

  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const byDay = new Map();

    const points = Array.isArray(data?.point) ? data.point : [];
    for (const p of points) {
      const startN = Number(p.startTimeNanos);
      const dayKey = dateKeyForTz(Math.floor(startN / 1_000_000), "UTC");
      const nutrientMap = (p.value || []).find((v) => Array.isArray(v.mapVal))
        ?.mapVal || [];
      if (!byDay.has(dayKey)) byDay.set(dayKey, {});
      const total = byDay.get(dayKey);
      for (const nv of nutrientMap) {
        const key = nv.key;
        const val = nv.value?.fpVal ?? 0;
        total[key] = (total[key] || 0) + val;
      }
    }
    return Array.from(byDay, ([date, nutrients]) => ({ date, nutrients }));
  } catch (e) {
    if (e.response?.status === 404) return [];
    throw e;
  }
}

/* ───────────────────────────── Data routes ─────────────────────────── */

router.get("/sleep/:userId", async (req, res) => {
  try {
    const accessToken = await ensureAccessToken(req.params.userId);
    const now = Date.now();
    const startMs = Number(req.query.startTime) || now - DEFAULT_RANGE_MS;
    const endMs = Number(req.query.endTime) || now;

    const { data: sessData } = await axios.get(
      "https://www.googleapis.com/fitness/v1/users/me/sessions",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          startTime: new Date(startMs).toISOString(),
          endTime: new Date(endMs).toISOString(),
          activityType: 72, // Sleep activity type
        },
      }
    );

    const sessions = Array.isArray(sessData?.session) ? sessData.session : [];
    const DS_ID = "derived:com.google.sleep.segment:com.google.android.gms:merged";
    const out = [];

    for (const s of sessions) {
      const sStart = s.startTimeMillis
        ? Number(s.startTimeMillis)
        : Date.parse(s.startTime);
      const sEnd = s.endTimeMillis
        ? Number(s.endTimeMillis)
        : Date.parse(s.endTime);
      if (isNaN(sStart) || isNaN(sEnd) || sStart >= sEnd) continue;

      let quality = 5;
      let awakeMs = 0, lightMs = 0, deepMs = 0, remMs = 0;

      try {
        const datasetId = `${toNs(sStart)}-${toNs(sEnd)}`;
        const url = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(
          DS_ID
        )}/datasets/${datasetId}`;
        const { data: ds } = await axios.get(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const pts = Array.isArray(ds?.point) ? ds.point : [];

        for (const p of pts) {
          const dMs = Math.round(
            (Number(p.endTimeNanos) - Number(p.startTimeNanos)) / 1_000_000
          );
          if (dMs <= 0) continue;
          const st = p.value?.[0]?.intVal; // 1 AWAKE, 4 LIGHT, 5 DEEP, 6 REM
          if (st === 1) awakeMs += dMs;
          else if (st === 4) lightMs += dMs;
          else if (st === 5) deepMs += dMs;
          else if (st === 6) remMs += dMs;
        }

        const asleepMs = lightMs + deepMs + remMs;
        const total = asleepMs + awakeMs;
        if (total > 0) {
          const eff = asleepMs / total;
          const rest = asleepMs ? (deepMs + remMs) / asleepMs : 0;
          let score = 5;
          if (eff >= 0.9) score += 2;
          if (rest >= 0.25) score += 2;
          if (asleepMs && deepMs / asleepMs >= 0.15) score += 1;
          quality = Math.min(10, Math.max(1, Math.round(score)));
        }
      } catch (e) {
        console.warn(`Sleep segments failed for session ${s.id}:`, e.message);
      }

      out.push({
        id: s.id || String(sStart),
        start: new Date(sStart).toISOString(),
        end: new Date(sEnd).toISOString(),
        duration: sEnd - sStart,
        quality,
        source: "googlefit",
        segments: { awakeMs, lightMs, deepMs, remMs },
      });
    }

    out.sort((a, b) => new Date(b.start) - new Date(a.start));
    res.set("Cache-Control", "no-store");
    res.json({ sleep: out });
  } catch (e) {
    const authErr = e.message.includes("No tokens for user") || e.message.includes("re-link");
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      sleep: [],
      timeout: false,
      error: authErr
        ? "Authentication required. Please re-link Google Fit."
        : "Failed to fetch sleep data.",
    });
  }
});

router.get("/health/steps/:userId", async (req, res) => {
  try {
    const accessToken = await ensureAccessToken(req.params.userId);
    const now = Date.now();
    const endMs = Number(req.query.endTime) || now;
    const startMs = Number(req.query.startTime) || endMs - DEFAULT_RANGE_MS;
    const tz = (req.query.tz || "UTC").trim();

    const map = await fetchDailySteps(accessToken, startMs, endMs, tz);
    const dateKeys = getDatesInRange(startMs, endMs, tz);

    const out = dateKeys.map((date) => ({
      date,
      value: map.get(date) ?? 0,
    }));

    res.set("Cache-Control", "no-store");
    res.json({ steps: out });
  } catch (e) {
    console.error("Error fetching steps:", e.message);
    const authErr = e.message.includes("No tokens for user") || e.message.includes("re-link");
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      steps: [],
      error: authErr
        ? "Authentication required. Please re-link Google Fit."
        : "Failed to fetch steps.",
    });
  }
});

router.get("/health/weight/:userId", async (req, res) => {
  try {
    const accessToken = await ensureAccessToken(req.params.userId);
    const now = Date.now();
    const endMs = Number(req.query.endTime) || now;
    const startMs = Number(req.query.startTime) || endMs - DEFAULT_RANGE_MS;

    const weightKg = await fetchLatestSample(
      accessToken,
      "com.google.weight",
      startMs,
      endMs
    );
    const weight =
      weightKg != null
        ? [{ date: dateKeyForTz(endMs, "UTC"), value: weightKg }]
        : [];

    res.set("Cache-Control", "no-store");
    res.json({ weight });
  } catch (e) {
    console.error("Error fetching weight:", e.message);
    const authErr = e.message.includes("No tokens for user") || e.message.includes("re-link");
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      weight: [],
      error: authErr
        ? "Authentication required. Please re-link Google Fit."
        : "Failed to fetch body metrics.",
    });
  }
});

router.get("/health/exercise/:userId", async (req, res) => {
  try {
    const accessToken = await ensureAccessToken(req.params.userId);
    const now = Date.now();
    const endMs = Number(req.query.endTime) || now;
    const startMs = Number(req.query.startTime) || endMs - DEFAULT_RANGE_MS;

    const exercise = await fetchExerciseSessions(accessToken, startMs, endMs);
    res.set("Cache-Control", "no-store");
    res.json({ exercise });
  } catch (e) {
    const authErr = e.message.includes("No tokens for user") || e.message.includes("re-link");
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      exercise: [],
      error: authErr
        ? "Authentication required. Please re-link Google Fit."
        : "Failed to fetch exercise.",
    });
  }
});

// (existing multi-day stress route remains unchanged)
router.get("/health/stress/:userId", async (req, res) => {
  try {
    const accessToken = await ensureAccessToken(req.params.userId);
    const now = Date.now();
    const endMs = Number(req.query.endTime) || now;
    const startMs = Number(req.query.startTime) || endMs - DEFAULT_RANGE_MS;
    const tz = (req.query.tz || "UTC").trim();

    const [dailyStepsMap, exerciseSessions] = await Promise.all([
      fetchDailySteps(accessToken, startMs, endMs, tz),
      fetchExerciseSessions(accessToken, startMs, endMs),
    ]);

    const dailySessions = new Map();
    exerciseSessions.forEach((s) => {
      const key = dateKeyForTz(new Date(s.start).getTime(), tz);
      dailySessions.set(key, (dailySessions.get(key) || 0) + 1);
    });

    const dateKeys = getDatesInRange(startMs, endMs, tz);
    const out = [];

    for (const date of dateKeys) {
      const steps = dailyStepsMap.get(date) || 0;
      const sessions = dailySessions.get(date) || 0;

      const maxSteps = 10000;
      const cappedSteps = Math.min(steps, maxSteps);

      let stressIndex = Math.max(0, 80 - cappedSteps / 100 - sessions * 15);
      const jitter =
        (date.charCodeAt(0) + date.charCodeAt(date.length - 1)) % 5;
      stressIndex = Math.min(100, Math.round(stressIndex + jitter));

      let confidence = 0;
      if (steps > 0 || sessions > 0) {
        confidence = Math.min(
          1,
          (steps / 5000) * 0.5 + (sessions > 0 ? 0.5 : 0)
        );
      } else {
        stressIndex = Math.min(100, Math.max(80, stressIndex));
        confidence = 0.1;
      }

      out.push({
        date,
        stressIndex,
        confidence: Number(confidence.toFixed(2)),
        steps,
        sessions,
      });
    }

    res.set("Cache-Control", "no-store");
    res.json({ dailyStressIndex: out });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    console.error("Stress index error:", msg);
    const authErr = msg.includes("No tokens for user") || msg.includes("re-link");
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      dailyStressIndex: [],
      error: authErr
        ? "Authentication required. Please re-link Google Fit."
        : "Failed to fetch stress index.",
    });
  }
});

// ✅ NEW: single-day, accurate only for that day (no jitter, no filler)
router.get("/health/stress/day/:userId", async (req, res) => {
  try {
    const accessToken = await ensureAccessToken(req.params.userId);

    const tz = (req.query.tz || "UTC").trim();
    const now = Date.now();
    const ts = Number(req.query.ts) || now;
    const dayKey = req.query.date || dateKeyForTz(ts, tz);

    const sod = startOfDayTz(new Date(`${dayKey}T12:00:00Z`).getTime(), tz);
    const eod = endOfDayTz(sod, tz);

    const [stepsMap, sessions] = await Promise.all([
      fetchDailySteps(accessToken, sod, eod, tz),
      fetchExerciseSessions(accessToken, sod, eod),
    ]);

    const steps = stepsMap.get(dayKey) || 0;
    const sessionsCount = sessions.filter(s =>
      dateKeyForTz(new Date(s.start).getTime(), tz) === dayKey
    ).length;

    // Deterministic formula (no jitter)
    const maxSteps = 10000;
    const effSteps = Math.min(steps, maxSteps);
    let stressIndex = 75 - Math.floor(effSteps / 120) - (sessionsCount * 22);
    stressIndex = Math.max(0, Math.min(100, stressIndex));

    // Confidence: signals presence driven
    let confidence = 0.1;
    if (steps > 0 || sessionsCount > 0) {
      const stepContrib = Math.min(0.7, steps / 7000);
      const sessContrib = Math.min(0.3, sessionsCount * 0.3);
      confidence = Math.max(0.1, Math.min(1, stepContrib + sessContrib));
    }

    res.set("Cache-Control", "no-store");
    return res.json({
      dayStress: {
        date: dayKey,
        stressIndex: Math.round(stressIndex),
        confidence: Number(confidence.toFixed(2)),
        steps,
        sessions: sessionsCount,
      }
    });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    const authErr = msg.includes("No tokens for user") || msg.includes("re-link");
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      dayStress: null,
      error: authErr
        ? "Authentication required. Please re-link Google Fit."
        : "Failed to fetch single-day stress."
    });
  }
});

/** Consolidated 24h metrics + latest samples — defensive & non-fatal */
router.get("/health/metrics/:userId", async (req, res) => {
  const safe = async (fn, def = null, label = "metric") => {
    try {
      return await fn();
    } catch (e) {
      console.warn(
        `[metrics] ${label} failed:`,
        e.response?.data?.error?.message || e.message
      );
      return def;
    }
  };

  try {
    const accessToken = await ensureAccessToken(req.params.userId);
    const now = Date.now();
    const endMs = Number(req.query.endTime) || now;
    const startMs24h = Number(req.query.startTime) || endMs - DAY_MS;
    const startMs30d = endMs - DEFAULT_RANGE_MS;

    const [
      steps24h,
      activeMins24h,
      caloriesOut24h,
      sleepMinutes24h,
      weightKg,
      heightM,
      restingHeartRate,
      vo2max,
      bodyFatPct,
    ] = await Promise.all([
      safe(() => fetchStepsSum(accessToken, startMs24h, endMs), 0, "steps24h"),
      safe(
        () => fetchAggregateSum(accessToken, "com.google.active_minutes", startMs24h, endMs),
        0,
        "activeMins24h"
      ),
      safe(
        () => fetchAggregateSum(accessToken, "com.google.calories.expended", startMs24h, endMs),
        0,
        "caloriesOut24h"
      ),
      safe(async () => {
        const { data: sessData } = await axios.get(
          "https://www.googleapis.com/fitness/v1/users/me/sessions",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
              startTime: new Date(startMs24h).toISOString(),
              endTime: new Date(endMs).toISOString(),
              activityType: 72,
            },
          }
        );
        const sessions = Array.isArray(sessData?.session) ? sessData.session : [];
        return sessions.reduce((m, s) => {
          const st = s.startTimeMillis
            ? Number(s.startTimeMillis)
            : Date.parse(s.startTime);
          const et = s.endTimeMillis
            ? Number(s.endTimeMillis)
            : Date.parse(s.endTime);
          const clip = Math.max(0, Math.min(et, endMs) - Math.max(st, startMs24h));
          return m + Math.round(clip / 60000);
        }, 0);
      }, 0, "sleepMinutes24h"),
      safe(() => fetchLatestSample(accessToken, "com.google.weight", startMs30d, endMs), null, "weightKg"),
      safe(() => fetchLatestSample(accessToken, "com.google.height", startMs30d, endMs), null, "heightM"),
      safe(() => fetchRestingHR(accessToken, startMs24h, endMs), null, "restingHeartRate"),
      safe(() => fetchLatestSample(accessToken, "com.google.vo2max", startMs30d, endMs), null, "vo2max"),
      safe(
        () => fetchLatestSample(accessToken, "com.google.body.fat.percentage", startMs30d, endMs),
        null,
        "bodyFatPct"
      ),
    ]);

    const heightCm = heightM != null ? Math.round(heightM * 100) : null;

    res.set("Cache-Control", "no-store");
    return res.json({
      metrics: {
        steps24h: Math.round(steps24h),
        activeMins24h: Math.round(activeMins24h || 0),
        caloriesOut24h: Math.round(caloriesOut24h || 0),
        sleepMinutes24h,
        weightKg: weightKg ?? null,
        heightCm: heightCm ?? null,
        restingHeartRate: restingHeartRate ?? null,
        vo2max: vo2max ?? null,
        bodyFatPct: bodyFatPct ?? null,
      },
    });
  } catch (e) {
    const authErr =
      e.message.includes("No tokens for user") || e.message.includes("re-link");
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      metrics: {},
      error: authErr
        ? "Authentication required. Please re-link Google Fit."
        : "Failed to fetch metrics.",
    });
  }
});

/** NEW: nutrition route used by the frontend provider */
router.get("/health/nutrition/:userId", async (req, res) => {
  try {
    const accessToken = await ensureAccessToken(req.params.userId);
    const now = Date.now();
    const startMs = Number(req.query.startTime) || now - DEFAULT_RANGE_MS;
    const endMs = Number(req.query.endTime) || now;

    const nutrition = await fetchNutritionDaily(accessToken, startMs, endMs);
    res.set("Cache-Control", "no-store");
    res.json({ nutrition });
  } catch (e) {
    const authErr = e.message.includes("No tokens for user") || e.message.includes("re-link");
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      nutrition: [],
      error: authErr
        ? "Authentication required. Please re-link Google Fit."
        : "Failed to fetch nutrition.",
    });
  }
});

/* ───────────── Gemini proxy (v1beta) with model fallbacks + debug ───────────── */

const GEMINI_API_KEY = envStr("GEMINI_API_KEY", ""); // set in .env
const GEMINI_API_VER = "v1beta";

const MODEL_CANDIDATES = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-flash-002",
  "gemini-pro",
];

const maskKey = (k = "") =>
  k ? k.slice(0, 6) + "…(hidden)…" + k.slice(-4) : "";

router.get("/api/ai/debug", async (req, res) => {
  try {
    const key = (req.query.apiKey || GEMINI_API_KEY || "").trim();
    if (!key) return res.status(500).json({ ok: false, error: "Missing API key" });

    const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VER}/models?key=${encodeURIComponent(
      key
    )}`;
    const upstream = await axios.get(url, {
      timeout: 15000,
      validateStatus: () => true,
    });

    return res.status(upstream.status).json({
      ok: upstream.status >= 200 && upstream.status < 300,
      status: upstream.status,
      usingKey: maskKey(key),
      modelsCount: Array.isArray(upstream.data?.models) ? upstream.data.models.length : 0,
      sampleModels: (upstream.data?.models || []).slice(0, 8).map(m => m.name),
      rawError: upstream.data?.error || null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
      upstreamStatus: e.response?.status || null,
      upstreamData: e.response?.data || null,
    });
  }
});

router.post("/api/ai/gemini", async (req, res) => {
  try {
    const { prompt, model, apiKey } = req.body || {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Missing or invalid 'prompt' string" });
    }

    const KEY = (apiKey || GEMINI_API_KEY || "").trim();
    if (!KEY) return res.status(500).json({ error: "No Gemini API key configured." });

    const candidates = model
      ? [String(model).trim(), ...MODEL_CANDIDATES.filter(m => m !== model)]
      : MODEL_CANDIDATES.slice();

    let last = null;

    for (const mdl of candidates) {
      const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VER}/models/${encodeURIComponent(
        mdl
      )}:generateContent?key=${encodeURIComponent(KEY)}`;

      const body = {
        contents: [{ role: "user", parts: [{ text: String(prompt) }] }],
      };

      const upstream = await axios.post(url, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
        validateStatus: () => true,
      });

      if (upstream.status >= 200 && upstream.status < 300) {
        const text =
          upstream.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          upstream.data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("\n");
        if (text) return res.json({ ok: true, model: mdl, text });
        last = upstream;
        continue;
      }

      // Try next candidate on model not found / bad request
      if (upstream.status === 404 || upstream.status === 400) {
        last = upstream;
        continue;
      }

      // Hard fail on other statuses
      return res.status(upstream.status).json({
        ok: false,
        error: upstream.data?.error?.message || "Upstream error",
        upstreamStatus: upstream.status,
        triedModel: mdl,
      });
    }

    return res.status(last?.status || 502).json({
      ok: false,
      error: last?.data?.error?.message || "No Gemini model responded with content",
      upstreamStatus: last?.status || null,
      triedModels: candidates,
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error:
        e.response?.data?.error?.message ||
        e.response?.data?.message ||
        e.message ||
        "Gemini request failed",
      upstreamStatus: e.response?.status || null,
      upstreamData: e.response?.data || null,
    });
  }
});


export default router;
