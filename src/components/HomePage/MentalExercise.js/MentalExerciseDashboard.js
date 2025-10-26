// src/components/Exercise/MentalExerciseDashboard.jsx
import React, {
  useMemo, useState, useContext, useEffect, useCallback, useRef,
} from "react";
import {
  Container, Col, Row, Modal, Button, Tabs, Tab, Badge, Card, Spinner, ProgressBar,
  Toast, ToastContainer,
} from "react-bootstrap";
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { BsFillPlayFill, BsArrowRepeat, BsCheckCircleFill, BsLink45Deg } from "react-icons/bs";
import { FaRunning, FaShoePrints, FaHourglassHalf } from "react-icons/fa";

import MentalExerciseVideo from "../../Video/MentalExercise.mp4";
import BreathingImg from "../../images/Exercise.png";
// If your file is actually "MentalExerciseDashboard.module.css", update this import.
import classes from "./MenalExerciseDashboard.module.css";
import { GoogleFitContext } from "../../../context/GoogleFitProvider";

/* ---------------- Constants ---------------- */
const STEP_GOAL = 10000;
const MINUTE_GOAL = 30;
const LOCAL_TZ = "Asia/Kolkata";

// Rewards
const STEP_THRESHOLD = 5000;
const EXERCISE_MINUTES_THRESHOLD = 60;
const POINTS_PER_QUALIFYING_DAY = 10;
const CHALLENGE_DAYS = 30;
const MONTHLY_BONUS_POINTS = 100;

/* ---------------- Helpers ---------------- */
const toDateKeyTz = (d, tz = LOCAL_TZ) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d)); // YYYY-MM-DD

