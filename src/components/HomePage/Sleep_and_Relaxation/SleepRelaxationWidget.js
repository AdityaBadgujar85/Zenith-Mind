// src/components/HomePage/Sleep_and_Relaxation/SleepRelaxationWidget.jsx
import React, { useState, useRef, useEffect, useContext, useMemo, useCallback } from "react";
import {
  Container, Row, Col, Card, Button, Form, ProgressBar, ListGroup, Spinner, Badge
} from "react-bootstrap";
import { GoogleFitContext } from "../../../context/GoogleFitProvider";

import rainMp3 from "../../Audio/rain.mp3";
import oceanMp3 from "../../Audio/ocean.mp3";
import whiteNoiseMp3 from "../../Audio/white_noise.mp3";

import classes from "./SleepRelaxationWidget.module.css";

/* =========================
   Static Data
========================= */
const SOUNDS = [
  { id: "rain", name: "Gentle Rain", url: rainMp3 },
  { id: "ocean", name: "Ocean Waves", url: oceanMp3 },
  { id: "white-noise", name: "White Noise", url: whiteNoiseMp3 },
];

const BEDTIME_TIPS = [
  "Keep screens away 30 minutes before bed — blue light affects sleep.",
  "Maintain a regular sleep schedule, even on weekends.",
  "Make your bedroom cool, quiet, and dark for better sleep.",
  "Limit caffeine after 2 PM and avoid heavy meals late at night.",
  "Try light stretching or meditation before bedtime.",
  "Use a comfortable pillow and mattress that support good posture.",
  "Avoid checking your phone when you wake up at night.",
  "Write down thoughts to clear your mind before bed.",
];

/* API base + token helpers */
const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  "" ||
  "http://localhost:7000";

const getToken = () =>
  localStorage.getItem("admin_token") ||
  localStorage.getItem("auth_token") ||
  localStorage.getItem("token") ||
  "";

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* =========================
   Utils
========================= */
const formatDuration = (ms) => {
  if (!ms) return "00:00:00";
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
};
const iso = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

/* =========================
   Charts (SVG, no deps)
========================= */
// (DonutGauge, LineArea14, Bars7 are unchanged from your version)
function DonutGauge({ avgHours, goalHours = 8, size = 180 }) {
  const pct = Math.max(0, Math.min(1, (goalHours || 1) ? avgHours / goalHours : 0));
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = Math.PI * 2 * r;
  const dash = pct * c;
  const color =
    pct >= 1 ? "#198754" : pct >= 0.75 ? "#0d6efd" : pct >= 0.5 ? "#fd7e14" : "#dc3545";
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} className={classes.donut}>
      <defs>
        <linearGradient id="donutGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9ecef" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#donutGrad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fontWeight="700" fontSize="28">
        {avgHours.toFixed(1)}h
      </text>
      <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#6c757d">
        Avg vs {goalHours}h
      </text>
    </svg>
  );
}

