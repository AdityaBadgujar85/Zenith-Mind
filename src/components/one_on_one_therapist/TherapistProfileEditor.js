import React, { useEffect, useState } from "react";
import { Container, Card, Form, Button, Spinner, Alert, Row, Col } from "react-bootstrap";
import { apiGet, apiPost } from "./api";
import styles from "./TherapistProfileEditor.module.css";

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABEL = { mon:"Monday", tue:"Tuesday", wed:"Wednesday", thu:"Thursday", fri:"Friday", sat:"Saturday", sun:"Sunday" };

function AvailabilityEditor({ availability, setAvailability }) {
  function addSlot(day) {
    const next = { ...(availability || {}) };
    next[day] = Array.isArray(next[day]) ? [...next[day]] : [];
    next[day].push({ from: "09:00", to: "12:00" });
    setAvailability(next);
  }
  function updateSlot(day, idx, field, val) {
    const next = { ...(availability || {}) };
    const arr = Array.isArray(next[day]) ? [...next[day]] : [];
    const item = { ...(arr[idx] || {}) , [field]: val };
    arr[idx] = item;
    next[day] = arr;
    setAvailability(next);
  }
  function removeSlot(day, idx) {
    const next = { ...(availability || {}) };
    const arr = Array.isArray(next[day]) ? [...next[day]] : [];
    arr.splice(idx, 1);
    next[day] = arr;
    setAvailability(next);
  }
  return (
    <div className={styles.availGrid}>
      {DAYS.map((d) => (
        <Card key={d} className={`${styles.card} ${styles.dayCard}`}>
          <Card.Body className={styles.cardBody}>
            <div className={styles.dayHeader}>
              <strong className={styles.dayTitle}>{DAY_LABEL[d]}</strong>
              <Button size="sm" className={styles.button} onClick={() => addSlot(d)}>Add</Button>
            </div>

            {(availability?.[d] || []).length === 0 ? (
              <div className={styles.smallMuted}>No slots</div>
            ) : (
              (availability[d]).map((slot, i) => {
                const invalid = slot?.from && slot?.to && slot.from >= slot.to;
                return (
                  <Row key={`${d}-${i}`} className="g-2 align-items-center mb-2">
                    <Col xs={5}>
                      <Form.Control
                        type="time"
                        value={slot.from || ""}
                        onChange={(e) => updateSlot(d, i, "from", e.target.value)}
                        className={styles.input}
                      />
                    </Col>
                    <Col xs={5}>
                      <Form.Control
                        type="time"
                        value={slot.to || ""}
                        onChange={(e) => updateSlot(d, i, "to", e.target.value)}
                        className={styles.input}
                        isInvalid={invalid}
                      />
                      {invalid && <div className="invalid-feedback">End time must be after start</div>}
                    </Col>
                    <Col xs={2} className="d-flex justify-content-end">
                      <Button
                        variant="outline-danger"
                        size="sm"
                        className={styles.outlineDanger}
                        onClick={() => removeSlot(d, i)}
                      >
                        Remove
                      </Button>
                    </Col>
                  </Row>
                );
              })
            )}
          </Card.Body>
        </Card>
      ))}
    </div>
  );
}

export default function TherapistProfileEditor() {
  const [zoomUserId, setZoomUserId] = useState("");
  const [timezone, setTimezone] = useState("UTC"); // reserved for future
  const [specialties, setSpecialties] = useState("");
  const [bio, setBio] = useState("");
  const [availability, setAvailability] = useState({});
  const [isAccepting, setIsAccepting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing profile
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const doc = await apiGet("/api/appointments/therapists/profile");
        if (doc) {
          setZoomUserId(doc.zoomUserId || "");
          setTimezone(doc.timezone || "UTC");
          setSpecialties((doc.specialties || []).join(", "));
          setBio(doc.bio || "");
          setAvailability(doc.availability || {});
          setIsAccepting(doc.isAccepting !== false);
        }
      } catch {
        // ignore if none
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setOk(false);
    try {
      const payload = {
        zoomUserId,
        timezone,
        specialties: specialties.split(",").map(x => x.trim()).filter(Boolean),
        bio,
        availability,
        isAccepting,
      };
      await apiPost("/api/appointments/therapists/profile", payload);
      setOk(true);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Container className={styles.container}>
      <h3 className={styles.heading}>Therapist Profile</h3>
      <p className={styles.subheading}>Configure Zoom host and weekly availability (UTC windows; 30-min slots).</p>

      {ok && <Alert variant="success" className={styles.success}>Saved!</Alert>}

      {loading ? (
        <div className={styles.loadingWrap}>
          <Spinner animation="border" size="sm" /> <small className="ms-2">Loading…</small>
        </div>
      ) : (
        <Form onSubmit={handleSave}>
          <Card className={`${styles.card} mb-3`}>
            <Card.Body className={styles.cardBody}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Zoom User (email)</Form.Label>
                    <Form.Control
                      placeholder="therapist.zoom@yourclinic.com"
                      value={zoomUserId}
                      onChange={(e) => setZoomUserId(e.target.value)}
                      required
                      className={styles.input}
                    />
                    <Form.Text className={styles.help}>
                      Must be a Zoom user in your account (meeting host).
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Timezone</Form.Label>
                    <Form.Select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className={styles.input}
                    >
                      <option value="UTC">UTC</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Specialties (comma separated)</Form.Label>
                    <Form.Control
                      placeholder="sleep, stress, CBT"
                      value={specialties}
                      onChange={(e) => setSpecialties(e.target.value)}
                      className={styles.input}
                    />
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label className={styles.label}>Bio</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className={styles.textarea}
                    />
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="switch"
                      id="isAccepting"
                      label="Accepting new appointments"
                      checked={isAccepting}
                      onChange={(e) => setIsAccepting(e.target.checked)}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <h5 className={styles.blockTitle}>Weekly Availability</h5>
          <AvailabilityEditor availability={availability} setAvailability={setAvailability} />

          <div className="d-flex gap-2 mt-2">
            <Button type="submit" disabled={saving} className={styles.button}>
              {saving ? <><Spinner size="sm" animation="border" className="me-2" /> Saving…</> : "Save Profile"}
            </Button>
          </div>
        </Form>
      )}
    </Container>
  );
}
