import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import { Container, Button, Form, Badge, Card, Row, Col, Spinner, Alert, ProgressBar } from "react-bootstrap";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, CheckCircle, Brain, Trophy } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { AppDataContext } from "../../../App";
import { GoogleFitContext } from "../../../context/GoogleFitProvider";
import { StressAPI } from "../../../api/stress.api"; // ← added
import styles from "./StressHabitTracker.module.css";

/* ---------------- Constants ---------------- */
const STRESS_CATEGORIES = ["Work", "Health", "Family", "Finance", "Other"];
const CATEGORY_COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];

const STRESS_HABITS = {
  Work: ["Take a short walk", "Practice deep breathing", "Organize your tasks"],
  Health: ["Meditate for 5 minutes", "Drink water", "Do some stretching"],
  Family: ["Call a loved one", "Spend quality time", "Write a gratitude note"],
  Finance: ["Review budget", "List financial goals", "Track expenses"],
  Other: ["Listen to music", "Read a book", "Take a short break"],
};

// ---------- Dates / helpers ----------
const toDateKey = (d) => new Date(d).toISOString().split("T")[0];
const fmtMD = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const getDateDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateKey(d);
};

// Treat a day as “active” if any common activity signal is > 0 (for Google Fit)
const num = (v) => (Number.isFinite(v) ? Number(v) : 0);
const hasActivity = (d) => {
  if (!d || typeof d !== "object") return false;
  const signals = ["steps", "sessions", "activeMinutes", "moveMinutes", "heartPoints", "calories", "distance"];
  return signals.some((k) => num(d[k]) > 0);
};

// ---------- Stress labels ----------
const stressLabelManual = (v) => (v == null ? "-" : v <= 3 ? "Low" : v <= 7 ? "Moderate" : "High");
const stressClassManual = (v) => (v == null ? styles.levelMuted : v <= 3 ? styles.levelLow : v <= 7 ? styles.levelMed : styles.levelHigh);

// Post-calibration, treat <=40 as Low, 41–70 Moderate, >70 High
const stressLabelGF = (v) => (v == null ? "-" : v <= 40 ? "Low" : v <= 70 ? "Moderate" : "High");
const stressClassGF = (v) =>
  v == null
    ? styles.levelMuted
    : v <= 40
    ? styles.levelLow
    : v <= 70
    ? styles.levelMed
    : styles.levelHigh;

// ====== Calibration & smoothing for Google Fit stress index ======
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function calibrateGFStress(raw) {
  const r = Number.isFinite(raw) ? raw : 0;
  const biased = r * 0.85 + 8;
  return clamp(Math.round(biased), 10, 100);
}
function emaSmooth(arr, alpha = 0.35) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const out = [arr[0]];
  for (let i = 1; i < arr.length; i++) out[i] = alpha * arr[i] + (1 - alpha) * out[i - 1];
  return out.map((v) => Math.round(v));
}

/* ---------------- Gamification rules ---------------- */
const POINTS_TRIGGER = 2;
const POINTS_HABIT = 3;

function computeDayScore(day) {
  if (!day) return 0;
  const triggers = Array.isArray(day.stress) ? day.stress.length : 0;
  const habitsDone = Array.isArray(day.habits) ? day.habits.filter((h) => h.done).length : 0;
  return triggers * POINTS_TRIGGER + habitsDone * POINTS_HABIT;
}

function rankFromScore(score) {
  if (score >= 21) return { name: "Gold", variant: "warning" };
  if (score >= 11) return { name: "Silver", variant: "secondary" };
  return { name: "Bronze", variant: "dark" };
}

/* =================================================================== */

