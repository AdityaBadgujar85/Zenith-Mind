import React, { useEffect, useMemo, useState } from "react";
import {
  Container, Row, Col, Card, Button, Badge, Table, Form, Spinner,
  OverlayTrigger, Tooltip, Modal,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch } from "../one_on_one_therapist/api";
import styles from "./TherapistDashboard.module.css";

function InlineLoader() {
  return (
    <div className="d-flex align-items-center gap-2">
      <Spinner size="sm" animation="border" />
      <small>Loading…</small>
    </div>
  );
}

function Stat({ label, value, pill }) {
  return (
    <Card className={`${styles.card} ${styles.statCard}`}>
      <Card.Body className={styles.cardBody}>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className={styles.statLabel}>{label}</div>
            <div className={styles.statValue}>{value}</div>
          </div>
          {pill && <span className={styles.pill}>{pill}</span>}
        </div>
      </Card.Body>
    </Card>
  );
}

export default function TherapistDashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("upcoming"); // upcoming | confirmed | cancelled | completed | all

  // Complete modal state
  const [showComplete, setShowComplete] = useState(false);
  const [completeFor, setCompleteFor] = useState(null);
  const [logs, setLogs] = useState("");
  const [rx, setRx] = useState("");

  // View summary modal (read-only)
  const [viewDoc, setViewDoc] = useState(null);

  // Load current user from localStorage
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setMe(u || null);
      if (!u || (u.role || "").toLowerCase() !== "therapist") {
        navigate("/", { replace: true });
      }
    } catch {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // Pull all my appointments
  async function load() {
    const data = await apiGet("/api/appointments/my");
    setAppointments((data.items || []).filter(a => a?.therapist?._id === me?._id));
  }

  useEffect(() => {
    if (me?._id) {
      (async () => {
        try { await load(); } catch (e) { console.error(e); alert(e.message); }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?._id]);

  const stats = useMemo(() => {
    if (!appointments) return null;
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(now); endOfDay.setHours(23,59,59,999);

    const startOfWeek = new Date(now);
    const day = (now.getDay() + 6) % 7; // Mon=0
    startOfWeek.setDate(now.getDate() - day);
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23,59,59,999);

    const today = appointments.filter(a => {
      const t = new Date(a.startTime);
      return t >= startOfDay && t <= endOfDay && a.status !== "cancelled";
    });
    const week = appointments.filter(a => {
      const t = new Date(a.startTime);
      return t >= startOfWeek && t <= endOfWeek && a.status !== "cancelled";
    });
    const upcoming = appointments.filter(a => new Date(a.startTime) >= now && a.status !== "cancelled");
    const completedThisWeek = appointments.filter(a => {
      const t = new Date(a.startTime);
      return a.status === "completed" && t >= startOfWeek && t <= endOfWeek;
    });

    return {
      todayCount: today.length,
      weekCount: week.length,
      upcomingCount: upcoming.length,
      completedWeek: completedThisWeek.length,
    };
  }, [appointments]);

  const filtered = useMemo(() => {
    if (!appointments) return [];
    const q = query.trim().toLowerCase();
    const now = new Date();
    return appointments
      .filter(a => {
        let statusOk = true;
        if (status !== "all") {
          if (status === "upcoming") {
            statusOk = new Date(a.startTime) >= now && a.status !== "cancelled";
          } else {
            statusOk = (a.status || "").toLowerCase() === status;
          }
        }
        const name = (a?.patient?.name || "").toLowerCase();
        const email = (a?.patient?.email || "").toLowerCase();
        const notes = (a?.notes || "").toLowerCase();
        const textOk = !q || name.includes(q) || email.includes(q) || notes.includes(q);
        return statusOk && textOk;
      })
      .sort((x, y) => new Date(x.startTime) - new Date(y.startTime));
  }, [appointments, query, status]);

  async function cancel(id) {
    if (!window.confirm("Cancel this appointment?")) return;
    setBusy(true);
    try { await apiPatch(`/api/appointments/${id}/cancel`, {}); await load(); }
    catch (e) { console.error(e); alert(e.message); }
    finally { setBusy(false); }
  }

  function openStart(url) {
    if (!url) return alert("Start URL not available");
    window.open(url, "_blank", "noreferrer");
  }

  function openComplete(appt) {
    setCompleteFor(appt);
    setLogs("");
    setRx("");
    setShowComplete(true);
  }

  async function submitComplete() {
    if (!completeFor?._id) return;
    setBusy(true);
    try {
      await apiPatch(`/api/appointments/${completeFor._id}/complete`, { logs, prescriptionText: rx });
      setShowComplete(false);
      setCompleteFor(null);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <Container fluid="md">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className={styles.heading}>Therapist Dashboard</h2>
            <div className={styles.subheading}>
              Welcome{me?.name ? `, ${me.name}` : ""}. Manage your sessions & profile.
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" className={styles.outlineBtn} onClick={() => navigate("/therapist/profile")}>
              Edit Profile
            </Button>
            <Button className={styles.button} onClick={() => navigate("/appointments")}>
              All Appointments
            </Button>
          </div>
        </div>

        {/* Stats */}
        <Row className="g-3 mb-3">
          <Col md={3}><Stat label="Sessions Today" value={stats?.todayCount ?? "-"} pill="Today" /></Col>
          <Col md={3}><Stat label="This Week" value={stats?.weekCount ?? "-"} pill="Week" /></Col>
          <Col md={3}><Stat label="Upcoming" value={stats?.upcomingCount ?? "-"} pill="Pipeline" /></Col>
          <Col md={3}><Stat label="Completed (Week)" value={stats?.completedWeek ?? "-"} pill="Done" /></Col>
        </Row>

        {/* Filters */}
        <Card className={styles.card}>
          <Card.Body className={styles.cardBody}>
            <div className="d-flex flex-wrap gap-2 align-items-end">
              <Form.Group>
                <Form.Label className={styles.label}>Search</Form.Label>
                <Form.Control
                  placeholder="Search by patient name/email/notes"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={styles.input}
                  style={{ minWidth: 280 }}
                />
              </Form.Group>

              <Form.Group>
                <Form.Label className={styles.label}>Filter</Form.Label>
                <Form.Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={styles.input}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="all">All</option>
                </Form.Select>
              </Form.Group>

              <div className="ms-auto d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  className={styles.outlineBtn}
                  onClick={() => { setQuery(""); setStatus("upcoming"); }}
                >
                  Reset
                </Button>
                <Button className={styles.button} onClick={load} disabled={busy}>
                  {busy ? <InlineLoader /> : "Refresh"}
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Sessions table */}
        <Card className={styles.card}>
          <Card.Body className={styles.cardBody}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className={styles.blockTitle}>Your Sessions</h5>
              <span className={styles.pill}>{filtered.length} shown</span>
            </div>

            {!appointments ? (
              <InlineLoader />
            ) : (
              <div className={styles.tableWrap}>
                <Table hover className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>When</th>
                      <th>Patient</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th style={{ width: 340 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a, i) => {
                      const start = new Date(a.startTime);
                      const isPast = start.getTime() < Date.now();
                      const canStart = a.status !== "cancelled" && a.zoomStartUrl;

                      const statusClass =
                        a.status === "confirmed" ? styles.badgeOk :
                        a.status === "completed" ? styles.badgeInfo :
                        a.status === "cancelled" ? styles.badgeMuted :
                        styles.badgeWarn;

                      return (
                        <tr key={a._id}>
                          <td>{i + 1}</td>
                          <td>
                            <div className={styles.whenLocal}>{start.toLocaleString()}</div>
                            {a.notes && (
                              <OverlayTrigger overlay={<Tooltip>{a.notes}</Tooltip>}>
                                <small className="text-muted">Notes</small>
                              </OverlayTrigger>
                            )}
                          </td>
                          <td>
                            <div>{a?.patient?.name || "—"}</div>
                            <small className="text-muted">{a?.patient?.email || ""}</small>
                          </td>
                          <td>{a.durationMin} min</td>
                          <td><span className={`${styles.statusPill} ${statusClass}`}>{a.status}</span></td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <Button size="sm" className={styles.button} onClick={() => openStart(a.zoomStartUrl)} disabled={!canStart}>
                                Start Zoom
                              </Button>
                              <a
                                className={`btn btn-sm ${styles.outlineBtn}`}
                                href={a.zoomJoinUrl || "#"}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => { if (!a.zoomJoinUrl) e.preventDefault(); }}
                              >
                                Patient Link
                              </a>
                              <Button
                                size="sm"
                                className={styles.outlineDanger}
                                onClick={() => cancel(a._id)}
                                disabled={busy || a.status !== "confirmed" || isPast}
                              >
                                Cancel
                              </Button>
                              {a.status === "confirmed" && (
                                <Button
                                  size="sm"
                                  className={styles.outlineSuccess}
                                  onClick={() => openComplete(a)}
                                  disabled={busy}
                                >
                                  Mark as Done
                                </Button>
                              )}
                              {a.status === "completed" && (
                                <Button
                                  size="sm"
                                  className={styles.outlineBtn}
                                  onClick={async () => {
                                    const doc = await apiGet(`/api/appointments/${a._id}`);
                                    setViewDoc(doc);
                                  }}
                                >
                                  View Summary
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No sessions match your filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </Container>

      {/* Complete modal */}
      <Modal
        show={showComplete}
        onHide={() => setShowComplete(false)}
        centered
        contentClassName={styles.modal}
        dialogClassName={styles.dialog}
      >
        <Modal.Header closeButton className={styles.modalHeader}>
          <Modal.Title className={styles.modalTitle}>Complete Session</Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.modalBody}>
          {completeFor ? (
            <>
              <p className="text-muted mb-2">
                {new Date(completeFor.startTime).toLocaleString()} —{" "}
                {completeFor.patient?.name || completeFor.patient?.email}
              </p>
              <Form.Group className="mb-3">
                <Form.Label className={styles.label}>Meeting Logs / Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={logs}
                  onChange={(e) => setLogs(e.target.value)}
                  placeholder="Key points, progress, follow-ups…"
                  className={styles.textarea}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label className={styles.label}>Prescription</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={rx}
                  onChange={(e) => setRx(e.target.value)}
                  placeholder="Medications, dosages, exercises, resources…"
                  className={styles.textarea}
                />
              </Form.Group>
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer className={styles.modalFooter}>
          <Button variant="secondary" className={styles.outlineBtn} onClick={() => setShowComplete(false)}>
            Close
          </Button>
          <Button className={styles.button} onClick={submitComplete} disabled={busy}>
            Save & Mark Done
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View summary modal (read-only) */}
      <Modal
        show={!!viewDoc}
        onHide={() => setViewDoc(null)}
        centered
        contentClassName={styles.modal}
        dialogClassName={styles.dialog}
      >
        <Modal.Header closeButton className={styles.modalHeader}>
          <Modal.Title className={styles.modalTitle}>Session Summary</Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.modalBody}>
          {viewDoc ? (
            <>
              <p><b>When:</b> {new Date(viewDoc.startTime).toLocaleString()}</p>
              <p><b>Status:</b> <span className={`${styles.statusPill} ${styles.badgeInfo}`}>{viewDoc.status}</span></p>
              <hr />
              <p className={styles.pre}>
                <b>Meeting Logs</b><br />
                {viewDoc.meetingLogs || "—"}
              </p>
              <p className={styles.pre}>
                <b>Prescription</b><br />
                {viewDoc.prescription?.text || "—"}
              </p>
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer className={styles.modalFooter}>
          <Button variant="secondary" className={styles.outlineBtn} onClick={() => setViewDoc(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