function LineArea14({ points, height = 200, pad = 28 }) {
  const width = 680;
  const maxY = Math.max(1, ...points.map((p) => p.hours));
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const stepX = innerW / Math.max(1, points.length - 1);
  const mapX = (i) => pad + i * stepX;
  const mapY = (h) => pad + innerH - (h / (maxY || 1)) * innerH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${mapX(i)} ${mapY(p.hours)}`).join(" ");
  const area =
    `M ${mapX(0)} ${mapY(points[0]?.hours ?? 0)} ` +
    points.map((p, i) => `L ${mapX(i)} ${mapY(p.hours)}`).join(" ") +
    ` L ${mapX(points.length - 1)} ${pad + innerH} L ${mapX(0)} ${pad + innerH} Z`;

  const [hover, setHover] = useState(null);
  const onEnter = (evt, i) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    setHover({ i, left: evt.clientX - rect.left, top: evt.clientY - rect.top });
  };
  const onLeave = () => setHover(null);

  return (
    <div className={classes.chartWrap}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className={classes.cardSvg}>
        <rect x="0" y="0" width={width} height={height} rx="12" fill="var(--bs-body-bg,#fff)" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad + innerH * (1 - t);
          return <line key={t} x1={pad} x2={width - pad} y1={y} y2={y} stroke="#f1f3f5" />;
        })}
        {points.map((p, i) =>
          i % Math.ceil(points.length / 7 || 1) === 0 ? (
            <text key={p.label} x={mapX(i)} y={height - 6} fontSize="11" textAnchor="middle" fill="#6c757d">
              {p.label}
            </text>
          ) : null
        )}
        <defs>
          <linearGradient id="area14" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d6efd" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0d6efd" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#area14)" />
        <path d={path} fill="none" stroke="#0d6efd" strokeWidth="2.5" />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={mapX(i)}
              cy={mapY(p.hours)}
              r={4}
              fill="#0d6efd"
              onMouseEnter={(e) => onEnter(e, i)}
              onMouseMove={(e) => onEnter(e, i)}
              onMouseLeave={onLeave}
              style={{ cursor: "pointer" }}
            />
          </g>
        ))}
      </svg>
      {hover && (
        <div className={classes.tooltip} style={{ left: hover.left, top: hover.top }}>
          <div className="fw-bold">{points[hover.i].hours.toFixed(1)}h</div>
          <div className="small text-muted">{points[hover.i].date}</div>
        </div>
      )}
    </div>
  );
}

function Bars7({ days, goal = 8, height = 200, pad = 28 }) {
  const width = 680;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const barGap = 12;
  const barW = (innerW - barGap * (days.length - 1)) / Math.max(1, days.length);
  const maxH = Math.max(goal, ...days.map((d) => d.hours));
  const mapX = (i) => pad + i * (barW + barGap);
  const mapY = (h) => pad + innerH - (h / (maxH || 1)) * innerH;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className={classes.cardSvg}>
      <rect x="0" y="0" width={width} height={height} rx="12" fill="var(--bs-body-bg,#fff)" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad + innerH * (1 - t);
        return <line key={t} x1={pad} x2={width - pad} y1={y} y2={y} stroke="#f1f3f5" />;
      })}
      <line x1={pad} x2={width - pad} y1={mapY(goal)} y2={mapY(goal)} stroke="#adb5bd" strokeDasharray="6 6" />
      <text x={width - pad} y={mapY(goal) - 6} fontSize="11" textAnchor="end" fill="#6c757d">
        Goal {goal}h
      </text>
      {days.map((d, i) => {
        const x = mapX(i);
        const y = mapY(d.hours);
        const h = pad + innerH - y;
        const pct = d.hours / goal;
        const fill = pct >= 1 ? "#198754" : pct >= 0.75 ? "#0d6efd" : "#fd7e14";
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={h} rx="8" fill={fill} />
            <text x={x + barW / 2} y={height - 6} fontSize="11" textAnchor="middle" fill="#6c757d">
              {d.label}
            </text>
            <text x={x + barW / 2} y={y - 6} fontSize="10" textAnchor="middle" fill="#6c757d">
              {d.hours.toFixed(1)}h
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* =========================
   Component
========================= */
export default function SleepRelaxationWidget() {
  const {
    account,
    statusLoading,
    sleepLoading,         // may be undefined in your provider; that's okay
    lastError,
    fetchSleep,           // returns { sleep, error }
    linkGoogleFit,
    unlinkGoogleFit,
  } = useContext(GoogleFitContext);

  const isLinked = !!account?.linked;

  // ✅ Default once from link status; don’t override user choice later
  const [sleepSource, setSleepSource] = useState(() => (isLinked ? "googlefit" : "timer"));

  // When user becomes UNlinked, force back to timer and drop GF-only rows
  useEffect(() => {
    if (!isLinked && sleepSource === "googlefit") {
      setSleepSource("timer");
      setSessions((prev) => prev.filter((s) => s.source === "timer"));
    }
    // deliberately NOT reacting to sleepSource here — avoid fighting the user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLinked]);

  const [sessions, setSessions] = useState([]);
  const [runningSession, setRunningSession] = useState(null);
  const [goalHours, setGoalHours] = useState(8);

  const [selectedSound, setSelectedSound] = useState(SOUNDS[0].id);
  const [volume, setVolume] = useState(0.5);
  const [isLoop, setIsLoop] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef(null);

  /* Fetch Google Fit when selected */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sleepSource !== "googlefit" || !isLinked) return;
      const { sleep, error } = await fetchSleep();
      if (cancelled) return;
      if (!error) {
        const rows = (sleep || []).map((s) => ({ ...s, source: "googlefit" }));
        setSessions((prev) => {
          const manual = prev.filter((p) => p.source === "timer");
          return [...rows, ...manual].sort((a, b) => new Date(b.start) - new Date(a.start));
        });

        // Persist to DB (safe upsert)
        try {
          await apiFetch("/api/sleep/bulk-upsert", {
            method: "POST",
            body: JSON.stringify({
              sessions: rows.map((r) => ({
                start: r.start,
                end: r.end,
                duration: r.duration,
                quality: r.quality,
                soundId: r.soundId,
                source: "googlefit",
              })),
            }),
          });
        } catch (e) {
          console.warn("bulk-upsert sleep failed:", e.message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sleepSource, isLinked, fetchSleep]);

  /* Audio handling */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.loop = isLoop;

    const updateTime = () => setAudioProgress(audio.currentTime);
    const setMeta = () => setAudioDuration(audio.duration || 0);
    const stopPlay = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", setMeta);
    audio.addEventListener("ended", stopPlay);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", setMeta);
      audio.removeEventListener("ended", stopPlay);
    };
  }, [volume, isLoop, selectedSound]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play().catch(console.error);
    setIsPlaying(!isPlaying);
  };

  const seekAudio = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
    setAudioProgress(audio.currentTime);
  };

  /* Timer tick */
  useEffect(() => {
    if (!runningSession) return;
    const interval = setInterval(() => setRunningSession((s) => ({ ...s })), 1000);
    return () => clearInterval(interval);
  }, [runningSession]);

  const startSession = () => {
    if (runningSession || sleepSource !== "timer") return;
    setRunningSession({ start: Date.now() });
  };

  const stopSession = async () => {
    if (!runningSession) return;
    const end = Date.now();
    const duration = end - runningSession.start;
    const goalMs = goalHours * 3600000;
    const percentage = Math.min(100, (duration / goalMs) * 100);
    const quality = Math.max(1, Math.round(percentage / 10));

    const newSession = {
      _id: Date.now(),
      start: iso(runningSession.start),
      end: iso(end),
      duration,
      quality,
      source: "timer",
      soundId: selectedSound,
    };

    setSessions((prev) => [newSession, ...prev]);
    setRunningSession(null);

    try {
      await apiFetch("/api/sleep", {
        method: "POST",
        body: JSON.stringify({
          start: newSession.start,
          end: newSession.end,
          duration: newSession.duration,
          quality: newSession.quality,
          soundId: newSession.soundId,
          source: "timer",
        }),
      });
    } catch (e) {
      console.warn("save manual sleep failed:", e.message);
    }
  };

  const deleteSession = async (id) => {
    setSessions((prev) => prev.filter((s) => (s._id || s.start) !== id));
    try {
      await apiFetch(`/api/sleep/${id}`, { method: "DELETE" });
    } catch {}
  };

  /* Aggregations */
  const totalMs = useMemo(() => sessions.reduce((a, b) => a + (b.duration || 0), 0), [sessions]);
  const avgMs = useMemo(() => (sessions.length ? totalMs / sessions.length : 0), [sessions, totalMs]);
  const progress = Math.min(100, Math.round((avgMs / (goalHours * 3600000)) * 100));
  const avgHours = avgMs / 3600000;

  const dailyData = useMemo(() => {
    const map = {};
    for (const s of sessions) {
      const d = new Date(s.start);
      const label = d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
      const full = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      map[label] = map[label] || { date: full, label, hours: 0 };
      map[label].hours += (s.duration || 0) / 3600000;
    }
    return Object.values(map).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions]);

  const last7 = dailyData.slice(-7);
  const last14 = dailyData.slice(-14);

  const GoogleFitStatus = (
    <div className="d-inline-flex align-items-center gap-2">
      {statusLoading ? (
        <Spinner animation="border" size="sm" />
      ) : isLinked ? (
        <>
          {account.picture ? (
            <img src={account.picture} alt="avatar" style={{ width: 24, height: 24, borderRadius: "50%" }} />
          ) : null}
          <Badge bg="success">Connected</Badge>
          <span className="text-muted small">{account.name || account.email}</span>
        </>
      ) : (
        <Badge bg="secondary">Not Connected</Badge>
      )}
    </div>
  );

  const showLoader = sleepSource === "googlefit" && (statusLoading || (isLinked && sleepLoading));
  const bars7 = last7.map((d) => ({ label: d.label, date: d.date, hours: d.hours || 0 }));
  const trend14 = last14.map((d) => ({ label: d.label, date: d.date, hours: d.hours || 0 }));
  const selectedSoundObj = SOUNDS.find((s) => s.id === selectedSound) || SOUNDS[0];

  const handleRefresh = useCallback(async () => {
    if (sleepSource !== "googlefit" || !isLinked) return;
    const { sleep, error } = await fetchSleep();
    if (!error) {
      const rows = (sleep || []).map((s) => ({ ...s, source: "googlefit" }));
      setSessions((prev) => {
        const manual = prev.filter((p) => p.source === "timer");
        return [...rows, ...manual].sort((a, b) => new Date(b.start) - new Date(a.start));
      });
      try {
        await apiFetch("/api/sleep/bulk-upsert", {
          method: "POST",
          body: JSON.stringify({
            sessions: rows.map((r) => ({
              start: r.start,
              end: r.end,
              duration: r.duration,
              quality: r.quality,
              soundId: r.soundId,
              source: "googlefit",
            })),
          }),
        });
      } catch (e) {
        console.warn("bulk-upsert sleep failed:", e.message);
      }
    }
  }, [sleepSource, isLinked, fetchSleep]);

  return (
    <div className={classes.page}>
      <Container>
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className={classes.title}>🌙 Sleep & Relaxation</h2>
          <p className={`${classes.subtitle} text-muted`}>
            Track your sleep, play calming sounds, and visualize your progress.
          </p>
        </div>

        {/* Source + GF Controls */}
        <Card className={`${classes.card} mb-4`}>
          <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-2">
              <Form.Label className="fw-bold m-0">Data Source</Form.Label>
              <Form.Select
                value={sleepSource}
                onChange={(e) => setSleepSource(e.target.value)}
                style={{ width: 220 }}
              >
                <option value="timer">Manual Timer</option>
                <option value="googlefit" disabled={!isLinked}>
                  Google Fit {isLinked ? "" : "(connect on Dashboard)"}
                </option>
              </Form.Select>
            </div>

            {sleepSource === "googlefit" && (
              <div className="d-flex align-items-center gap-3">
                {GoogleFitStatus}
                {!isLinked ? (
                  <Button size="sm" onClick={linkGoogleFit}>Connect</Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline-primary" onClick={handleRefresh}>
                      Refresh
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={unlinkGoogleFit}>
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            )}
          </Card.Body>
          {lastError && (
            <Card.Footer className="text-center">
              <small className="text-danger">{lastError}</small>
            </Card.Footer>
          )}
        </Card>

        {showLoader && (
          <div className="text-center my-4">
            <Spinner animation="border" />
            <div className="mt-2 small text-muted">
              {statusLoading ? "Checking Google Fit link…" : "Loading sleep from Google Fit…"}
            </div>
          </div>
        )}

        <Row className="g-4">
          {/* Left Column: Gauges + Tracker */}
          <Col lg={6}>
            <Card className={classes.card}>
              <Card.Body className="d-flex align-items-center gap-4">
                <div style={{ flex: "0 0 220px" }}>
                  <DonutGauge avgHours={avgHours || 0} goalHours={goalHours} />
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex flex-wrap gap-4">
                    <div>
                      <div className="small text-muted">Total</div>
                      <div className="fs-4 fw-bold">{formatDuration(totalMs)}</div>
                    </div>
                    <div>
                      <div className="small text-muted">Average</div>
                      <div className="fs-4 fw-bold">{formatDuration(avgMs)}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="small text-muted mb-1">Progress vs goal</div>
                    <ProgressBar
                      now={Math.max(0, Math.min(100, progress))}
                      label={`${Math.max(0, Math.min(100, progress))}%`}
                      style={{ height: 18, borderRadius: 12 }}
                    />
                  </div>
                  <Form.Group className="mt-3">
                    <Form.Label>Sleep Goal (hours)</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      max={24}
                      value={goalHours}
                      onChange={(e) => setGoalHours(Number(e.target.value))}
                      style={{ width: 120 }}
                    />
                  </Form.Group>
                </div>
              </Card.Body>
            </Card>

            <Card className={`${classes.card} mt-4`}>
              <Card.Body>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h5 className="m-0">Sleep Tracker</h5>
                  <Badge bg="light" text="dark">
                    {goalHours}h/day goal
                  </Badge>
                </div>

                {sleepSource === "timer" && (
                  <>
                    <div className="mb-3">
                      <Button onClick={startSession} disabled={!!runningSession} className="me-2">
                        Start
                      </Button>
                      <Button variant="danger" onClick={stopSession} disabled={!runningSession}>
                        Stop
                      </Button>
                    </div>
                    <p className="text-muted">
                      Current:{" "}
                      <strong>
                        {runningSession ? formatDuration(Date.now() - runningSession.start) : "--:--:--"}
                      </strong>
                    </p>
                  </>
                )}

                <h6 className="mt-3">Recent Sessions</h6>
                <ListGroup style={{ maxHeight: 230, overflowY: "auto" }}>
                  {sessions.length === 0 ? (
                    <ListGroup.Item className="text-muted">No sessions recorded.</ListGroup.Item>
                  ) : (
                    sessions.map((s) => (
                      <ListGroup.Item
                        key={s._id || s.start}
                        className="d-flex justify-content-between align-items-center"
                      >
                        <span>
                          {new Date(s.start).toLocaleString()} —{" "}
                          <strong>{formatDuration(s.duration)}</strong> ({s.quality || 5}/10)
                          {s.source === "googlefit" && <Badge bg="info" className="ms-2">GF</Badge>}
                        </span>
                        {s.source === "timer" && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => deleteSession(s._id || s.start)}
                          >
                            🗑
                          </Button>
                        )}
                      </ListGroup.Item>
                    ))
                  )}
                </ListGroup>
              </Card.Body>
            </Card>
          </Col>

          {/* Right Column: Sounds + Charts + Tips */}
          <Col lg={6}>
            <Card className={classes.card}>
              <Card.Body>
                <h5>Relaxation Sounds</h5>
                <div className="mb-2">
                  {SOUNDS.map((s) => (
                    <Button
                      key={s.id}
                      variant={selectedSound === s.id ? "primary" : "outline-primary"}
                      className="me-2 mb-2"
                      onClick={() => setSelectedSound(s.id)}
                    >
                      {s.name}
                    </Button>
                  ))}
                </div>

                <audio ref={audioRef} src={selectedSoundObj.url} loop={isLoop} preload="auto" />

                <div className="d-flex align-items-center gap-2 mt-3">
                  <Button onClick={togglePlay} variant={isPlaying ? "secondary" : "success"}>
                    {isPlaying ? "❚ Pause" : "▶ Play"}
                  </Button>
                  <Form.Range
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="text-muted small">Vol: {Math.round(volume * 100)}%</span>
                </div>

                <div className="mt-2">
                  <Form.Range
                    min="0"
                    max={audioDuration || 0}
                    step="1"
                    value={audioProgress}
                    onChange={seekAudio}
                  />
                  <div className="d-flex justify-content-between small text-muted">
                    <span>{formatDuration(audioProgress * 1000)}</span>
                    <span>{formatDuration(audioDuration * 1000)}</span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card className={`${classes.card} mt-4`}>
              <Card.Body>
                <h5>7-Day Sleep Trend</h5>
                <Bars7 days={last7.map((d) => ({ label: d.label, date: d.date, hours: d.hours || 0 }))} goal={goalHours} />
              </Card.Body>
            </Card>

            <Card className={`${classes.card} mt-4`}>
              <Card.Body>
                <h5>14-Day Trend</h5>
                <LineArea14 points={last14.map((d) => ({ label: d.label, date: d.date, hours: d.hours || 0 }))} />
              </Card.Body>
            </Card>

            <Card className={`${classes.card} mt-4`}>
              <Card.Body>
                <h5 className="mb-3">Bedtime Tip</h5>
                <p className="text-primary">{BEDTIME_TIPS[tipIndex]}</p>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => setTipIndex((tipIndex + 1) % BEDTIME_TIPS.length)}
                >
                  Next Tip
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