export default function StressHabitTracker() {
  /* ---------------- App / GF Context ---------------- */
  const { stressData, setStressData } = useContext(AppDataContext);
  const gf = useContext(GoogleFitContext) || {};

  const account = gf?.account || null;
  const isLinked = !!account?.linked;
  const healthLoading = Boolean(gf?.healthLoading);
  const dailyStressIndex = Array.isArray(gf?.dailyStressIndex) ? gf.dailyStressIndex : [];
  const refreshStressIndex = typeof gf?.refreshStressIndex === "function" ? gf.refreshStressIndex : undefined;
  const linkGoogleFit = typeof gf?.linkGoogleFit === "function" ? gf.linkGoogleFit : undefined;
  const unlinkGoogleFit = typeof gf?.unlinkGoogleFit === "function" ? gf.unlinkGoogleFit : undefined;

  /* ---------------- Local State ---------------- */
  const [source, setSource] = useState(isLinked ? "googlefit" : "manual");
  useEffect(() => setSource(isLinked ? "googlefit" : "manual"), [isLinked]);

  // Manual data in .manual; keep GF notes in _gfNotes to persist via AppDataContext
  const [data, setData] = useState(stressData?.manual || {});
  const [selectedDate, setSelectedDate] = useState(toDateKey(Date.now()));
  const [stressInput, setStressInput] = useState("");
  const [stressIntensity, setStressIntensity] = useState(5);
  const [stressCategory, setStressCategory] = useState(STRESS_CATEGORIES[0]);

  // GF date range + notes
  const [gfStartDate, setGfStartDate] = useState(getDateDaysAgo(14));
  const [gfEndDate, setGfEndDate] = useState(toDateKey(Date.now()));
  // Structure: gfNotes[YYYY-MM-DD] = { notes: [...], habits: [...] }
  const [gfNotes, setGfNotes] = useState(stressData?._gfNotes || {});

  // Persist (manual + GF) to global (keeps in AppDataContext)
  useEffect(() => {
    if (typeof setStressData === "function") setStressData({ manual: data, _gfNotes: gfNotes });
  }, [data, gfNotes, setStressData]);

  /* ---------------- Initial preload (last 14 days) ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const start = getDateDaysAgo(14);
        const end = toDateKey(Date.now());
        const items = await StressAPI.listRange(start, end);

        const nextManual = {};
        const nextGfNotes = {};
        for (const it of items) {
          if (it?.manual)
            nextManual[it.date] = { stress: it.manual.stress || [], habits: it.manual.habits || [] };
          if (it?.gf)
            nextGfNotes[it.date] = { notes: it.gf.notes || [], habits: it.gf.habits || [] };
        }
        if (Object.keys(nextManual).length) setData((cur) => ({ ...nextManual, ...cur }));
        if (Object.keys(nextGfNotes).length) setGfNotes((cur) => ({ ...nextGfNotes, ...cur }));
      } catch (e) {
        console.warn("Stress preload failed:", e?.message || e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Manual Tracker ---------------- */
  const currentDay = data[selectedDate] || { stress: [], habits: [] };

  const addStress = () => {
    if (!stressInput.trim()) return;
    const newStress = [
      ...(currentDay.stress || []),
      { text: stressInput.trim(), intensity: Number(stressIntensity), category: stressCategory },
    ];

    const suggestedHabits = STRESS_HABITS[stressCategory].map((text) => ({
      text,
      done: false,
      streak: 0,
      lastDone: "",
    }));
    const mergedHabits = [...(currentDay.habits || [])];
    suggestedHabits.forEach((h) => {
      if (!mergedHabits.some((mh) => mh.text === h.text)) mergedHabits.push(h);
    });

    setData({ ...data, [selectedDate]: { stress: newStress, habits: mergedHabits } });
    setStressInput("");
    setStressIntensity(5);
  };

  const removeStress = (index) => {
    const newStress = [...(currentDay.stress || [])];
    newStress.splice(index, 1);
    setData({ ...data, [selectedDate]: { ...currentDay, stress: newStress } });
  };

  const toggleHabit = (index) => {
    const newHabits = [...(currentDay.habits || [])];
    const h = newHabits[index];
    const today = selectedDate;

    if (!h.done) {
      h.done = true;
      h.streak = (h.streak || 0) + 1;
      h.lastDone = today;
    } else if (h.lastDone === today) {
      h.done = false;
      h.streak = Math.max(0, (h.streak || 0) - 1);
      h.lastDone = "";
    }
    setData({ ...data, [selectedDate]: { ...currentDay, habits: newHabits } });
  };

  const weeklyStats = useMemo(() => {
    const weekDates = Object.keys(data).sort().slice(-7);
    return weekDates
      .map((date) => {
        const day = data[date];
        const avg = day?.stress?.length
          ? day.stress.reduce((sum, s) => sum + Number(s.intensity || 0), 0) / day.stress.length
          : null;
        return { date: fmtMD(date), stressAvg: avg !== null ? Math.round(avg) : null };
      })
      .filter((d) => d.stressAvg !== null);
  }, [data]);

  const categoryCountsManual = useMemo(() => {
    const counts = STRESS_CATEGORIES.map(
      (cat) => (currentDay.stress || []).filter((s) => s.category === cat).length
    );
    return STRESS_CATEGORIES.map((cat, i) => ({ name: cat, value: counts[i] })).filter((x) => x.value > 0);
  }, [currentDay.stress]);

  const manualSelectedAvg = useMemo(() => {
    if (!currentDay?.stress?.length) return null;
    const avg =
      currentDay.stress.reduce((sum, s) => sum + Number(s.intensity || 0), 0) / currentDay.stress.length;
    return Math.round(avg);
  }, [currentDay]);

  const dayScore = useMemo(() => computeDayScore(currentDay), [currentDay]);
  const dayRank = useMemo(() => rankFromScore(dayScore), [dayScore]);
  const dayProgress = useMemo(() => Math.min(100, Math.round((dayScore / 30) * 100)), [dayScore]);

  /* -------- Persist manual (debounced per selectedDate) -------- */
  const manualSaveTimer = useRef(null);
  useEffect(() => {
    if (!selectedDate) return;
    if (manualSaveTimer.current) clearTimeout(manualSaveTimer.current);
    manualSaveTimer.current = setTimeout(async () => {
      try {
        const day = data[selectedDate];
        if (!day) return;
        await StressAPI.upsertDay({
          date: selectedDate,
          manual: { stress: day.stress || [], habits: day.habits || [] },
        });
      } catch (e) {
        console.warn("Save manual failed:", e?.message || e);
      }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedDate]);

  /* ---------------- Google Fit ---------------- */

  // Debounce + guard to avoid continuous loading
  const refreshTimerRef = useRef(null);
  const lastArgsRef = useRef({ key: "" });
  const isRefreshingRef = useRef(false);

  const handleRefreshGF = useCallback(() => {
    if (!isLinked || typeof refreshStressIndex !== "function") return;
    const startMs = new Date(gfStartDate).getTime();
    const endMs = new Date(gfEndDate).getTime() + 86400000 - 1;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return;

    const key = `${startMs}-${endMs}`;
    if (lastArgsRef.current.key === key && isRefreshingRef.current) return;

    lastArgsRef.current.key = key;

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        isRefreshingRef.current = true;
        await refreshStressIndex(startMs, endMs);
      } finally {
        isRefreshingRef.current = false;
      }
    }, 300);
  }, [isLinked, refreshStressIndex, gfStartDate, gfEndDate]);

  useEffect(() => {
    if (source === "googlefit" && isLinked) handleRefreshGF();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, isLinked]);

  useEffect(() => {
    if (source === "googlefit" && isLinked) handleRefreshGF();
  }, [gfStartDate, gfEndDate, source, isLinked, handleRefreshGF]);

  // Build series and keep only days with a value and activity
  const gfSeries = useMemo(() => {
    const rows = (dailyStressIndex || [])
      .filter((d) => d && Number.isFinite(d.stressIndex) && hasActivity(d))
      .map((d) => ({ date: d.date, raw: Number(d.stressIndex) || 0 }))
      .filter((d) => d.date);

    rows.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
    if (rows.length === 0) return [];

    const calibrated = rows.map((r) => calibrateGFStress(r.raw));
    const smoothed = emaSmooth(calibrated, 0.35);

    return rows.map((r, i) => ({
      date: r.date,
      label: fmtMD(r.date),
      stressIndex: smoothed[i],
    }));
  }, [dailyStressIndex]);

  // GF selected day
  const [gfSelectedDay, setGfSelectedDay] = useState("");
  useEffect(() => {
    if (gfSeries.length > 0) setGfSelectedDay(gfSeries[gfSeries.length - 1].date);
    else setGfSelectedDay("");
  }, [gfSeries]);

  const gfSelectedPoint = useMemo(
    () => gfSeries.find((p) => p.date === gfSelectedDay),
    [gfSeries, gfSelectedDay]
  );

  // GF notes state for the selected day
  const gfDayState = gfNotes[gfSelectedDay] || { notes: [], habits: [] };
  const [gfNoteText, setGfNoteText] = useState("");
  const [gfNoteCategory, setGfNoteCategory] = useState(STRESS_CATEGORIES[0]);


  const addGfNote = () => {
    if (!gfSelectedDay || !gfNoteText.trim() || !gfSelectedPoint) return;

    const note = {
      text: gfNoteText.trim(),
      category: gfNoteCategory,
      stressIndex: gfSelectedPoint.stressIndex,
      addedAt: new Date().toISOString(),
    };

    const suggestions = STRESS_HABITS[gfNoteCategory].map((t) => ({ text: t, done: false, streak: 0, lastDone: "" }));
    const mergedHabits = [...(gfDayState.habits || [])];
    suggestions.forEach((h) => {
      if (!mergedHabits.some((mh) => mh.text === h.text)) mergedHabits.push(h);
    });

    const nextDay = { notes: [...(gfDayState.notes || []), note], habits: mergedHabits };
    setGfNotes({ ...gfNotes, [gfSelectedDay]: nextDay });
    setGfNoteText("");
  };

  const removeGfNote = (idx) => {
    const nextNotes = [...(gfDayState.notes || [])];
    nextNotes.splice(idx, 1);
    const nextDay = { ...gfDayState, notes: nextNotes };
    setGfNotes({ ...gfNotes, [gfSelectedDay]: nextDay });
  };

  const toggleGfHabit = (idx) => {
    const nextHabits = [...(gfDayState.habits || [])];
    const h = nextHabits[idx];
    const today = gfSelectedDay;

    if (!h.done) {
      h.done = true;
      h.streak = (h.streak || 0) + 1;
      h.lastDone = today;
    } else if (h.lastDone === today) {
      h.done = false;
      h.streak = Math.max(0, (h.streak || 0) - 1);
      h.lastDone = "";
    }
    const nextDay = { ...gfDayState, habits: nextHabits };
    setGfNotes({ ...gfNotes, [gfSelectedDay]: nextDay });
  };

  // Pie for GF notes that day
  const gfCategoryCounts = useMemo(() => {
    const counts = STRESS_CATEGORIES.map(
      (cat) => (gfDayState.notes || []).filter((n) => n.category === cat).length
    );
    return STRESS_CATEGORIES.map((cat, i) => ({ name: cat, value: counts[i] })).filter((x) => x.value > 0);
  }, [gfDayState.notes]);

  const gfRangeLabel = useMemo(() => {
    if (!gfStartDate || !gfEndDate) return "";
    const start = new Date(gfStartDate).toLocaleDateString();
    const end = new Date(gfEndDate).toLocaleDateString();
    return `${start} to ${end}`;
  }, [gfStartDate, gfEndDate]);

  const SimpleTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <p className="label">
            <strong>{label}</strong>
          </p>
          <p className="intro" style={{ color: payload[0].color }}>
            {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  /* -------- Persist GF day (debounced on changes) -------- */
  const gfSaveTimer = useRef(null);
  useEffect(() => {
    if (!gfSelectedDay) return;
    if (gfSaveTimer.current) clearTimeout(gfSaveTimer.current);
    gfSaveTimer.current = setTimeout(async () => {
      try {
        const day = gfNotes[gfSelectedDay];
        const pt = gfSeries.find((p) => p.date === gfSelectedDay);
        if (!day && !pt) return;
        await StressAPI.upsertDay({
          date: gfSelectedDay,
          gf: {
            stressIndex: pt?.stressIndex ?? undefined,
            notes: day?.notes || [],
            habits: day?.habits || [],
          },
        });
      } catch (e) {
        console.warn("Save GF failed:", e?.message || e);
      }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gfNotes, gfSelectedDay, gfSeries]);

  /* ---------------- Header Status ---------------- */
  const headerValue = source === "manual" ? manualSelectedAvg : gfSelectedPoint?.stressIndex ?? null;
  const headerLabel = source === "manual" ? stressLabelManual(headerValue) : stressLabelGF(headerValue);
  const headerClass = source === "manual" ? stressClassManual(headerValue) : stressClassGF(headerValue);
  const headerSuffix = source === "manual" ? (headerValue == null ? "" : " / 10") : (headerValue == null ? "" : " / 100");
  const headerDateTag = source === "manual" ? selectedDate : gfSelectedDay || "-";

  /* ---------------- UI ---------------- */
  return (
    <div className={styles.trackerPage}>
      <Container>
        <div className={styles.header}>
          <div>
            <h2 className={styles.pageTitle}>Stress &amp; Habit Tracker</h2>
            <div className="text-muted small">Track stress, add triggers, and build simple habits daily.</div>
          </div>

          {/* Icon + level pill */}
          <div className={styles.levelPill + " " + headerClass} title={`For ${headerDateTag}`}>
            <Brain size={18} className={styles.levelIcon} />
            <span className={styles.levelText}>
              {headerValue == null ? "No data" : `${headerValue}${headerSuffix}`} • {headerLabel}
            </span>
            <span className={styles.levelDate}>{headerDateTag}</span>
          </div>
        </div>

        {/* Gamified day score */}
        <Card className={styles.card + " mb-3"}>
          <Card.Body className="d-flex flex-wrap align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <Trophy size={20} />
              <strong>Today’s Score:</strong> {dayScore}
              <Badge bg={dayRank.variant} className="ms-2">{dayRank.name}</Badge>
            </div>
            <div className="flex-grow-1" />
            <div style={{ minWidth: 220 }}>
              <div className="small text-muted mb-1">Daily progress</div>
              <ProgressBar now={dayProgress} label={`${dayProgress}%`} />
            </div>
          </Card.Body>
        </Card>

        {/* Source & Connection */}
        <Card className={styles.card + " mb-3"}>
          <Card.Body className="d-flex flex-column gap-3">
            <Row className="align-items-center g-3">
              <Col xs={12} md={6} className="d-flex align-items-center gap-2">
                <Form.Label className="fw-bold m-0">1) Choose Data Source</Form.Label>
                <Form.Select
                  aria-label="Data Source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  style={{ maxWidth: 260 }}
                  className={styles.field}
                >
                  <option value="manual">Manual</option>
                  <option value="googlefit" disabled={!isLinked}>
                    Google Fit {isLinked ? "" : "(connect on Dashboard)"}
                  </option>
                </Form.Select>
              </Col>

              <Col xs={12} md={6} className="d-flex align-items-center gap-3 justify-content-md-end">
                {isLinked ? (
                  <>
                    {account?.picture && <img src={account.picture} alt="avatar" className={styles.avatar} />}
                    <Badge bg="success">Connected</Badge>
                    <span className="text-muted small">{account?.name || account?.email}</span>
                    <Button size="sm" variant="outline-danger" onClick={unlinkGoogleFit} disabled={!unlinkGoogleFit}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge bg="secondary">Not Connected</Badge>
                    <Button size="sm" onClick={linkGoogleFit} disabled={!linkGoogleFit}>
                      Connect
                    </Button>
                  </>
                )}
              </Col>
            </Row>

            {/* GF Range */}
            {source === "googlefit" && isLinked && (
              <Row className="align-items-end g-3 pt-2 border-top">
                <Col xs={12}>
                  <Form.Label className="m-0 small fw-bold">2) Pick Range &amp; Load</Form.Label>
                </Col>
                <Col xs={6} md="auto">
                  <Form.Label className="small">Start</Form.Label>
                  <Form.Control
                    type="date"
                    value={gfStartDate}
                    onChange={(e) => setGfStartDate(e.target.value)}
                    className={`${styles.field} ${styles.dateInput}`}
                  />
                </Col>
                <Col xs={6} md="auto">
                  <Form.Label className="small">End</Form.Label>
                  <Form.Control
                    type="date"
                    value={gfEndDate}
                    onChange={(e) => setGfEndDate(e.target.value)}
                    className={`${styles.field} ${styles.dateInput}`}
                  />
                </Col>
                <Col xs="auto">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleRefreshGF}
                    disabled={healthLoading || !refreshStressIndex || new Date(gfStartDate) > new Date(gfEndDate)}
                  >
                    {healthLoading ? <Spinner animation="border" size="sm" className="me-2" /> : "Load Data"}
                  </Button>
                </Col>
                <Col xs={12} className="small text-muted">
                  Values are calibrated (min 10) and lightly smoothed. Low ≤ 40, Moderate 41–70, High &gt; 70.
                </Col>
              </Row>
            )}
          </Card.Body>
        </Card>

        {/* ========== Manual ========== */}
        {source === "manual" && (
          <>
            <Card className={styles.card + " mb-3"}>
              <Card.Body>
                <Form.Label className="fw-bold">Step A: Add Stress Trigger</Form.Label>
                <Row className="g-2 align-items-end">
                  <Col xs={12} md={3}>
                    <Form.Label className="small">Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className={`${styles.field} ${styles.dateInput}`}
                    />
                  </Col>
                  <Col xs={12} md={5}>
                    <Form.Label className="small">Trigger</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="What caused stress? (e.g., exam pressure)"
                      value={stressInput}
                      onChange={(e) => setStressInput(e.target.value)}
                      className={styles.field}
                    />
                  </Col>
                  <Col xs={6} md={2}>
                    <Form.Label className="small">Intensity (1–10)</Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      max="10"
                      value={stressIntensity}
                      onChange={(e) => setStressIntensity(Number(e.target.value))}
                      className={`${styles.field} ${styles.intensityInput}`}
                    />
                  </Col>
                  <Col xs={6} md={2}>
                    <Form.Label className="small">Category</Form.Label>
                    <Form.Select
                      value={stressCategory}
                      onChange={(e) => setStressCategory(e.target.value)}
                      className={`${styles.field} ${styles.categorySelect}`}
                    >
                      {STRESS_CATEGORIES.map((cat) => (
                        <option key={cat}>{cat}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col xs={12} md="auto">
                    <Button className={styles.addButton + " mt-2 mt-md-0"} onClick={addStress} disabled={!stressInput.trim()}>
                      Add (+{POINTS_TRIGGER})
                    </Button>
                  </Col>
                </Row>
                <div className="small text-muted mt-2">Tip: Adding a trigger auto-suggests simple habits for that category.</div>
              </Card.Body>
            </Card>

            <Row className="g-3">
              <Col md={6}>
                <Card className={styles.card}>
                  <Card.Body>
                    <h5 className={styles.cardTitle}>Your Triggers</h5>
                    {(currentDay.stress || []).length === 0 && <div className="small text-muted">No triggers for this date yet.</div>}
                    <ul className={styles.list}>
                      <AnimatePresence>
                        {(currentDay.stress || []).map((s, i) => (
                          <motion.li key={`${s.text}-${i}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={styles.listItem}>
                            <span>
                              {s.text} <Badge bg="danger">{s.intensity}</Badge> <Badge bg="secondary">{s.category}</Badge>
                            </span>
                            <Button variant="outline-danger" size="sm" onClick={() => removeStress(i)} title="Remove">
                              <Trash2 size={16} />
                            </Button>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </Card.Body>
                </Card>
              </Col>

              <Col md={6}>
                <Card className={styles.card}>
                  <Card.Body>
                    <h5 className={styles.cardTitle}>Suggested Habits</h5>
                    {(currentDay.habits || []).length === 0 && <div className="small text-muted">Add a trigger to see suggestions.</div>}
                    <ul className={styles.list}>
                      <AnimatePresence>
                        {(currentDay.habits || []).map((h, i) => (
                          <motion.li key={`${h.text}-${i}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={styles.listItem}>
                            <span>
                              {h.text} <Badge bg="success">Streak: {h.streak}</Badge>
                              {h.lastDone === selectedDate && <Badge bg="info" className="ms-2">Done Today</Badge>}
                            </span>
                            <Button
                              variant={h.done && h.lastDone === selectedDate ? "success" : "outline-secondary"}
                              size="sm"
                              onClick={() => toggleHabit(i)}
                              title={h.done && h.lastDone === selectedDate ? "Undo (today)" : `Mark (+${POINTS_HABIT})`}
                            >
                              {h.done && h.lastDone === selectedDate ? <CheckCircle size={16} /> : "Mark"}
                            </Button>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Row className="g-3 mt-1">
              <Col md={6}>
                <Card className={styles.card}>
                  <Card.Body>
                    <h5 className={styles.cardTitle}>Weekly Stress (Line)</h5>
                    <ResponsiveContainer width="100%" height={250}>
                      {weeklyStats.length > 0 ? (
                        <LineChart data={weeklyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="stressAvg" stroke="#EF4444" name="Avg Stress" />
                        </LineChart>
                      ) : (
                        <div className="small text-muted text-center mt-5">Add at least one day with a trigger to see the chart.</div>
                      )}
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>

              <Col md={6}>
                <Card className={styles.card}>
                  <Card.Body>
                    <h5 className={styles.cardTitle}>Categories (Pie)</h5>
                    <ResponsiveContainer width="100%" height={250}>
                      {categoryCountsManual.length > 0 ? (
                        <PieChart>
                          <Pie data={categoryCountsManual} dataKey="value" nameKey="name" outerRadius={80} label>
                            {categoryCountsManual.map((_, i) => (
                              <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      ) : (
                        <div className="small text-muted text-center mt-5">No category data for this date.</div>
                      )}
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}

        {/* ========== Google Fit (active days with stress, calibrated & smoothed) ========== */}
        {source === "googlefit" && isLinked && (
          <>
            <Card className={styles.card + " mb-3"}>
              <Card.Body>
                <Form.Label className="fw-bold">Step 3: Review Stress Index</Form.Label>
                <div className="small text-muted mb-2">
                  The chart shows only days where Google Fit reported a stress value and any activity. Values are calibrated (min 10) and smoothed.
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  {gfSeries.length > 0 ? (
                    <LineChart data={gfSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip content={<SimpleTooltip />} />
                      <Line type="monotone" dataKey="stressIndex" stroke="#EF4444" name="Stress Index" />
                    </LineChart>
                  ) : (
                    <div className="small text-muted text-center mt-5">No stress values in {gfRangeLabel}. Try a different range.</div>
                  )}
                </ResponsiveContainer>
              </Card.Body>
            </Card>

            <Card className={styles.card + " mb-3"}>
              <Card.Body>
                <Form.Label className="fw-bold">Step 4: Add Notes &amp; Get Suggestions</Form.Label>

                {gfSeries.length === 0 && (
                  <Alert variant="secondary" className="mb-3">
                    Load data first, then pick a day to add notes.
                  </Alert>
                )}

                <Row className="g-2 align-items-end">
                  <Col xs={12} md={4}>
                    <Form.Label className="small">Day</Form.Label>
                    <Form.Select
                      value={gfSelectedDay}
                      onChange={(e) => setGfSelectedDay(e.target.value)}
                      disabled={gfSeries.length === 0}
                      aria-label="Select Google Fit day"
                      className={styles.field}
                    >
                      {gfSeries.map((p) => (
                        <option key={p.date} value={p.date}>
                          {p.date} — Stress {p.stressIndex}/100
                        </option>
                      ))}
                    </Form.Select>
                  </Col>

                  <Col xs={6} md={2}>
                    <Form.Label className="small">Stress</Form.Label>
                    <Form.Control
                      type="text"
                      value={gfSelectedPoint ? `${gfSelectedPoint.stressIndex} / 100` : "-"}
                      readOnly
                      className={styles.field}
                    />
                  </Col>

                  <Col xs={6} md={3}>
                    <Form.Label className="small">Category</Form.Label>
                    <Form.Select
                      value={gfNoteCategory}
                      onChange={(e) => setGfNoteCategory(e.target.value)}
                      aria-label="GF note category"
                      className={styles.field}
                    >
                      {STRESS_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Form.Select>
                  </Col>

                  <Col xs={12} md={9}>
                    <Form.Label className="small">Trigger / Note</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Add a short note (e.g., tough meeting, travel delay)"
                      value={gfNoteText}
                      onChange={(e) => setGfNoteText(e.target.value)}
                      className={styles.field}
                    />
                  </Col>
                  <Col xs={12} md={3} className="d-grid">
                    <Button variant="primary" onClick={addGfNote} disabled={!gfSelectedDay || !gfNoteText.trim() || !gfSelectedPoint}>
                      Add
                    </Button>
                  </Col>
                </Row>

                <div className="small text-muted mt-2">Adding a note auto-suggests simple habits for that category.</div>

                {/* Notes */}
                <div className="mt-3">
                  <h6 className="text-muted">
                    Notes for <strong>{gfSelectedDay || "—"}</strong>
                  </h6>
                  {(gfDayState.notes || []).length === 0 ? (
                    <div className="small text-muted">No notes for this day yet.</div>
                  ) : (
                    <ul className={styles.list}>
                      <AnimatePresence>
                        {(gfDayState.notes || []).map((n, idx) => (
                          <motion.li key={`${n.text}-${idx}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className={styles.listItem}>
                            <span>
                              {n.text} <Badge bg="secondary" className="me-1">{n.category}</Badge>
                              <Badge bg="danger" className="me-1">{n.stressIndex}</Badge>
                            </span>
                            <Button variant="outline-danger" size="sm" onClick={() => removeGfNote(idx)} title="Delete note">
                              <Trash2 size={16} />
                            </Button>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </div>

                {/* Suggestions */}
                <div className="mt-3">
                  <h6 className="text-muted">Suggested Habits</h6>
                  {(gfDayState.habits || []).length === 0 ? (
                    <div className="small text-muted">Add a note with a category to see suggestions.</div>
                  ) : (
                    <ul className={styles.list}>
                      <AnimatePresence>
                        {(gfDayState.habits || []).map((h, i) => (
                          <motion.li key={`${h.text}-${i}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className={styles.listItem}>
                            <span>
                              {h.text} <Badge bg="success">Streak: {h.streak}</Badge>
                              {h.lastDone === gfSelectedDay && <Badge bg="info" className="ms-2">Done Today</Badge>}
                            </span>
                            <Button
                              variant={h.done && h.lastDone === gfSelectedDay ? "success" : "outline-secondary"}
                              size="sm"
                              onClick={() => toggleGfHabit(i)}
                              title={h.done && h.lastDone === gfSelectedDay ? "Undo (today)" : `Mark (+${POINTS_HABIT})`}
                            >
                              {h.done && h.lastDone === gfSelectedDay ? <CheckCircle size={16} /> : "Mark"}
                            </Button>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </div>

                {/* GF Categories Pie */}
                <div className="mt-3">
                  <h6 className="text-muted">Categories (Notes for this day)</h6>
                  <ResponsiveContainer width="100%" height={250}>
                    {gfCategoryCounts.length > 0 ? (
                      <PieChart>
                        <Pie data={gfCategoryCounts} dataKey="value" nameKey="name" outerRadius={80} label>
                          {gfCategoryCounts.map((_, i) => (
                            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    ) : (
                      <div className="small text-muted text-center mt-5">No category notes yet for this day.</div>
                    )}
                  </ResponsiveContainer>
                </div>
              </Card.Body>
            </Card>
          </>
        )}

        {/* If GF selected but not linked */}
        {source === "googlefit" && !isLinked && (
          <Card className={styles.card + " text-center p-5 mb-5"}>
            <p className="mb-3 text-muted">To view automated stress metrics, please connect your Google Fit account.</p>
            <Button onClick={linkGoogleFit} disabled={!linkGoogleFit} variant="success">
              Connect Google Fit Now
            </Button>
          </Card>
        )}
      </Container>
    </div>
  );
}