const fmtMD = (yyyyMmDd, tz = LOCAL_TZ) =>
  new Date(`${yyyyMmDd}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: tz,
  });

const minutesBetween = (startISO, endISO) => {
  const a = new Date(startISO).getTime();
  const b = new Date(endISO).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 60000);
};

const lastNDates = (n, tz = LOCAL_TZ) => {
  const todayKey = toDateKeyTz(Date.now(), tz);
  const base = new Date(`${todayKey}T00:00:00`);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    out.push(toDateKeyTz(d, tz));
  }
  return out;
};

function getLocalToken() {
  return (
    localStorage.getItem("admin_token")
    || localStorage.getItem("auth_token")
    || localStorage.getItem("token")
    || ""
  );
}

// GET helper that never throws to the UI
async function getJSONSafe(url) {
  try {
    const token = getLocalToken();
    const r = await fetch(url, {
      method: "GET",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: "include",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  } catch (e) {
    return { ok: false, error: e?.message || "Request failed" };
  }
}

// POST helper that never throws to the UI
async function postJSONSafe(url, body) {
  try {
    const token = getLocalToken();
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      // ignore parse error
    }
    if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  } catch (e) {
    return { ok: false, error: e?.message || "Request failed" };
  }
}

/* ---------------- Radial Progress ---------------- */
const RadialProgressChart = ({ data, title, color }) => {
  const { uv: pct, displayValue, displayUnit, goal } = data?.[0] || {
    uv: 0, displayValue: 0, displayUnit: "", goal: 0,
  };
  const met = pct >= 100;
  return (
    <Card className={`h-100 shadow-sm ${classes.statCard}`}>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h5 className="card-title mb-0">{title}</h5>
          <Badge bg={met ? "success" : "info"} className="p-2">
            Goal: {goal} {displayUnit.includes("%") ? "" : displayUnit}
          </Badge>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            barSize={20}
            data={data}
            startAngle={90}
            endAngle={450}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar minAngle={15} background={{ fill: "#eee" }} clockWise dataKey="uv" fill={color} angleAxisId={0} />
            <Tooltip
              formatter={(_val, _name, props) => [
                `${props?.payload?.displayValue ?? 0} ${props?.payload?.displayUnit ?? ""}`,
                "Total",
              ]}
              labelFormatter={() => null}
            />
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: "2rem", fontWeight: 700, fill: color }}
            >
              {displayValue}
            </text>
            <text
              x="50%"
              y="65%"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: "0.8rem", fill: "#666" }}
            >
              {displayUnit.includes("%") ? displayUnit.replace("%", "").trim() : displayUnit} today
            </text>
          </RadialBarChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );
};

/* ---------------- Main ---------------- */
function MentalExerciseDashboard() {
  const [show, setShow] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeTab, setActiveTab] = useState("guided");
  const [toastErr, setToastErr] = useState("");
  const [toastOk, setToastOk] = useState("");

  // auth state (ensures Mongo writes will succeed)
  const [authReady, setAuthReady] = useState(false);

  // playback tracking
  const watchStateRef = useRef({ whenPlay: null });

  // keep last good data to avoid “zeroing out”
  const lastGoodExerciseRef = useRef([]);
  const lastGoodStepsRef = useRef([]);
  const lastOkAtRef = useRef(0);

  // prevent concurrent refreshes
  const inFlightRef = useRef(false);
  const initialLoadRef = useRef(false);

  // Mongo sessions (guided/manual) fetched from backend
  const [mongoSessions, setMongoSessions] = useState([]);

  const {
    account = {},
    healthLoading = false,
    linkGoogleFit,
    unlinkGoogleFit,
    exercise = [],
    steps = [],
    metrics = {}, // steps24h fallback for *today* only
    refreshExercise,
    refreshSteps,
  } = useContext(GoogleFitContext) || {};
  const isLinked = !!account?.linked;

  const handleShow = (video) => {
    setSelectedVideo(video);
    setShow(true);
    watchStateRef.current = { whenPlay: null };
  };

  const videoData = [
    {
      title: "Breathing Exercise",
      description: "A guided breathing exercise to calm the mind.",
      thumbnail: BreathingImg,
      exerciseVideo: MentalExerciseVideo,
      steps: [
        "Sit comfortably with your back straight.",
        "Close your eyes and relax your shoulders.",
        "Inhale 4s • Hold 2s • Exhale 6s.",
        "Repeat 5 times.",
      ],
      difficulty: "easy",
      type: "breathing",
    },
    {
      title: "Mental Relaxation",
      description: "Simple relaxation exercise for stress relief.",
      thumbnail: BreathingImg,
      exerciseVideo: MentalExerciseVideo,
      steps: [
        "Find a quiet place.",
        "Breathe slowly.",
        "Release tension.",
        "Visualize a calm place for 5 min.",
      ],
      difficulty: "easy",
      type: "mindfulness",
    },
  ];

  /* ---------- AUTH CHECK (cookie or bearer) ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const who = await getJSONSafe("/api/auth/whoami");
      if (!cancelled) {
        const u = who?.user;
        const ok = who?.ok === undefined ? !!u?._id : who.ok && !!u?._id;
        setAuthReady(!!ok);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---------- cache last non-zero data ---------- */
  const sumSteps = (arr) =>
    Array.isArray(arr) ? arr.reduce((a, r) => a + (Number(r?.value) || 0), 0) : 0;

  const sumMinutes = (arr) =>
    Array.isArray(arr)
      ? arr.reduce((a, s) => {
          const m = typeof s?.durationMinutes === "number"
            ? s.durationMinutes
            : minutesBetween(s?.start, s?.end);
          return a + (m || 0);
        }, 0)
      : 0;

  useEffect(() => {
    const stepsTotal = sumSteps(steps);
    const minsTotal = sumMinutes(exercise);
    if (stepsTotal > 0) lastGoodStepsRef.current = steps;
    if (minsTotal > 0) lastGoodExerciseRef.current = exercise;
    if (stepsTotal > 0 || minsTotal > 0) lastOkAtRef.current = Date.now();
  }, [exercise, steps]);

  /* ---------- Mongo: load last 30 days of saved sessions ---------- */
  const loadMongoSessions = useCallback(async () => {
    const res = await getJSONSafe("/api/exercises/recent?limit=400");
    if (res?.ok && Array.isArray(res.rows)) {
      const sinceMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const filtered = res.rows.filter((r) => new Date(r.startedAt).getTime() >= sinceMs);
      const mapped = filtered.map((r) => ({
        id: r._id,
        name: r.title || "Guided Session",
        start: r.startedAt,
        end: r.endedAt,
        durationMinutes: Number(r.minutes) || 0,
        activityType: r.source || "guided",
        date: r.dateKey,
      }));
      setMongoSessions(mapped);
    } else if (res?.error) {
      setToastErr(res.error || "Failed to load exercise sessions");
    }
  }, []);

  /* ---------- single place to refresh 30D (Google Fit) ---------- */
  const refreshOnce = useCallback(async () => {
    if (!refreshExercise || !refreshSteps || inFlightRef.current) return;
    inFlightRef.current = true;
    const endMs = Date.now();
    const startMs = endMs - 30 * 24 * 60 * 60 * 1000;
    try {
      const [exOk, stOk] = await Promise.allSettled([
        refreshExercise(startMs, endMs),
        refreshSteps(startMs, endMs, LOCAL_TZ),
      ]);
      if (exOk.status === "rejected" || stOk.status === "rejected") {
        setToastErr("Couldn’t refresh all data. Showing last known values.");
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [refreshExercise, refreshSteps]);

  /* ---------- fetch when linked (once) ---------- */
  useEffect(() => {
    if (!isLinked) return;
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    refreshOnce();
    loadMongoSessions();
  }, [isLinked, refreshOnce, loadMongoSessions]);

  /* ---------- load 30-day data when Activity tab opens ---------- */
  useEffect(() => {
    if (!isLinked) return;
    if (activeTab !== "activity") return;
    if (inFlightRef.current) return;
    const needsExercise = !Array.isArray(exercise) || sumMinutes(exercise) === 0;
    const needsSteps = !Array.isArray(steps) || sumSteps(steps) === 0;
    if (needsExercise || needsSteps) {
      refreshOnce();
    }
    loadMongoSessions();
  }, [activeTab, isLinked, exercise, steps, refreshOnce, loadMongoSessions]);

  /* ---------- guided-session logging (MongoDB) ---------- */
  const ensureAuthedOrWarn = useCallback(async () => {
    if (authReady) return true;
    const who = await getJSONSafe("/api/auth/whoami");
    const u = who?.user;
    const ok = who?.ok === undefined ? !!u?._id : who.ok && !!u?._id;
    if (ok) {
      setAuthReady(true);
      return true;
    }
    setToastErr("Please log in first to save activity to your account.");
    return false;
  }, [authReady]);

  const logGuidedSession = useCallback(
    async (startedAtMs, endedAtMs) => {
      const okAuth = await ensureAuthedOrWarn();
      if (!okAuth) return { ok: false, error: "unauthenticated" };

      const durationMinutes = Math.max(1, Math.round((endedAtMs - startedAtMs) / 60000));
      const res = await postJSONSafe("/api/exercises/log", {
        title: selectedVideo?.title || "Guided Exercise",
        source: "guided",
        startedAt: new Date(startedAtMs).toISOString(),
        endedAt: new Date(endedAtMs).toISOString(),
        durationMinutes,
        tz: LOCAL_TZ,
      });
      if (res?.ok === false) {
        setToastErr(res.error || "Failed to log guided session.");
        return res;
      }
      setToastOk("Exercise saved to your account ✅");
      loadMongoSessions();
      return res;
    },
    [selectedVideo, ensureAuthedOrWarn, loadMongoSessions]
  );

  // handy debug: quickly create a 5-min session to confirm DB writes
  const logFiveMinuteTest = useCallback(async () => {
    const end = Date.now();
    const start = end - 5 * 60 * 1000;
    const res = await postJSONSafe("/api/exercises/log", {
      title: "Quick Test (5 min)",
      source: "guided",
      startedAt: new Date(start).toISOString(),
      endedAt: new Date(end).toISOString(),
      durationMinutes: 5,
      tz: LOCAL_TZ,
    });
    if (res?.ok) {
      setToastOk("Test session saved ✅");
      loadMongoSessions();
    } else {
      setToastErr(res?.error || "Test log failed");
    }
  }, [loadMongoSessions]);

  /* ---------- Effective data (merge Google Fit + Mongo sessions) ---------- */
  const sumAllMinutes = (arr) =>
    Array.isArray(arr)
      ? arr.reduce((a, s) => {
          const m = typeof s?.durationMinutes === "number"
            ? s.durationMinutes
            : minutesBetween(s?.start, s?.end);
          return a + (m || 0);
        }, 0)
      : 0;

  const effSteps = sumSteps(steps) > 0 ? steps : lastGoodStepsRef.current;

  // Merge Mongo sessions with Google Fit exercise sessions for charts/lists
  const baseEx = sumAllMinutes(exercise) > 0 ? exercise : lastGoodExerciseRef.current;
  const effEx = [...(baseEx || []), ...(mongoSessions || [])];

  /* ===== Transform (with live fallback for today) ===== */
  const {
    minutesPerDay,
    stepsSeries,
    summaryStats,
    circularStepsData,
    circularMinutesData,
    rewardStats,
    challenge,
  } = useMemo(() => {
    const todayKey = toDateKeyTz(Date.now());

    // minutes by day
    const minutesByDay = {};
    const eligibleMinutesByDay = {};
    for (const s of effEx || []) {
      const mins = typeof s?.durationMinutes === "number" ? s.durationMinutes : minutesBetween(s?.start, s?.end);
      if (mins > 0) {
        const key = s?.date || toDateKeyTz(s?.start || s?.end || Date.now());
        minutesByDay[key] = (minutesByDay[key] || 0) + mins;
        eligibleMinutesByDay[key] = (eligibleMinutesByDay[key] || 0) + mins;
      }
    }

    // steps by day (merge Google Fit buckets + live fallback)
    const stepsByDay = {};
    for (const row of effSteps || []) {
      const key = row?.date || toDateKeyTz(row?.start || row?.end || Date.now());
      const count = Number(row?.value) || 0;
      stepsByDay[key] = (stepsByDay[key] || 0) + count;
    }
    const fallbackToday = Number(metrics?.steps24h) || 0;
    if (fallbackToday > 0) {
      // Ensure charts use live steps even if today's bucket is missing/delayed
      stepsByDay[todayKey] = Math.max(stepsByDay[todayKey] || 0, fallbackToday);
    }

    const last14 = lastNDates(14);
    const last30 = lastNDates(CHALLENGE_DAYS);

    const minutesChartData = last14.map((k) => ({
      dateKey: k,
      label: fmtMD(k),
      minutes: minutesByDay[k] || 0,
    }));
    const stepsChartData = last14.map((k) => ({
      dateKey: k,
      label: fmtMD(k),
      steps: stepsByDay[k] || 0,
    }));

    // today values (already merged above)
    const todaySteps = stepsByDay[todayKey] || 0;
    const stepsProgress = Math.min(100, Math.round((todaySteps / STEP_GOAL) * 100));
    const circularStepsData = [{
      name: "Steps",
      uv: stepsProgress,
      displayValue: todaySteps.toLocaleString(),
      displayUnit: "Steps",
      goal: STEP_GOAL.toLocaleString(),
    }];

    const todayMinutesVal = minutesByDay[todayKey] || 0;
    const minutesProgress = Math.min(100, Math.round((todayMinutesVal / MINUTE_GOAL) * 100));
    const circularMinutesData = [{
      name: "Minutes",
      uv: minutesProgress,
      displayValue: todayMinutesVal,
      displayUnit: "Minutes",
      goal: MINUTE_GOAL,
    }];

    // 30-day totals
    const totalSteps30 = last30.reduce((acc, k) => acc + (stepsByDay[k] || 0), 0);
    const totalMinutes30 = last30.reduce((acc, k) => acc + (minutesByDay[k] || 0), 0);
    const totalSessions30 = (effEx || []).filter(
      (s) => last30.includes(s?.date || toDateKeyTz(s?.start || s?.end))
    ).length;

    const safeTotalSteps30 = totalSteps30 || todaySteps || 0;

    const summaryStats = {
      totalSteps30: safeTotalSteps30.toLocaleString(),
      totalMinutes30: totalMinutes30.toLocaleString(),
      totalSessions30,
    };

    // Rewards
    const qualifiesByDay = {};
    const dailyPointsByDay = {};
    last30.forEach((k) => {
      const daySteps = stepsByDay[k] || 0;
      const dayMins = eligibleMinutesByDay[k] || 0;
      const qualifies = daySteps >= STEP_THRESHOLD && dayMins >= EXERCISE_MINUTES_THRESHOLD;
      qualifiesByDay[k] = qualifies;
      dailyPointsByDay[k] = qualifies ? POINTS_PER_QUALIFYING_DAY : 0;
    });

    let currentConsecutive = 0;
    for (let i = last30.length - 1; i >= 0; i--) {
      if (qualifiesByDay[last30[i]]) currentConsecutive += 1;
      else break;
    }
    currentConsecutive = Math.min(currentConsecutive, CHALLENGE_DAYS);

    const daysQualified14 = last14.reduce((acc, k) => acc + (qualifiesByDay[k] ? 1 : 0), 0);
    const pointsLast14 = daysQualified14 * POINTS_PER_QUALIFYING_DAY;

    const qualifiesToday = !!qualifiesByDay[todayKey];
    const pointsToday = qualifiesToday ? POINTS_PER_QUALIFYING_DAY : 0;

    const complete = currentConsecutive >= CHALLENGE_DAYS;
    const progressPct = Math.round((currentConsecutive / CHALLENGE_DAYS) * 100);
    const pointsLast30 =
      last30.reduce((acc, k) => acc + (dailyPointsByDay[k] || 0), 0)
      + (complete ? MONTHLY_BONUS_POINTS : 0);

    const rewardStats = {
      today: {
        qualifiesToday,
        pointsToday,
        stepsToday: todaySteps,
        eligibleExerciseMinutesToday: todayMinutesVal,
      },
      streakDays: currentConsecutive,
      last14: { daysQualified: daysQualified14, points: pointsLast14 },
    };

    const challenge = { currentConsecutive, progressPct, complete, pointsLast30 };

    return {
      minutesPerDay: minutesChartData,
      stepsSeries: stepsChartData,
      summaryStats,
      circularStepsData,
      circularMinutesData,
      rewardStats,
      challenge,
    };
  }, [effEx, effSteps, metrics]);

  /* ---------------- UI ---------------- */
  const renderConnectionCard = () => (
    <Card className={`mb-4 shadow-sm border-0 ${classes.connectCard}`}>
      <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-3 p-3">
        <div className="d-flex align-items-center gap-3">
          {isLinked ? (
            <>
              <BsCheckCircleFill className="text-success" size={24} />
              <span className="fw-bold text-success">Google Fit is Connected</span>
              <span className="text-muted small">{account?.name || account?.email}</span>
            </>
          ) : (
            <>
              <BsLink45Deg className="text-danger" size={24} />
              <span className="fw-bold text-danger">Not Connected</span>
              <span className="text-muted small">Link your account to track activity data.</span>
            </>
          )}
        </div>

        <div className="d-flex align-items-center gap-2">
          {!isLinked ? (
            <Button size="sm" onClick={linkGoogleFit} disabled={!linkGoogleFit} className={classes.btnPrimary}>
              Connect Google Fit
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline-primary"
                onClick={() => { refreshOnce(); loadMongoSessions(); }}
                disabled={healthLoading || inFlightRef.current}
                className={classes.btnOutline}
              >
                {(healthLoading || inFlightRef.current)
                  ? (<><Spinner animation="border" size="sm" className="me-2" /> Refreshing…</>)
                  : (<><BsArrowRepeat className="me-1" /> Refresh Data</>)}
              </Button>

              <Button size="sm" variant="outline-success" onClick={logFiveMinuteTest}>
                Save 5-min Test
              </Button>

              <Button size="sm" variant="outline-danger" onClick={unlinkGoogleFit}>
                Disconnect
              </Button>
            </>
          )}
        </div>
      </Card.Body>
    </Card>
  );

  const renderSummaryStat = (icon, title, value) => (
    <Col xs={12} md={4} key={title}>
      <Card className={`h-100 shadow-sm border-0 ${classes.statCard}`}>
        <Card.Body className="d-flex align-items-center">
          <div className={`p-3 me-3 rounded-circle ${classes.statIcon}`}>{icon}</div>
          <div>
            <div className="text-muted small text-uppercase">{title}</div>
            <h4 className="fw-bold mb-0">{value}</h4>
          </div>
        </Card.Body>
      </Card>
    </Col>
  );

  const renderRewardsCard = () => {
    const today = rewardStats?.today ?? {
      qualifiesToday: false, pointsToday: 0, stepsToday: 0, eligibleExerciseMinutesToday: 0,
    };
    const qualifiesToday = !!today.qualifiesToday;
    const pointsToday = Number(today.pointsToday || 0);
    const stepsTodayNum = Number(today.stepsToday || 0);
    const eligibleExerciseMinutesToday = Number(today.eligibleExerciseMinutesToday || 0);
    const streakDays = Number(rewardStats?.streakDays ?? 0);
    const daysQualified = Number(rewardStats?.last14?.daysQualified ?? 0);
    const ch = challenge ?? { currentConsecutive: 0, progressPct: 0, complete: false, pointsLast30: 0 };
    const { currentConsecutive, progressPct, complete, pointsLast30 } = ch;

    return (
      <Card className={`h-100 shadow-sm border-0 ${classes.rewardCard}`}>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start">
            <h5 className="mb-2">Daily Reward</h5>
            <Badge bg={qualifiesToday ? "success" : "secondary"} pill>
              {qualifiesToday ? "Qualified Today" : "Not Qualified"}
            </Badge>
          </div>
          <div className="text-muted small mb-3">
            <strong>Rule:</strong> ≥ {STEP_THRESHOLD.toLocaleString()} steps AND ≥ {EXERCISE_MINUTES_THRESHOLD} min exercise.
          </div>

          <Row className="g-3">
            <Col md={4}>
              <Card className="h-100 border-0 shadow-none">
                <Card.Body className={classes.kpiBox}>
                  <div className="text-muted small">Today’s Steps</div>
                  <h4 className="mb-0">{stepsTodayNum.toLocaleString()}</h4>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100 border-0 shadow-none">
                <Card.Body className={classes.kpiBox}>
                  <div className="text-muted small">Today’s Exercise Minutes</div>
                  <h4 className="mb-0">{eligibleExerciseMinutesToday} min</h4>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100 border-0 shadow-none">
                <Card.Body className={classes.kpiBox}>
                  <div className="text-muted small">Points Today</div>
                  <h4 className="mb-0">{pointsToday}</h4>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <hr className={classes.hrSoft} />

          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">30-Day Challenge</h6>
            <Badge bg={complete ? "success" : "info"} pill>{complete ? "Reward Unlocked" : "In Progress"}</Badge>
          </div>
          <div className="small text-muted mb-2">
            Consecutive qualifying days: <strong>{currentConsecutive}</strong> / {CHALLENGE_DAYS}
            {complete && <span className="ms-2">• Bonus: <strong>+{MONTHLY_BONUS_POINTS}</strong> points</span>}
          </div>
          <ProgressBar now={progressPct} label={`${progressPct}%`} className={`mb-3 ${classes.progress}`} />

          <Row className="g-3">
            <Col md={4}>
              <div className="text-muted small">Current Streak</div>
              <h5 className="mb-0">{streakDays} day{streakDays === 1 ? "" : "s"}</h5>
            </Col>
            <Col md={4}>
              <div className="text-muted small">Qualified Days (Last 14)</div>
              <h5 className="mb-0">{daysQualified} / 14</h5>
            </Col>
            <Col md={4}>
              <div className="text-muted small">Points (Last 30)</div>
              <h5 className="mb-0">{pointsLast30}</h5>
              {complete && <div className="small text-success">includes bonus</div>}
            </Col>
          </Row>
        </Card.Body>
      </Card>
    );
  };

  const renderActivityDashboard = () => {
    const hasData = sumAllMinutes(effEx) > 0 || sumSteps(effSteps) > 0;

    if (healthLoading && !hasData) {
      return (
        <div className="text-center p-5">
          <Spinner animation="border" className="mb-3" />
          <p className="text-muted">Loading your activity data (up to 30 days)...</p>
        </div>
      );
    }

    if (!isLinked) {
      return (
        <Card className={`text-center p-4 shadow-sm border-0 ${classes.blankCard}`}>
          <Card.Body>
            <p className="mb-3 fs-5">
              Link <strong>Google Fit</strong> to automatically see your steps and exercise sessions.
            </p>
            <Button size="lg" onClick={linkGoogleFit} disabled={!linkGoogleFit} className={classes.btnPrimary}>
              Connect Google Fit Now
            </Button>
          </Card.Body>
        </Card>
      );
    }

    return (
      <>
        <Row className="g-4 mb-4">
          <Col lg={12}>{renderRewardsCard()}</Col>
        </Row>

        <Row className="g-4 mb-4">
          <Col lg={6}>
            <RadialProgressChart title="Today's Steps Progress" data={circularStepsData} color="#10B981" />
          </Col>
          <Col lg={6}>
            <RadialProgressChart title="Today's Exercise Progress" data={circularMinutesData} color="#0d6efd" />
          </Col>
        </Row>

        <Row className="g-4 mb-4">
          {renderSummaryStat(<FaShoePrints size={24} />, "Total Steps (30D)", summaryStats.totalSteps30)}
          {renderSummaryStat(<FaHourglassHalf size={24} />, "Total Minutes Active (30D)", summaryStats.totalMinutes30)}
          {renderSummaryStat(<FaRunning size={24} />, "Total Sessions (30D)", summaryStats.totalSessions30)}
        </Row>

        <Row className="g-4">
          <Col lg={6}>
            <Card className={`h-100 shadow-sm border-0 ${classes.statCard}`}>
              <Card.Body>
                <h5 className="mb-3 card-title">Exercise Minutes (Last 14 Days)</h5>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={minutesPerDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value) => [`${value} min`, "Minutes"]} />
                    <Bar dataKey="minutes" name="Minutes" fill="#0d6efd" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {Array.isArray(minutesPerDay) && minutesPerDay.every((d) => (d?.minutes || 0) === 0) && (
                  <div className="small text-muted text-center mt-2">No exercise sessions recorded.</div>
                )}
              </Card.Body>
            </Card>
          </Col>
          <Col lg={6}>
            <Card className={`h-100 shadow-sm border-0 ${classes.statCard}`}>
              <Card.Body>
                <h5 className="mb-3 card-title">Daily Steps (Last 14 Days)</h5>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={stepsSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Steps"]} />
                    <Line type="monotone" dataKey="steps" stroke="#10B981" name="Steps" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                {Array.isArray(stepsSeries) && stepsSeries.every((d) => (d?.steps || 0) === 0) && (
                  <div className="small text-muted text-center mt-2">No steps data available.</div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Card className={`mt-4 shadow-sm border-0 ${classes.statCard}`}>
          <Card.Body>
            <h5 className="mb-3 card-title">Recent Sessions</h5>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {!(effEx || []).length ? (
                <div className="text-muted p-3 text-center">Start an exercise to see it listed here!</div>
              ) : (
                <ul className="list-unstyled mb-0">
                  {effEx
                    .slice()
                    .sort((a, b) => new Date(b?.start || 0) - new Date(a?.start || 0))
                    .slice(0, 20)
                    .map((s) => {
                      const mins = typeof s?.durationMinutes === "number"
                        ? s.durationMinutes
                        : minutesBetween(s?.start, s?.end);
                      return (
                        <li key={s?.id || s?.start} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div>
                            <div className="fw-semibold">
                              {s?.name || "Unnamed Session"}{" "}
                              <Badge bg="info" className="ms-1" pill>{s?.activityType || "Activity"}</Badge>
                            </div>
                            <div className="small text-muted">{s?.start ? new Date(s.start).toLocaleString() : "—"}</div>
                          </div>
                          <div className="ms-3"><Badge bg="primary" className="p-2">{mins} min</Badge></div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </Card.Body>
        </Card>
      </>
    );
  };

  return (
    <Container fluid className={classes.mainContainer}>
      <Tabs
        id="exercise-tabs"
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k || "guided")}
        className={`mb-4 ${classes.tabs}`}
        justify
      >
        <Tab eventKey="guided" title="Guided Exercises">
          <Row className="g-4" style={{ justifyContent: "space-evenly" }}>
            {videoData.map((item, index) => (
              <Col key={index} xs={12} md={6} className={classes.exerciseCard} onClick={() => handleShow(item)}>
                <div className={classes.exerciseCardDesign}>
                  <div className={classes.exerciseInfo}>
                    <h1>{item.title}</h1>
                    <p>{item.description}</p>
                  </div>
                  <div style={{ position: "relative" }}>
                    <img src={item.thumbnail} alt={item.title} className={classes.exerciseImg} />
                    <div className={classes.playOverlay}><BsFillPlayFill /></div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Tab>

        <Tab
          eventKey="activity"
          title={
            <>
              Your Activity (Google Fit){" "}
              {isLinked ? <Badge bg="success" className="ms-1" pill>Linked</Badge> : <Badge bg="secondary" className="ms-1" pill>Not linked</Badge>}
            </>
          }
        >
          {renderConnectionCard()}
          {renderActivityDashboard()}
        </Tab>
      </Tabs>

      <Modal
        show={show}
        onHide={async () => {
          if (watchStateRef.current.whenPlay) await logGuidedSession(watchStateRef.current.whenPlay, Date.now());
          setShow(false);
        }}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton><Modal.Title>{selectedVideo?.title}</Modal.Title></Modal.Header>
        <Modal.Body className={classes.modalBody}>
          {selectedVideo && (
            <video
              src={selectedVideo.exerciseVideo}
              controls
              autoPlay
              onPlay={() => { if (!watchStateRef.current.whenPlay) watchStateRef.current.whenPlay = Date.now(); }}
              onEnded={async () => {
                const st = watchStateRef.current.whenPlay || Date.now();
                await logGuidedSession(st, Date.now());
              }}
              style={{ width: "100%", borderRadius: "12px", marginBottom: "1rem" }}
            />
          )}
          {selectedVideo?.steps && (
            <div className={classes.modalSteps}>
              <h5>Steps:</h5>
              <ol>{selectedVideo.steps.map((step, idx) => (<li key={idx}>{step}</li>))}</ol>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={async () => {
              if (watchStateRef.current.whenPlay) await logGuidedSession(watchStateRef.current.whenPlay, Date.now());
              setShow(false);
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <ToastContainer position="bottom-end" className="p-3">
        <Toast bg="success" onClose={() => setToastOk("")} show={!!toastOk} delay={2500} autohide>
          <Toast.Header><strong className="me-auto">Saved</strong><small>now</small></Toast.Header>
          <Toast.Body className="text-white">{toastOk}</Toast.Body>
        </Toast>
        <Toast bg="danger" onClose={() => setToastErr("")} show={!!toastErr} delay={4000} autohide>
          <Toast.Header><strong className="me-auto">Exercise</strong><small>now</small></Toast.Header>
          <Toast.Body className="text-white">{toastErr}</Toast.Body>
        </Toast>
      </ToastContainer>
    </Container>
  );
}

export default MentalExerciseDashboard;
