import React, { useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Container, Row, Col, Card, ProgressBar, Badge, Button, Spinner, Alert } from "react-bootstrap";
import styles from "./ReportPage.module.css";
import { AppDataContext } from "../../../App";
import { GoogleFitContext } from "../../../context/GoogleFitProvider";
import { Moon, Brain, Heart, Activity, RefreshCcw, Smile } from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { StressAPI } from "../../../api/stress.api";

/* ─────────────────────────── API helpers ─────────────────────────── */
const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  "" ||
  "http://localhost:7000";

const getToken = () =>
  localStorage.getItem("admin_token") ||
  localStorage.getItem("auth_token") ||
  localStorage.getItem("token") || "";

async function apiFetch(path, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: "include" });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status} on ${path}`);
  return data ?? {};
}

/* ─────────────────────────── Utils ─────────────────────────── */
function formatDuration(ms) {
  const totalSec = Math.round((ms || 0) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

const LOCAL_TZ = "Asia/Kolkata";
const toDateKey = (ms) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: LOCAL_TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Number(ms)));

/* ─────────────────────────── Normalizers ─────────────────────────── */
const normalizeSleep = (raw) => {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.rows) ? raw.rows
    : Array.isArray(raw?.sleep) ? raw.sleep
    : [];
  return rows.map((s) => ({
    start: s.start || s.startedAt || s.dateStart || s.timestamp || s.begin || s._start,
    end: s.end || s.endedAt || s.dateEnd || s._end,
    duration: typeof s.duration === "number"
      ? s.duration
      : (s.end && s.start ? (new Date(s.end) - new Date(s.start)) : 0),
    quality: s.quality ?? s.score ?? undefined,
    soundId: s.soundId,
    source: s.source || s.provider || undefined,
  })).filter((r) => r.start);
};

const normalizeStress = (raw) => {
  if (Array.isArray(raw)) {
    const out = {};
    raw.forEach((it) => {
      const dateKey = (it.date || it.day || it.createdAt || it.timestamp || "").slice(0, 10);
      if (!dateKey) return;
      out[dateKey] = out[dateKey] || { stress: [] };
      if (Array.isArray(it.stress)) out[dateKey].stress.push(...it.stress);
      else if (it.category) out[dateKey].stress.push({ category: it.category, level: it.level ?? it.score ?? 1 });
    });
    return out;
  }
  return raw && typeof raw === "object" ? raw : {};
};

const normalizeCtxStressData = (ctx = {}) => {
  const out = {};
  if (ctx.manual && typeof ctx.manual === "object") {
    Object.entries(ctx.manual).forEach(([date, day]) => {
      const list = Array.isArray(day?.stress) ? day.stress : [];
      if (!out[date]) out[date] = { stress: [] };
      list.forEach((s) => {
        if (!s?.category) return;
        out[date].stress.push({ category: s.category, level: Number(s.intensity) || undefined });
      });
    });
  }
  if (ctx._gfNotes && typeof ctx._gfNotes === "object") {
    Object.entries(ctx._gfNotes).forEach(([date, day]) => {
      const notes = Array.isArray(day?.notes) ? day.notes : [];
      if (!out[date]) out[date] = { stress: [] };
      notes.forEach((n) => {
        if (!n?.category) return;
        let level;
        if (Number.isFinite(n.stressIndex)) level = Math.max(1, Math.min(10, Math.round(n.stressIndex / 10)));
        out[date].stress.push({ category: n.category, level });
      });
    });
  }
  return out;
};

const normalizeStressStore = (items = []) => {
  const out = {};
  items.forEach((it) => {
    const d = (it?.date || "").slice(0, 10);
    if (!d) return;
    out[d] = out[d] || { stress: [] };

    const m = it?.manual;
    if (m?.stress && Array.isArray(m.stress)) {
      m.stress.forEach((s) => {
        if (!s?.category) return;
        out[d].stress.push({ category: s.category, level: Number(s.intensity) || undefined });
      });
    }

    const gf = it?.gf;
    if (gf?.notes && Array.isArray(gf.notes)) {
      gf.notes.forEach((n) => {
        if (!n?.category) return;
        let level;
        if (Number.isFinite(n.stressIndex)) level = Math.max(1, Math.min(10, Math.round(n.stressIndex / 10)));
        out[d].stress.push({ category: n.category, level });
      });
    }
  });
  return out;
};

const mergeStressObjects = (a = {}, b = {}) => {
  const dates = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = {};
  dates.forEach((d) => {
    const sa = a[d]?.stress || [];
    const sb = b[d]?.stress || [];
    out[d] = { stress: [...sa, ...sb] };
  });
  return out;
};

const normalizeMood = (raw) => {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.rows) ? raw.rows
    : Array.isArray(raw?.mood) ? raw.mood
    : Array.isArray(raw?.data) ? raw.data
    : [];
  return rows
    .map((r) => ({
      date: (r.date || r.day || r.createdAt || "").slice(0, 10),
      mood: Number(r.mood ?? r.moodValue ?? r.value),
      tags: r.tags || [],
      note: r.note || "",
      createdAt: r.createdAt || r._createdAt || null,
    }))
    .filter((r) => r.date && Number.isFinite(r.mood) && r.mood >= 1 && r.mood <= 5);
};

const toDailyMoodMap = (rows = []) => {
  const byDate = new Map();
  rows.forEach((r) => {
    const dk = r.date.slice(0, 10);
    byDate.set(dk, r);
  });
  return byDate;
};

/* ─────────────────────────── Component ─────────────────────────── */
export default function ReportPage() {
  const {
    sleepData: ctxSleep = [],
    stressData: ctxStress = {},
    moodEntries: ctxMood = [],
  } = useContext(AppDataContext) || {};

  const gf = useContext(GoogleFitContext) || {};
  const { account, steps = [], exercise = [], metrics = {}, refreshSteps, refreshExercise } = gf;

  const [sleepRows, setSleepRows] = useState(ctxSleep);
  const [stressObj, setStressObj] = useState(ctxStress);
  const [fitSteps, setFitSteps] = useState(steps);
  const [fitExercise, setFitExercise] = useState(exercise);
  const [moodRows, setMoodRows] = useState(() => normalizeMood(ctxMood));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisJson, setAnalysisJson] = useState(null);

  /* ── Freeze time range once ── */
  const DAY_MS = 24 * 60 * 60 * 1000;
  const { startMs, endMs } = useMemo(() => {
    const end = Date.now();
    return { startMs: end - 30 * DAY_MS, endMs: end };
  }, []);
  const storeStart = useMemo(() => toDateKey(startMs), [startMs]);
  const storeEnd = useMemo(() => toDateKey(endMs), [endMs]);

  /* ─────────────────────────── Load last-30 days (sleep + stress + mood) ─────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const qs = `?start=${new Date(startMs).toISOString()}&end=${new Date(endMs).toISOString()}`;
      try {
        const [sleepA, moodA, stressApi, stressStore] = await Promise.all([
          apiFetch(`/api/sleep${qs}`).catch(() => ctxSleep),
          apiFetch(`/api/mood${qs}`).catch(() => apiFetch(`/api/mood`)).catch(() => ({ mood: ctxMood })),
          apiFetch(`/api/stress${qs}`).catch(() =>
            apiFetch(`/api/stress/recent?limit=400`).catch(() => ({}))
          ),
          StressAPI.listRange(storeStart, storeEnd).catch(() => []),
        ]);
        if (cancelled) return;

        setSleepRows(normalizeSleep(sleepA));

        const stressFromStore = normalizeStressStore(stressStore);
        const stressFromCtx = normalizeCtxStressData(ctxStress);
        const stressFromApi = normalizeStress(stressApi);
        setStressObj(mergeStressObjects(mergeStressObjects(stressFromStore, stressFromCtx), stressFromApi));

        const moodNorm = normalizeMood(moodA);
        setMoodRows(moodNorm.length ? moodNorm : normalizeMood(ctxMood));

        const gfit = [];
        if (typeof refreshSteps === "function") gfit.push(refreshSteps(startMs, endMs, LOCAL_TZ).catch(() => null));
        if (typeof refreshExercise === "function") gfit.push(refreshExercise(startMs, endMs).catch(() => null));
        await Promise.allSettled(gfit);

        setFitSteps((prev) => (Array.isArray(steps) && steps.length ? steps : prev));
        setFitExercise((prev) => (Array.isArray(exercise) && exercise.length ? exercise : prev));
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMs, endMs, storeStart, storeEnd]);

  /* ─────────────────────────── Computed stats ─────────────────────────── */
  const sleepStats = useMemo(() => {
    const totalMs = (sleepRows || []).reduce(
      (acc, s) => acc + (typeof s.duration === "number"
        ? s.duration
        : (s.end && s.start ? new Date(s.end) - new Date(s.start) : 0)),
      0
    );
    const goalHours = 8;
    const percent = Math.min(100, Math.round((totalMs / (goalHours * 3600 * 1000)) * 100));
    const suggestion =
      percent < 75
        ? "Sleep duration appears below the healthy range. Consider a consistent wind-down routine."
        : "Healthy sleep consistency — keep it up.";
    return { totalMs, goalHours, percent, suggestion };
  }, [sleepRows]);

  const stressStats = useMemo(() => {
    const categories = {};
    Object.values(stressObj || {}).forEach((day) => {
      if (day?.stress) {
        day.stress.forEach((s) => {
          if (s.category) categories[s.category] = (categories[s.category] || 0) + 1;
        });
      }
    });
    const highStressCategories = Object.entries(categories)
      .filter(([, count]) => count > 2)
      .map(([name, count]) => ({ name, count }));
    const suggestion =
      highStressCategories.length > 0
        ? `Frequent triggers noted in: ${highStressCategories.map((c) => c.name).join(", ")}. Try short decompression breaks.`
        : "Stress looks manageable overall.";
    return { categories, highStressCategories, suggestion };
  }, [stressObj]);

  const stressTrend = useMemo(() => {
    const series = [];
    let sum = 0, n = 0;
    for (let t = startMs; t <= endMs; t += DAY_MS) {
      const key = toDateKey(t);
      const day = stressObj[key];
      let level = null;

      if (day?.stress?.length) {
        const vals = day.stress
          .map((s) => Number(s.level))
          .filter((v) => Number.isFinite(v) && v > 0);
        if (vals.length) level = Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10;
      }

      if (Number.isFinite(level)) {
        sum += level; n += 1;
      }
      series.push({ day: key.slice(5), level });
    }

    const last7 = series.slice(-7).map((d) => d.level).filter((v) => Number.isFinite(v));
    const avg7 = last7.length ? (last7.reduce((a, v) => a + v, 0) / last7.length) : 0;
    const avg = n ? (sum / n) : 0;

    return { series, avg, avg7 };
  }, [stressObj, startMs, endMs]);

  const moodDailyMap = useMemo(() => toDailyMoodMap(moodRows), [moodRows]);

  const moodChartData = useMemo(() => {
    const out = [];
    for (let t = startMs; t <= endMs; t += DAY_MS) {
      const key = toDateKey(t);
      const row = moodDailyMap.get(key);
      out.push({ day: key.slice(5), mood: row?.mood ?? null });
    }
    return out;
  }, [moodDailyMap, startMs, endMs]);

  const moodStats = useMemo(() => {
    const vals = moodChartData.map((d) => d.mood).filter((v) => Number.isFinite(v));
    const avg = vals.length ? (vals.reduce((a, v) => a + v, 0) / vals.length) : 0;
    const last7 = moodChartData.slice(-7).map((d) => d.mood).filter((v) => Number.isFinite(v));
    const avg7 = last7.length ? (last7.reduce((a, v) => a + v, 0) / last7.length) : 0;

    let best = null, worst = null;
    moodChartData.forEach((d) => {
      if (!Number.isFinite(d.mood)) return;
      if (!best || d.mood > best.value) best = { day: d.day, value: d.mood };
      if (!worst || d.mood < worst.value) worst = { day: d.day, value: d.mood };
    });

    const target = 4.0;
    const percent = Math.max(0, Math.min(100, Math.round((avg / 5) * 100)));
    const suggestion =
      avg < target
        ? "Mood trend is slightly below neutral. Consider brief gratitude notes and a 10-minute daylight walk."
        : "Mood trend is positive — continue reinforcing helpful routines.";
    return { avg, avg7, best, worst, percent, suggestion };
  }, [moodChartData]);

  const insights = useMemo(() => {
    const arr = [];
    if (sleepStats.percent < 75) arr.push("Sleep duration below target may be affecting daytime balance.");
    if (stressStats.highStressCategories.length > 0) arr.push("Recurring stress triggers observed in daily patterns.");
    if (moodStats.avg && moodStats.avg < 3.2) arr.push("Average mood is slightly low; supportive habits recommended.");
    if (!arr.length) arr.push("Overall metrics look stable — maintain current practices.");
    return arr;
  }, [sleepStats, stressStats, moodStats]);

  // combine any generated insights into Key Observations only
  const combinedInsights = useMemo(() => {
    const generated = Array.isArray(analysisJson?.insights) ? analysisJson.insights : [];
    return [...insights, ...generated];
  }, [insights, analysisJson]);

  const recommended = useMemo(() => ([
    ...(sleepStats.percent < 75 ? ["Establish a fixed wind-down window and consistent bedtime."] : []),
    ...(stressStats.highStressCategories.length ? ["Use brief breathing/journaling sessions after stressful blocks."] : []),
    ...(moodStats.avg < 3.2 ? ["Daily 3-item gratitude, 10-minute sunlight walk, and a short breathing drill."] : []),
  ]), [sleepStats, stressStats, moodStats]);

  /* ─────────────────────────── Activity summary ─────────────────────────── */
  const fitSummary = useMemo(() => {
    const stepsByDay = {};
    (fitSteps || []).forEach((b) => {
      const key = b?.date || toDateKey(b?.start || b?.end || Date.now());
      stepsByDay[key] = (stepsByDay[key] || 0) + (Number(b?.value) || 0);
    });
    const todayKey = toDateKey(Date.now());
    const live = Number(metrics?.steps24h) || 0;
    if (live > 0) stepsByDay[todayKey] = Math.max(stepsByDay[todayKey] || 0, live);

    const sessions = (fitExercise || []).map((s) => ({
      start: s.start || s.startedAt,
      end: s.end || s.endedAt,
      durationMinutes:
        typeof s?.durationMinutes === "number"
          ? s.durationMinutes
          : Math.max(0, Math.round(((new Date(s.end || 0) - new Date(s.start || 0)) / 60000))),
      type: s.activityType || s.source || "activity",
    }));

    const totalSteps = Object.values(stepsByDay).reduce((a, v) => a + v, 0);
    const totalMinutes = sessions.reduce((a, s) => a + (s.durationMinutes || 0), 0);

    return { stepsByDay, sessions, totals: { totalSteps, totalMinutes } };
  }, [fitSteps, fitExercise, metrics]);

  /* ─────────────────────────── Analysis input & call ─────────────────────────── */
  const analysisInput = useMemo(() => ({
    timeframe: { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString(), tz: LOCAL_TZ },
    user: { googleFitLinked: !!account?.linked, accountName: account?.name || account?.email || null },
    sleep: {
      rows: (sleepRows || []).map((s) => ({
        start: s.start, end: s.end, durationMs: s.duration, quality: s.quality, soundId: s.soundId, source: s.source,
      })),
    },
    stress: stressObj,
    mood: {
      avg: Number(moodStats.avg?.toFixed?.(2) ?? 0),
      last7Avg: Number(moodStats.avg7?.toFixed?.(2) ?? 0),
      best: moodStats.best,
      worst: moodStats.worst,
      series: moodChartData,
    },
    activity: fitSummary,
    computed: {
      sleepPercentVs8h: sleepStats.percent,
      avgMood: Number(moodStats.avg?.toFixed?.(2) ?? 0),
      highStressCategories: stressStats.highStressCategories || [],
    },
    ask: {
      goals: [
        "Summarize sleep, stress, mood, and activity patterns succinctly.",
        "Highlight the top issues blocking mental wellness.",
        "Give 5 actionable, personalized recommendations (1 week plan).",
        "Return JSON fields: insights[], recommendations[], riskFlags[], summary.",
      ],
    },
  }), [
    startMs, endMs, account, sleepRows, stressObj,
    moodStats, moodChartData, fitSummary, sleepStats, stressStats
  ]);

  const analysisInFlight = useRef(false);

  const runAnalysis = useCallback(async (payload) => {
    if (analysisInFlight.current) return;
    analysisInFlight.current = true;
    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysisJson(null);
    try {
      const res = await apiFetch("/api/ai/analyze", {
        method: "POST",
        body: JSON.stringify({
          model: "gemini-1.5-pro",
          system:
            "You are a compassionate mental-wellness analyst. Be specific, practical, and evidence-informed. If data is sparse, state limitations briefly.",
          input: payload,
        }),
      });
      if (res?.json) setAnalysisJson(res.json);
    } catch (e) {
      setAnalysisError(e.message || "Summary generation failed.");
    } finally {
      setAnalysisLoading(false);
      analysisInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!loading && analysisInput) runAnalysis(analysisInput);
  }, [loading, analysisInput, runAnalysis]);

  /* ───────── Debug counts (optional) ───────── */
  const sleepCount = useMemo(() => (Array.isArray(sleepRows) ? sleepRows.length : 0), [sleepRows]);

  /* ─────────────────────────── Render ─────────────────────────── */
  return (
    <Container fluid className={`${styles.reportContainer} text-start`}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h2 className={styles.title}>🩺 Wellness Report</h2>
        <Button
          size="sm"
          variant="outline-primary"
          onClick={() => runAnalysis(analysisInput)}
          disabled={analysisLoading || loading}
          className={styles.ctaButton}
        >
          <RefreshCcw size={16} className="me-1" />
          {analysisLoading ? "Updating…" : "Re-run Summary"}
        </Button>
      </div>

      <p className={`${styles.subtitle} text-start`}>
        A professional overview of sleep quality, stress trends, mood, and activity over the last 30 days.
      </p>

      {!loading && (
        <div className="small text-muted mb-2">
          Debug — sleep: {sleepCount}
          {" | "}stress days: {Object.keys(stressObj || {}).length}
          {" | "}mood pts: {moodRows?.length || 0}
          {analysisError ? ` | Summary: ${analysisError}` : ""}
        </div>
      )}

      {loading && (
        <Alert variant="light" className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" /> Loading last 30 days…
        </Alert>
      )}
      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="gy-4">
        {/* Sleep */}
        <Col md={6} lg={4}>
          <Card className={styles.card}>
            <Card.Body className="text-start">
              <div className={styles.cardHeader}>
                <Moon className={styles.iconSleep} size={22} />
                <Card.Title className={styles.sectionTitle}>Sleep</Card.Title>
              </div>
              <ProgressBar now={sleepStats.percent} label={`${sleepStats.percent}%`} className={styles.progress} />
              <p>Total Sleep: {formatDuration(sleepStats.totalMs)}</p>
              <p className={styles.suggestion}>{sleepStats.suggestion}</p>
              {sleepRows?.length > 1 && (
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={(sleepRows || []).map((s, i) => {
                    const dur = typeof s.duration === "number"
                      ? s.duration
                      : (s.end && s.start ? new Date(s.end) - new Date(s.start) : 0);
                    return { day: `Day ${i + 1}`, hours: Math.max(0, Math.round(dur / 3600000)) };
                  })}>
                    <defs>
                      <linearGradient id="sleepColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4b6aff" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#4b6aff" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="hours" stroke="#4b6aff" fillOpacity={1} fill="url(#sleepColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Stress */}
        <Col md={6} lg={4}>
          <Card className={styles.card}>
            <Card.Body className="text-start">
              <div className={styles.cardHeader}>
                <Brain className={styles.iconStress} size={22} />
                <Card.Title className={styles.sectionTitle}>Stress</Card.Title>
              </div>

              <div className="d-flex align-items-center gap-3 mb-2">
                <Badge bg="danger">Avg: {stressTrend.avg ? stressTrend.avg.toFixed(1) : "-"}</Badge>
                <Badge bg="secondary">Last 7d: {stressTrend.avg7 ? stressTrend.avg7.toFixed(1) : "-"}</Badge>
              </div>

              <div className={styles.badgeGroup}>
                {Object.entries(stressStats.categories).map(([name, count]) => (
                  <Badge key={name} bg={count > 2 ? "danger" : "secondary"} className={styles.badge}>
                    {name} ({count})
                  </Badge>
                ))}
                {!Object.keys(stressStats.categories).length && (
                  <span className="text-muted small">No stress logs found.</span>
                )}
              </div>

              {stressTrend.series.length > 0 && (
                <div className="mt-2" style={{ height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stressTrend.series}>
                      <defs>
                        <linearGradient id="stressColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" />
                      <YAxis domain={[0, 10]} ticks={[0,2,4,6,8,10]} />
                      <Tooltip />
                      <Area type="monotone" dataKey="level" stroke="#ef4444" fillOpacity={1} fill="url(#stressColor)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className={`${styles.suggestion} mt-2`}>
                {stressStats.suggestion}
              </p>
            </Card.Body>
          </Card>
        </Col>

        {/* Mood */}
        <Col md={12} lg={4}>
          <Card className={styles.card}>
            <Card.Body className="text-start">
              <div className={styles.cardHeader}>
                <Smile className={styles.iconHeart} size={22} />
                <Card.Title className={styles.sectionTitle}>Mood</Card.Title>
              </div>

              <div className="d-flex align-items-center gap-3 mb-2">
                <Badge bg="info">Avg: {moodStats.avg ? moodStats.avg.toFixed(2) : "-"}</Badge>
                <Badge bg="secondary">Last 7d: {moodStats.avg7 ? moodStats.avg7.toFixed(2) : "-"}</Badge>
                {moodStats.best && <Badge bg="success">Best: {moodStats.best.value} ({moodStats.best.day})</Badge>}
                {moodStats.worst && <Badge bg="danger">Low: {moodStats.worst.value} ({moodStats.worst.day})</Badge>}
              </div>

              <ProgressBar now={moodStats.percent} label={`${moodStats.percent}%`} className={styles.progress} />
              <p className={styles.suggestion}>{moodStats.suggestion}</p>

              {moodChartData.length > 0 && (
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={moodChartData}>
                    <defs>
                      <linearGradient id="moodColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#36a2eb" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#36a2eb" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="mood" stroke="#36a2eb" fillOpacity={1} fill="url(#moodColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Key Observations (Insights live here) */}
      <Card className={styles.insightsCard}>
        <Card.Body className="text-start">
          <div className={styles.cardHeader}>
            <Activity className={styles.iconInsight} size={22} />
            <Card.Title className={styles.sectionTitle}>Key Observations</Card.Title>
          </div>
          <div className={styles.insightsBody}>
            {combinedInsights.length ? (
              <ul className={styles.insightsList}>
                {combinedInsights.map((ins, i) => <li key={i}>{ins}</li>)}
              </ul>
            ) : (
              <p className="text-muted mb-0">No notable observations for this period.</p>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Summary & Recommendations (no Insights and no Narrative section here) */}
      <Card className={styles.recommendCard}>
        <Card.Body className={`${styles.summaryBody} text-start`}>
          <div className={styles.cardHeader}>
            <Heart className={styles.iconHeart} size={22} />
            <Card.Title className={styles.sectionTitle}>Summary & Recommendations</Card.Title>
          </div>

          {analysisLoading && (
            <div className={`${styles.mutedRow} d-flex align-items-center gap-2`}>
              <Spinner animation="border" size="sm" /> Generating the latest summary…
            </div>
          )}
          {analysisError && <Alert variant="danger" className={styles.blockBelow}>{analysisError}</Alert>}

          {analysisJson && (
            <>
              {Array.isArray(analysisJson.recommendations) && analysisJson.recommendations.length > 0 && (
                <>
                  <h6 className={styles.subheading}>Action Plan (Next 7 Days)</h6>
                  <ul className={styles.recommendList}>
                    {analysisJson.recommendations.map((x, i) => <li key={`rec-${i}`}>{x}</li>)}
                  </ul>
                </>
              )}

              {Array.isArray(analysisJson.riskFlags) && analysisJson.riskFlags.length > 0 && (
                <>
                  <h6 className={`${styles.subheading} ${styles.attention}`}>Attention Points</h6>
                  <ul className={styles.recommendList}>
                    {analysisJson.riskFlags.map((x, i) => <li key={`risk-${i}`}>{x}</li>)}
                  </ul>
                </>
              )}

              {analysisJson.summary && (
                <>
                  <h6 className={styles.subheading}>Overall Summary</h6>
                  <p className={styles.textBlock}>{analysisJson.summary}</p>
                </>
              )}
            </>
          )}

          {!analysisLoading && !analysisError && !analysisJson && (
            <>
              {recommended.length > 0 ? (
                <>
                  <h6 className={styles.subheading}>Suggested Next Steps</h6>
                  <ul className={styles.recommendList}>
                    {recommended.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </>
              ) : (
                <p className={styles.textBlock}>Current metrics look healthy. Maintain your routine and review again in a week.</p>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      <p className={styles.footerNote}>
        💬 Consistency compounds. Small, repeatable actions deliver the biggest long-term benefits.
      </p>
    </Container>
  );
}
