import React, { useEffect, useMemo, useState } from "react";
import { Container, Card, Form, Button, Spinner, Alert, Row, Col } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "./api";
import styles from "./BookAppointment.module.css";

// yyyy-mm-dd for <input type="date"> using UTC
function toDateInputValue(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const LOCAL_TZ =
  (Intl.DateTimeFormat().resolvedOptions().timeZone) || "Asia/Kolkata";

export default function BookAppointment() {
  const { therapistId } = useParams();
  const navigate = useNavigate();

  const [therapist, setTherapist] = useState(null);
  const [date, setDate] = useState(toDateInputValue()); // UTC date string
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");

  const localTzLabel = useMemo(() => {
    try {
      // e.g., "Asia/Kolkata" -> "IST"
      const d = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: LOCAL_TZ,
        timeZoneName: "short",
        hour: "2-digit",
      })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value;
      return parts || LOCAL_TZ;
    } catch {
      return LOCAL_TZ;
    }
  }, []);

  // Load therapist
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await apiGet("/api/appointments/therapists/public");
        const item = (list.items || []).find((x) => x?.user?._id === therapistId);
        setTherapist(item || null);
      } catch (e) {
        setError(e.message || "Failed to load therapist.");
      } finally {
        setLoading(false);
      }
    })();
  }, [therapistId]);

  // Load slots for selected date
  async function fetchSlots(dStr) {
    setLoadingSlots(true);
    setSlots([]);
    setSlot("");
    try {
      const data = await apiGet(`/api/appointments/therapists/${therapistId}/slots?date=${dStr}`);
      const arr = data.slots || [];
      setSlots(arr);
      if (arr.length) setSlot(arr[0]);
    } catch (e) {
      setError(e.message || "Failed to load slots.");
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    if (therapist) fetchSlots(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist, date]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!slot) return alert("Please select a time slot.");
    setSubmitting(true);
    try {
      const appt = await apiPost("/api/appointments/book", {
        therapistId,
        startTime: slot,      // already ISO in UTC
        durationMin: 30,      // enforced on server too
        note,
      });
      setCreated(appt);
    } catch (e) {
      alert(e.message || "Booking failed.");
    } finally {
      setSubmitting(false);
    }
  }

  // Format helpers
  function fmtLocal(dtIso) {
    try {
      return new Date(dtIso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: LOCAL_TZ,
      });
    } catch {
      return new Date(dtIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  }
  function fmtUtc(dtIso) {
    return new Date(dtIso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC";
  }

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className="d-flex align-items-center gap-2">
          <Spinner size="sm" animation="border" />
          <small>Loading…</small>
        </div>
      </div>
    );
  }

  return (
    <Container className={styles.container}>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div>
          <h3 className={styles.heading}>Book a Session</h3>
          <p className={styles.subheading}>
            {therapist ? (
              <>
                with <span className={styles.emph}>{therapist?.user?.name}</span>{" "}
                <span className={styles.pill}>{therapist?.user?.email}</span>
              </>
            ) : (
              "Therapist not found"
            )}
          </p>
        </div>
        <div className="d-flex gap-2">
          <span className={styles.pill}>30-min sessions</span>
          <span className={styles.pill}>Times shown: {localTzLabel} + UTC</span>
        </div>
      </div>

      {error && <Alert variant="danger" className="mb-2">{error}</Alert>}

      <Card className={styles.card}>
        <Card.Body className={styles.cardBody}>
          {!created ? (
            <Form onSubmit={handleSubmit}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Date (UTC)</Form.Label>
                    <Form.Control
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className={styles.input}
                    />
                    <Form.Text className={styles.help}>
                      Pick a date (UTC). Available slots will refresh automatically.
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Available 30-min Slots</Form.Label>
                    <Form.Select
                      value={slot}
                      onChange={(e) => setSlot(e.target.value)}
                      disabled={loadingSlots}
                      required
                      className={styles.input}
                    >
                      {loadingSlots && <option>Loading…</option>}
                      {!loadingSlots && slots.length === 0 && <option>No slots available</option>}
                      {!loadingSlots &&
                        slots.map((s) => (
                          <option key={s} value={s}>
                            {fmtLocal(s)} ({localTzLabel}) • {fmtUtc(s)}
                          </option>
                        ))}
                    </Form.Select>
                    <Form.Text className={styles.help}>
                      Shows both your local time ({localTzLabel}) and UTC for clarity.
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col xs={12}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Notes (optional)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder="Anything you'd like your therapist to know beforehand?"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={styles.textarea}
                    />
                  </Form.Group>
                </Col>

                <Col xs={12} className="d-flex gap-2">
                  <Button
                    type="submit"
                    disabled={submitting || loadingSlots || !slot}
                    className={styles.button}
                  >
                    {submitting ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Booking…
                      </>
                    ) : (
                      "Book (30 min)"
                    )}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={() => navigate("/appointments")}
                    disabled={submitting}
                    className={styles.outlineBtn}
                  >
                    My Appointments
                  </Button>
                </Col>
              </Row>
            </Form>
          ) : (
            <>
              <Alert variant="success" className={styles.success}>
                Appointment created for{" "}
                <b>{new Date(created.startTime).toLocaleString()}</b>.
              </Alert>
              <div className="d-grid gap-2">
                {created.zoomJoinUrl && (
                  <a
                    className={`btn btn-primary ${styles.button}`}
                    href={created.zoomJoinUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join Zoom (patient)
                  </a>
                )}
                <Button
                  variant="outline-secondary"
                  onClick={() => navigate("/appointments")}
                  className={styles.outlineBtn}
                >
                  Go to My Appointments
                </Button>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
