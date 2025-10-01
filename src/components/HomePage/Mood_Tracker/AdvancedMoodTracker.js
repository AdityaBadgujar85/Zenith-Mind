// AdvancedMoodTracker.jsx
import React, { useEffect, useMemo, useState, useContext } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { Save, Upload, Trash2, Calendar } from "lucide-react";
import { Container, Row, Col, Button, Form, Card } from "react-bootstrap";
import { AppDataContext } from "../../../App"; // shared context

const MOOD_SCALE = [
  { value: 1, label: "Terrible", emoji: "😫" },
  { value: 2, label: "Bad", emoji: "😕" },
  { value: 3, label: "Okay", emoji: "😌" },
  { value: 4, label: "Good", emoji: "🙂" },
  { value: 5, label: "Great", emoji: "😁" },
];
const COLORS = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function AdvancedMoodTracker() {
  const { moodEntries, setMoodEntries } = useContext(AppDataContext);

  const [entries, setEntries] = useState(moodEntries || []);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mood, setMood] = useState(4);
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [filterDays, setFilterDays] = useState(30);

  // Sync local component state with context
  useEffect(() => {
    setMoodEntries(entries);
  }, [entries, setMoodEntries]);

  function upsertEntry(e) {
    const payload = {
      id: uid(),
      date: e.date,
      mood: Number(e.mood),
      tags: e.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      note: e.note || "",
      createdAt: new Date().toISOString(),
    };

    setEntries((prev) => {
      const idx = prev.findIndex((p) => p.date === payload.date);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...payload };
        return copy.sort((a, b) => a.date.localeCompare(b.date));
      }
      return [...prev, payload].sort((a, b) => a.date.localeCompare(b.date));
    });
    setNote("");
    setTags("");
  }

  function removeEntry(id) {
    if (!window.confirm("Delete this mood entry?")) return;
    setEntries((prev) => prev.filter((p) => p.id !== id));
  }

  const filteredEntries = useMemo(() => {
    const cutoff = format(subDays(new Date(), filterDays - 1), "yyyy-MM-dd");
    return entries.filter((e) => e.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, filterDays]);

  const lineData = useMemo(() => {
    const today = new Date();
    const arr = [];
    for (let i = filterDays - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, "yyyy-MM-dd");
      const found = entries.find((en) => en.date === key);
      arr.push({ date: key, mood: found ? found.mood : null });
    }
    return arr.map((r) => ({ ...r, label: format(parseISO(r.date), "MMM d") }));
  }, [entries, filterDays]);

  const pieData = useMemo(() => {
    const counts = MOOD_SCALE.map((m) => ({ mood: m.value, count: 0, label: m.label }));
    entries.forEach((e) => {
      const idx = counts.findIndex((c) => c.mood === e.mood);
      if (idx >= 0) counts[idx].count++;
    });
    return counts.filter((c) => c.count > 0).map((c) => ({ name: c.label, value: c.count }));
  }, [entries]);

  const tagCounts = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => {
      (e.tags || []).forEach((t) => {
        const key = t.toLowerCase();
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return Array.from(map.entries()).map(([tag, count]) => ({ tag, count }));
  }, [entries]);

  function exportCSV() {
    const header = ["id", "date", "mood", "tags", "note", "createdAt"];
    const rows = entries.map((e) => [e.id, e.date, e.mood, (e.tags || []).join(";"), e.note, e.createdAt]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mood-export-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCSV(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return alert("CSV looks empty or invalid");
      const rows = lines.slice(1).map((ln) => {
        const cols = ln.match(/(?:\"([^\"]*)\"|[^,]+)/g) || [];
        return cols.map((c) => c.replace(/^\"|\"$/g, ""));
      });
      const imported = rows.map((r) => ({
        id: r[0] || uid(),
        date: r[1],
        mood: Number(r[2]),
        tags: r[3] ? r[3].split(";").map((t) => t.trim()).filter(Boolean) : [],
        note: r[4] || "",
        createdAt: r[5] || new Date().toISOString(),
      }));
      setEntries((prev) => {
        const byDate = new Map(prev.map((p) => [p.date, p]));
        imported.forEach((im) => byDate.set(im.date, im));
        return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
      });
    };
    reader.readAsText(file);
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    upsertEntry({ date, mood, tags, note });
  }

  function clearAll() {
    if (!window.confirm("Clear all saved mood entries? This action cannot be undone.")) return;
    setEntries([]);
  }

  return (
    <Container fluid className="py-4" style={{marginTop:'5rem'}}>
      {/* Header and controls */}
      <Row className="mb-4 align-items-center justify-content-between">
        <Col><h1 className="h3">Mood Tracker 📊</h1></Col>
        <Col className="d-flex justify-content-end gap-2">
          <Button size="sm" variant="outline-primary" onClick={exportCSV}><Save size={16}/> Export</Button>
          <Form.Label className="btn btn-outline-secondary btn-sm m-0">
            <Upload size={16}/> Import
            <Form.Control type="file" accept="text/csv" hidden onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])}/>
          </Form.Label>
          <Button size="sm" variant="outline-danger" onClick={clearAll}>Clear</Button>
        </Col>
      </Row>

      <Row>
        {/* Log / Edit Mood */}
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title><Calendar size={18}/> Log / Edit Mood</Card.Title>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-2">
                  <Form.Label>Date</Form.Label>
                  <Form.Control type="date" value={date} onChange={(e) => setDate(e.target.value)} required/>
                </Form.Group>

                <Form.Label>Mood</Form.Label>
                <div className="d-flex justify-content-between mb-3">
                  {MOOD_SCALE.map((m) => (
                    <Button key={m.value} type="button" variant={mood === m.value ? "primary" : "outline-secondary"}
                      onClick={() => setMood(m.value)}>
                      <div>{m.emoji}</div>
                      <small>{m.label}</small>
                    </Button>
                  ))}
                </div>

                <Form.Group className="mb-2">
                  <Form.Label>Tags</Form.Label>
                  <Form.Control placeholder="work, family, health" value={tags} onChange={(e) => setTags(e.target.value)}/>
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Note</Form.Label>
                  <Form.Control as="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: what happened today?"/>
                </Form.Group>

                <div className="d-flex gap-2">
                  <Button type="submit" variant="success">Save</Button>
                  <Button variant="secondary" type="button" onClick={() => { setDate(format(new Date(), "yyyy-MM-dd")); setMood(4); setTags(""); setNote(""); }}>Reset</Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Charts and entries */}
        <Col md={8}>
          {/* Mood Over Time */}
          <Card className="mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between mb-2">
                <Card.Title>Mood Over Time</Card.Title>
                <Form.Select size="sm" style={{width: '150px'}} value={filterDays} onChange={(e) => setFilterDays(Number(e.target.value))}>
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </Form.Select>
              </div>
              <div style={{height:260}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis domain={[1, 5]} allowDecimals={false}/>
                    <Tooltip/>
                    <Line type="monotone" dataKey="mood" stroke="#8884d8" strokeWidth={2} dot={{r:4}} activeDot={{r:6}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>

          <Row>
            {/* Mood Distribution */}
            <Col md={4}>
              <Card className="mb-4">
                <Card.Body>
                  <Card.Title>Mood Distribution</Card.Title>
                  <div style={{height:200}}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={70} label>
                          {pieData.map((entry, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Top Tags */}
            <Col md={8}>
              <Card className="mb-4">
                <Card.Body>
                  <Card.Title>Top Tags</Card.Title>
                  {tagCounts.length === 0 ? (
                    <small className="text-muted">No tags yet. Add tags like <i>work, health</i>.</small>
                  ) : (
                    <div style={{height:160}}>
                      <ResponsiveContainer>
                        <BarChart data={tagCounts} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="tag" type="category" />
                          <Tooltip />
                          <Bar dataKey="count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Entries */}
          <Card>
            <Card.Body>
              <Card.Title>Entries</Card.Title>
              <div style={{maxHeight: '250px', overflowY: 'auto'}}>
                {entries.length === 0 ? (
                  <small className="text-muted">No entries yet — add today's mood to get started.</small>
                ) : (
                  entries.slice().reverse().map((e) => (
                    <div key={e.id} className="d-flex justify-content-between align-items-start border rounded p-2 mb-2">
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span style={{fontSize:'1.5rem'}}>{MOOD_SCALE.find((m) => m.value === e.mood)?.emoji}</span>
                          <div>
                            <div className="fw-bold">{format(parseISO(e.date), "eee, MMM d, yyyy")}</div>
                            <div className="text-muted small">{(e.tags || []).join(", ")}</div>
                          </div>
                        </div>
                        {e.note && <div className="mt-1 small">{e.note}</div>}
                      </div>
                      <div className="d-flex flex-column gap-1">
                        <Button size="sm" variant="outline-secondary" onClick={() => { setDate(e.date); setMood(e.mood); setTags((e.tags || []).join(", ")); setNote(e.note || ""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button>
                        <Button size="sm" variant="outline-danger" onClick={() => removeEntry(e.id)}><Trash2 size={14}/> Delete</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <footer className="text-muted small mt-3">Data saved locally in your browser via context. No account required.</footer>
    </Container>
  );
}
