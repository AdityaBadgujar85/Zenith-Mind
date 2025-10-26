import React, { useEffect, useMemo, useState } from "react";
import {
  Container, Row, Col, Card, Form, Button, Spinner, Alert
} from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "./api"; // keep using your apiGet for list
import styles from "./TherapistDirectory.module.css";

const API_BASE = "http://localhost:7000";
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";

export default function TherapistDirectory() {
  const navigate = useNavigate();

  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  // Quick Book state
  const [booking, setBooking] = useState(false);
  const [form, setForm] = useState({
    therapistId: "",
    startTimeLocal: "",
    durationMin: 30,  // default 30
    note: "",
  });
  const [created, setCreated] = useState(null);

  // for label like IST
  const localTzShort = useMemo(() => {
    try {
      const part = new Intl.DateTimeFormat("en-US", {
        timeZone: LOCAL_TZ, timeZoneName: "short", hour: "2-digit"
      }).formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value;
      return part || LOCAL_TZ;
    } catch { return LOCAL_TZ; }
  }, []);

  // Load public therapists
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await apiGet("/api/appointments/therapists/public");
        const items = data.items || [];
        setTherapists(items);

        // Preselect first accepting therapist
        const first = items.find((t) => t.isAccepting) || items[0];
        if (first?.user?._id) {
          setForm((s) => ({ ...s, therapistId: first.user._id }));
        }
      } catch (e) {
        console.error(e);
        setError(e.message || "Unable to load therapists");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const authHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  function toUTCISOString(localValue) {
    if (!localValue) return null;
    const dt = new Date(localValue); // interpreted as local
    return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString();
  }

  async function quickBook(e) {
    e.preventDefault();
    setError("");

    if (!form.therapistId) return setError("Please choose a therapist.");
    if (!form.startTimeLocal) return setError("Please choose date & time.");

    setBooking(true);
    try {
      // 🔒 Enforce 30 minutes max on submit
      const dur = Math.min(Number(form.durationMin) || 30, 30);

      const payload = {
        therapistId: form.therapistId,
        startTime: toUTCISOString(form.startTimeLocal),
        durationMin: dur,
        note: form.note,
      };

      const res = await fetch(`${API_BASE}/api/appointments/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const data = JSON.parse(text || "{}");
      if (!res.ok) throw new Error(data?.message || `Booking failed (${res.status})`);
      setCreated(data);
    } catch (e) {
      console.error(e);
      setError(e.message || "Unable to book appointment");
    } finally {
      setBooking(false);
    }
  }

  return (
    <Container className={styles.container}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className={styles.heading}>Find a Therapist</h3>
          <p className={styles.subheading}>
            Quick-book in <span className={styles.pill}>{localTzShort}</span> (converted to UTC automatically)
          </p>
        </div>
        <Button variant="outline-secondary" className={styles.outlineBtn} onClick={() => navigate("/appointments")}>
          My Appointments
        </Button>
      </div>

      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {/* ===== Quick Book Card ===== */}
      <Card className={`${styles.card} mb-4`}>
        <Card.Body className={styles.cardBody}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <h5 className={styles.blockTitle}>Quick Book a Therapist Session</h5>
            <span className={styles.pill}>30-min max</span>
          </div>

          {!created ? (
            <Form onSubmit={quickBook}>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Therapist</Form.Label>
                    <Form.Select
                      value={form.therapistId}
                      onChange={(e) => setForm((s) => ({ ...s, therapistId: e.target.value }))}
                      disabled={loading}
                      className={styles.input}
                    >
                      {loading && <option>Loading…</option>}
                      {!loading && therapists.length === 0 && (
                        <option>No therapists available</option>
                      )}
                      {!loading &&
                        therapists.map((t) => (
                          <option key={t.user?._id} value={t.user?._id}>
                            {t.user?.name || "Therapist"} {t.isAccepting ? "" : "(unavailable)"}
                          </option>
                        ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Date & Time ({localTzShort})</Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={form.startTimeLocal}
                      onChange={(e) => setForm((s) => ({ ...s, startTimeLocal: e.target.value }))}
                      required
                      className={styles.input}
                    />
                    <Form.Text className={styles.help}>
                      We’ll convert this to UTC for the server.
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Duration (max 30)</Form.Label>
                    <Form.Select
                      value={form.durationMin}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, durationMin: Math.min(Number(e.target.value), 30) }))
                      }
                      className={styles.input}
                    >
                      {[15, 20, 25, 30].map((m) => (
                        <option key={m} value={m}>
                          {m} minutes
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Notes (optional)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder="Anything you'd like your therapist to know beforehand?"
                      value={form.note}
                      onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
                      className={styles.textarea}
                    />
                  </Form.Group>
                </Col>

                <Col md={12} className="d-flex gap-2">
                  <Button type="submit" disabled={booking || loading} className={styles.button}>
                    {booking ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" /> Booking…
                      </>
                    ) : (
                      "Book Session"
                    )}
                  </Button>

                  <Button
                    variant="outline-secondary"
                    onClick={() => navigate("/appointments")}
                    className={styles.outlineBtn}
                  >
                    My Appointments
                  </Button>
                </Col>
              </Row>
            </Form>
          ) : (
            <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
              <Alert variant="success" className={styles.success}>
                Appointment created for <b>{new Date(created.startTime).toLocaleString()}</b>.
              </Alert>
              <div className="d-flex flex-wrap gap-2">
                {created.zoomJoinUrl && (
                  <a
                    href={created.zoomJoinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`btn btn-primary ${styles.button}`}
                  >
                    Join Zoom (patient)
                  </a>
                )}
                <Button variant="outline-secondary" onClick={() => navigate("/appointments")} className={styles.outlineBtn}>
                  View All Appointments
                </Button>
                <Button
                  variant="outline-success"
                  className={styles.outlineSuccess}
                  onClick={() => {
                    setCreated(null);
                    setForm((s) => ({ ...s, startTimeLocal: "", note: "", durationMin: 30 }));
                  }}
                >
                  Book Another
                </Button>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* ===== Therapist cards/list ===== */}
      <Row className="g-3">
        {loading && (
          <Col xs={12}>
            <div className={styles.loadingWrap}>
              <Spinner size="sm" animation="border" />
              <small className="ms-2">Loading therapists…</small>
            </div>
          </Col>
        )}

        {!loading && therapists.map((t) => (
          <Col md={6} lg={4} key={t.user?._id}>
            <Card className={`${styles.card} h-100`}>
              <Card.Body className={styles.cardBody}>
                <div className="d-flex justify-content-between align-items-start">
                  <h5 className="mb-1">{t.user?.name || "Therapist"}</h5>
                  <span className={`${styles.pill} ${!t.isAccepting ? styles.pillMuted : ""}`}>
                    {t.isAccepting ? "Accepting" : "Unavailable"}
                  </span>
                </div>
                <div className="text-muted mb-2">{t.user?.email}</div>
                {t.bio && <p className="mb-2">{t.bio}</p>}
                {t.specialties?.length > 0 && (
                  <div className={styles.smallMuted}>
                    Specialties: {t.specialties.join(", ")}
                  </div>
                )}
                <div className="d-flex gap-2 mt-2">
                  <Button size="sm" as={Link} to={`/book-therapist/${t.user?._id}`} className={styles.button}>
                    Book
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    className={styles.outlineBtn}
                    onClick={() => setForm((s) => ({ ...s, therapistId: t.user?._id }))}
                  >
                    Quick Select
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}

        {!loading && therapists.length === 0 && (
          <Col xs={12}>
            <Alert variant="secondary" className="mb-0">
              No therapists available.
            </Alert>
          </Col>
        )}
      </Row>
    </Container>
  );
}
