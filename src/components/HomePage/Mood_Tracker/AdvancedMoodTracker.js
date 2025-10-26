// src/components/AdvancedMoodTracker/AdvancedMoodTracker.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
  useRef,
  useCallback,
} from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { Save, Upload, Trash2, Calendar, Camera, Activity } from "lucide-react";
import { Container, Row, Col, Button, Form, Card, Badge, Modal, Alert } from "react-bootstrap";
import { AppDataContext } from "../../../App";

const MOOD_SCALE = [
  { value: 1, label: "Terrible", emoji: "😫" },
  { value: 2, label: "Bad", emoji: "😕" },
  { value: 3, label: "Okay", emoji: "😌" },
  { value: 4, label: "Good", emoji: "🙂" },
  { value: 5, label: "Great", emoji: "😁" },
];

const COLORS = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"];
const PREDICT_API =
  process.env.REACT_APP_MOOD_API || "http://localhost:5055/api/mood/predict";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  "" || "http://localhost:7000";

const getToken = () =>
  localStorage.getItem("admin_token") ||
  localStorage.getItem("auth_token") ||
  localStorage.getItem("token") || "";

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function AdvancedMoodTracker() {
  const { moodEntries, setMoodEntries } = useContext(AppDataContext);
  const [entries, setEntries] = useState(moodEntries || []);

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mood, setMood] = useState(4);
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [filterDays, setFilterDays] = useState(30);

  // webcam
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [detectorStatus, setDetectorStatus] = useState("idle"); // idle|running|error
  const [detecting, setDetecting] = useState(false);
  const [lastAuto, setLastAuto] = useState(null); // { dominant, moodValue }

  // camera modal state
  const [camModalOpen, setCamModalOpen] = useState(false);
  const [camDetected, setCamDetected] = useState(null); // { dominant, moodValue }
  const [camTags, setCamTags] = useState("");
  const [camNote, setCamNote] = useState("");

  // ---------- Load from DB on mount ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { mood: rows } = await apiFetch("/api/mood");
        if (cancelled) return;
        const normal = rows.map(r => ({
          id: r._id, _id: r._id,
          date: r.date,
          mood: r.mood,
          tags: r.tags || [],
          note: r.note || "",
          createdAt: r.createdAt,
        }));
        setEntries(normal);
      } catch (e) {
        console.warn("mood fetch failed:", e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // keep context in sync
  useEffect(() => setMoodEntries(entries), [entries, setMoodEntries]);

  // ---------- CRUD (DB-first, UI-optimistic) ----------
  const upsertToDb = async (payload) => {
    const { mood: saved } = await apiFetch("/api/mood", {
      method: "POST",
      body: JSON.stringify({
        date: payload.date,
        mood: payload.mood,
        tags: payload.tags,
        note: payload.note,
        createdAt: payload.createdAt,
      }),
    });
    return saved;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const payload = {
      id: uid(),
      date,
      mood: Number(mood),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      note,
      createdAt: new Date().toISOString(),
    };

    setEntries((prev) => {
      const map = new Map(prev.map((p) => [p.date, p]));
      map.set(payload.date, { ...(map.get(payload.date) || {}), ...payload });
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    });
    setTags(""); setNote("");

    try {
      const saved = await upsertToDb(payload);
      setEntries((prev) =>
        prev.map((e) => (e.date === saved.date ? {
          ...e, id: saved._id, _id: saved._id,
          date: saved.date, mood: saved.mood, tags: saved.tags, note: saved.note, createdAt: saved.createdAt,
        } : e))
      );
    } catch (e) {
      console.warn("mood upsert failed:", e.message);
    }
  };

  const removeEntry = async (_idOrLocalId) => {
    const entry = entries.find(e => e._id === _idOrLocalId || e.id === _idOrLocalId);
    if (!entry) return;
    if (!window.confirm("Delete this mood entry?")) return;

    setEntries((prev) => prev.filter((p) => (p._id || p.id) !== (entry._id || entry.id)));

    if (entry._id) {
      try {
        await apiFetch(`/api/mood/${entry._id}`, { method: "DELETE" });
      } catch (e) {
        console.warn("delete failed:", e.message);
      }
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Clear all mood entries? This cannot be undone.")) return;
    setEntries([]);
    try {
      await apiFetch("/api/mood/all", { method: "DELETE" });
    } catch (e) {
      console.warn("bulk delete failed:", e.message);
    }
  };

  // ---------- Webcam helpers ----------
  const startCamera = useCallback(async () => {
    try {
      setDetectorStatus("running");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        streamRef.current = stream;
      }
    } catch (err) {
      console.error(err);
      setDetectorStatus("error");
      alert("Camera error. Please check permissions/device.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setDetectorStatus("idle");
  }, []);

  const detectOnce = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setDetecting(true);
    try {
      const vid = videoRef.current;
      const canvas = canvasRef.current;
      const w = vid.videoWidth || 640;
      const h = vid.videoHeight || 480;
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(vid, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      const res = await fetch(PREDICT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Prediction failed");

      const { dominant, moodValue } = json;
      setMood(moodValue);
      setLastAuto({ dominant, moodValue });

      // open modal (defer save until user adds tags/note)
      setCamDetected({ dominant, moodValue });
      setCamTags(dominant || "");
      setCamNote("");
      setCamModalOpen(true);
    } catch (e) {
      console.error(e);
      setDetectorStatus("error");
      alert(e.message);
    } finally {
      setDetecting(false);
    }
  }, []);

  // Save flow for camera modal
  const saveCameraEntry = async () => {
    if (!camDetected) return;
    const today = format(new Date(), "yyyy-MM-dd");

    const extraTags = camTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      id: uid(),
      date: today,
      mood: Number(camDetected.moodValue),
      // Only user-provided tags; no auto/webcam added automatically
      tags: extraTags,
      // Optional default note without implying auto/webcam
      note: camNote || (camDetected.dominant ? `Detected — ${camDetected.dominant}` : ""),
      createdAt: new Date().toISOString(),
    };

    // optimistic
    setEntries((prev) => {
      const map = new Map(prev.map((p) => [p.date, p]));
      map.set(today, { ...(map.get(today) || {}), ...payload });
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    });

    setCamModalOpen(false);

    // persist
    try {
      const saved = await upsertToDb(payload);
      setEntries((prev) =>
        prev.map((e) => (e.date === saved.date ? {
          ...e, id: saved._id, _id: saved._id,
          date: saved.date, mood: saved.mood, tags: saved.tags, note: saved.note, createdAt: saved.createdAt,
        } : e))
      );
    } catch (e) {
      console.warn("mood auto upsert failed:", e.message);
    }
  };

  // ---------- CSV helpers (fix ESLint no-undef) ----------
  const exportCSV = useCallback(() => {
    const header = ["id", "date", "mood", "tags", "note", "createdAt"];
    const rows = entries.map((e) => [
      e._id || e.id || "",
      e.date,
      e.mood,
      (e.tags || []).join(";"),
      e.note || "",
      e.createdAt || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mood-tracker-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
  }, [entries]);

  const importCSV = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const lines = String(e.target.result).split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return alert("Invalid CSV format.");
      const imported = lines.slice(1).map((ln) => {
        const cols = ln.match(/(?:\"([^\"]*)\"|[^,]+)/g) || [];
        const unq = (s) => (s?.replace(/^"|"$/g, "").replace(/""/g, '"') || "");
        return {
          id: unq(cols[0]) || uid(),
          date: unq(cols[1]),
          mood: Number(unq(cols[2])),
          tags: unq(cols[3]) ? unq(cols[3]).split(";").map((t) => t.trim()) : [],
          note: unq(cols[4]) || "",
          createdAt: unq(cols[5]) || new Date().toISOString(),
        };
      });

      // optimistic merge by date
      setEntries((prev) => {
        const map = new Map(prev.map((p) => [p.date, p]));
        imported.forEach((i) => map.set(i.date, { ...(map.get(i.date) || {}), ...i }));
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      });

      // persist server-side bulk
      try {
        await apiFetch("/api/mood/import", {
          method: "POST",
          body: JSON.stringify({
            entries: imported.map((i) => ({
              date: i.date, mood: i.mood, tags: i.tags, note: i.note, createdAt: i.createdAt,
            })),
          }),
        });
        const { mood: rows } = await apiFetch("/api/mood");
        const normal = rows.map((r) => ({
          id: r._id, _id: r._id, date: r.date, mood: r.mood,
          tags: r.tags || [], note: r.note || "", createdAt: r.createdAt,
        }));
        setEntries(normal);
      } catch (err) {
        console.warn("CSV import upsert failed:", err.message);
      }
    };
    reader.readAsText(file);
  }, []);

  // ---------- Charts ----------
  const lineData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: filterDays }, (_, i) => {
      const d = subDays(today, filterDays - 1 - i);
      const key = format(d, "yyyy-MM-dd");
      const entry = entries.find((e) => e.date === key);
      return { date: key, label: format(d, "MMM d"), mood: entry ? entry.mood : null };
    });
  }, [entries, filterDays]);

  const pieData = useMemo(() => {
    const counts = MOOD_SCALE.map((m) => ({ mood: m.value, label: m.label, count: 0 }));
    entries.forEach((e) => {
      const idx = counts.findIndex((c) => c.mood === e.mood);
      if (idx >= 0) counts[idx].count++;
    });
    return counts.filter((c) => c.count > 0).map((c) => ({ name: c.label, value: c.count }));
  }, [entries]);

  const tagCounts = useMemo(() => {
    const tagMap = new Map();
    entries.forEach((e) => (e.tags || []).forEach((tag) => {
      const k = tag.toLowerCase();
      tagMap.set(k, (tagMap.get(k) || 0) + 1);
    }));
    return Array.from(tagMap, ([tag, count]) => ({ tag, count }));
  }, [entries]);

  const detectorChip = (
    <Badge
      bg={
        detectorStatus === "running"
          ? "success"
          : detectorStatus === "error"
          ? "danger"
          : "secondary"
      }
    >
      <Activity size={12} className="me-1" />
      {detectorStatus}
    </Badge>
  );

  return (
    <Container
      fluid
      className="py-5"
      style={{
        marginTop: "5rem",
        background: "linear-gradient(135deg, #f7fcfc, #ffffff)",
        minHeight: "100vh",
      }}
    >
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="fw-bold text-dark">Mood Tracker 📊</h2>
        </Col>
        <Col className="d-flex justify-content-end gap-2">
          <Button size="sm" variant="primary" onClick={exportCSV}>
            <Save size={16} /> Export
          </Button>
          <Form.Label className="btn btn-dark btn-sm m-0">
            <Upload size={16} /> Import
            <Form.Control
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])}
            />
          </Form.Label>
          <Button size="sm" variant="danger" onClick={clearAll}>
            <Trash2 size={16} /> Clear
          </Button>
        </Col>
      </Row>

      <Row>
        {/* LEFT: Form + Webcam */}
        <Col md={4}>
          <Card className="shadow-sm border-0 rounded-4 mb-4">
            <Card.Body>
              <Card.Title className="fw-semibold mb-3 text-dark">
                <Calendar size={18} /> Log / Edit Mood
              </Card.Title>

              {/* Webcam section */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <Camera size={16} />
                    <strong className="text-dark">Webcam detection</strong>
                  </div>
                  {detectorChip}
                </div>

                <div className="rounded border p-2 mt-2" style={{ background: "#f8f9fa"  }}>
                  <video ref={videoRef} style={{ width: "100%" }} playsInline muted />
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                </div>

                {/* Tip for better detection */}
                <Alert className="mt-2 mb-0 py-2 " >
                  For more accurate mood detection, please face the camera in good light and remove glasses or obstructions if possible.
                </Alert>

                <div className="d-flex gap-2 mt-2">
                  <Button size="sm" variant="primary" onClick={startCamera}>
                    Start Camera
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={detecting || detectorStatus === "idle"}
                    onClick={detectOnce}
                  >
                    {detecting ? "Detecting..." : "Detect Now"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={stopCamera}>
                    Stop
                  </Button>
                </div>

                {lastAuto && (
                  <div className="small text-muted mt-1">
                    last: <strong>{lastAuto.dominant}</strong> → mood <strong>{lastAuto.moodValue}</strong>
                  </div>
                )}
              </div>

              {/* Manual form */}
              <Form onSubmit={handleSubmit} className="text-dark">
                <Form.Group className="mb-3">
                  <Form.Label className="text-dark">Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Label className="text-dark">Mood</Form.Label>
                <div className="d-flex justify-content-between mb-3 flex-wrap gap-2">
                  {MOOD_SCALE.map((m) => (
                    <Button
                      key={m.value}
                      variant={mood === m.value ? "success" : "outline-secondary"}
                      onClick={() => setMood(m.value)}
                    >
                      <div style={{ fontSize: "1.5rem" }}>{m.emoji}</div>
                      <small className="text-dark">{m.label}</small>
                    </Button>
                  ))}
                </div>

                <Form.Group className="mb-3">
                  <Form.Label className="text-dark">Tags</Form.Label>
                  <Form.Control
                    placeholder="e.g. work, stress, gym"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="text-dark">Note</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Optional..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Form.Group>

                <div className="d-flex gap-2">
                  <Button type="submit" variant="success">
                    Save
                  </Button>
                  <Button
                    variant="warning"
                    onClick={() => {
                      setDate(format(new Date(), "yyyy-MM-dd"));
                      setMood(4);
                      setTags("");
                      setNote("");
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* RIGHT: Charts & Entries */}
        <Col md={8}>
          {/* Line Chart */}
          <Card className="shadow-sm border-0 rounded-4 mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title className="fw-semibold text-dark">Mood Over Time</Card.Title>
                <Form.Select
                  size="sm"
                  value={filterDays}
                  onChange={(e) => setFilterDays(Number(e.target.value))}
                  style={{ width: 140 }}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </Form.Select>
              </div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="mood" stroke="#007bff" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>

          <Row>
            {/* Pie Chart */}
            <Col md={4}>
              <Card className="shadow-sm border-0 rounded-4 mb-4">
                <Card.Body>
                  <Card.Title className="fw-semibold text-dark">Mood Distribution</Card.Title>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" outerRadius={70} label>
                          {pieData.map((entry, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Tags Bar Chart */}
            <Col md={8}>
              <Card className="shadow-sm border-0 rounded-4 mb-4">
                <Card.Body>
                  <Card.Title className="fw-semibold text-dark">Top Tags</Card.Title>
                  {tagCounts.length === 0 ? (
                    <small className="text-muted">No tags yet — add some!</small>
                  ) : (
                    <div style={{ height: 160 }}>
                      <ResponsiveContainer>
                        <BarChart data={tagCounts} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="tag" type="category" />
                          <Tooltip />
                          <Bar dataKey="count" fill="#36A2EB" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Entries */}
          <Card className="shadow-sm border-0 rounded-4">
            <Card.Body>
              <Card.Title className="fw-semibold text-dark">Entries</Card.Title>
              <div style={{ maxHeight: 250, overflowY: "auto" }}>
                {entries.length === 0 ? (
                  <small className="text-muted">
                    No entries yet — log your first mood to begin tracking.
                  </small>
                ) : (
                  entries.slice().reverse().map((e) => (
                    <div
                      key={e._id || e.id}
                      className="border rounded p-3 mb-2 d-flex justify-content-between align-items-start"
                    >
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span style={{ fontSize: "1.5rem" }}>
                            {MOOD_SCALE.find((m) => m.value === e.mood)?.emoji}
                          </span>
                          <div>
                            <div className="fw-semibold text-dark">
                              {format(parseISO(e.date), "EEE, MMM d, yyyy")}
                            </div>
                            <div className="text-muted small">
                              {(e.tags || []).join(", ")}
                            </div>
                          </div>
                        </div>
                        {e.note && <div className="mt-1 small text-dark">{e.note}</div>}
                      </div>
                      <div className="d-flex flex-column gap-1">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setDate(e.date);
                            setMood(e.mood);
                            setTags((e.tags || []).join(", "));
                            setNote(e.note || "");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeEntry(e._id || e.id)}
                        >
                          <Trash2 size={14} /> Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Camera confirmation modal (tags + note) */}
      <Modal show={camModalOpen} onHide={() => setCamModalOpen(false)} centered>
        <Modal.Header closeButton className="text-dark">
          <Modal.Title className="text-dark">Confirm Camera Mood</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-dark">
          {camDetected ? (
            <>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div style={{ fontSize: "2rem" }}>
                  {MOOD_SCALE.find(m => m.value === camDetected.moodValue)?.emoji}
                </div>
                <div>
                  <div className="fw-semibold text-dark">
                    Detected: {MOOD_SCALE.find(m => m.value === camDetected.moodValue)?.label} (#{camDetected.moodValue})
                  </div>
                  {camDetected.dominant && (
                    <div className="text-muted small">Signal: {camDetected.dominant}</div>
                  )}
                </div>
              </div>

              <Form.Group className="mb-3">
                <Form.Label className="text-dark">Label(s)</Form.Label>
                <Form.Control
                  placeholder="e.g. work, commute, meeting"
                  value={camTags}
                  onChange={(e) => setCamTags(e.target.value)}
                />
                <div className="form-text">Comma-separated.</div>
              </Form.Group>

              <Form.Group>
                <Form.Label className="text-dark">Note</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Optional note…"
                  value={camNote}
                  onChange={(e) => setCamNote(e.target.value)}
                />
              </Form.Group>
            </>
          ) : (
            <div className="text-muted">No detection data.</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setCamModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveCameraEntry} disabled={!camDetected}>
            Save Entry
          </Button>
        </Modal.Footer>
      </Modal>

      <footer className="text-center text-muted small mt-4">  
        Your entries are synced to your account (securely stored in the database).
      </footer>
    </Container>
  );
}
