import React, { useEffect, useMemo, useState } from "react";
import { Container, Table, Button, Badge, Spinner, Alert, Modal, Card } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch } from "./api";
import styles from "./MyAppointments.module.css";

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";

function fmtLocal(dtIso) {
  try {
    return new Date(dtIso).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: LOCAL_TZ,
    });
  } catch {
    return new Date(dtIso).toLocaleString();
  }
}
function fmtUtc(dtIso) {
  return new Date(dtIso).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

export default function MyAppointments() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("user");
  const [viewDoc, setViewDoc] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setRole(String(u.role || "user").toLowerCase());
    } catch {}
  }, []);

  const load = useMemo(
    () => async () => {
      const data = await apiGet("/api/appointments/my");
      setItems(data.items || []);
    },
    []
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (e) {
        setError(e.message || "Failed to load appointments.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  return (
    <Container className={styles.container}>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div>
          <h3 className={styles.heading}>My Appointments</h3>
          <p className={styles.subheading}>
            Times shown in <span className={styles.pill}>{LOCAL_TZ}</span> and <span className={styles.pill}>UTC</span>
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button className={styles.button} onClick={() => navigate("/book-therapist")}>
            Book New Session
          </Button>
          <Button className={styles.outlineBtn} onClick={() => navigate("/appointments")}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" className="mb-2">{error}</Alert>}

      {loading ? (
        <div className={styles.loadingWrap}>
          <div className="d-flex align-items-center gap-2">
            <Spinner size="sm" animation="border" />
            <small>Loading…</small>
          </div>
        </div>
      ) : items.length === 0 ? (
        <Card className={styles.emptyCard}>
          <Card.Body className="text-center">
            <h5 className="mb-1">No appointments yet</h5>
            <p className="text-muted mb-3">When you book a session, it’ll appear here.</p>
            <Button className={styles.button} onClick={() => navigate("/book-therapist")}>
              Book your first session
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <div className={styles.tableWrap}>
          <Table responsive hover className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>With</th>
                <th>Status</th>
                <th>Actions</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const other =
                  role === "therapist"
                    ? a.patient?.name || a.patient?.email
                    : a.therapist?.name || a.therapist?.email;

                const statusClass =
                  a.status === "confirmed"
                    ? styles.badgeOk
                    : a.status === "cancelled"
                    ? styles.badgeMuted
                    : styles.badgeWarn;

                return (
                  <tr key={a._id}>
                    <td>
                      <div className={styles.when}>
                        <div className={styles.whenLocal}>{fmtLocal(a.startTime)}</div>
                        <div className={styles.whenUtc}>{fmtUtc(a.startTime)}</div>
                      </div>
                    </td>
                    <td>{other || "—"}</td>
                    <td>
                      <span className={`${styles.statusPill} ${statusClass}`}>{a.status}</span>
                    </td>
                    <td className="d-flex flex-wrap gap-2">
                      {role === "therapist" && a.zoomStartUrl && (
                        <a
                          className={`btn btn-sm ${styles.button}`}
                          href={a.zoomStartUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Start Meeting
                        </a>
                      )}
                      {role !== "therapist" && a.zoomJoinUrl && (
                        <a
                          className={`btn btn-sm ${styles.button}`}
                          href={a.zoomJoinUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Join Meeting
                        </a>
                      )}
                      {a.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className={styles.outlineDanger}
                          onClick={async () => {
                            try {
                              await apiPatch(`/api/appointments/${a._id}/cancel`, {});
                              await load();
                            } catch (e) {
                              alert(e.message || "Failed to cancel.");
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                    <td>
                      {a.status === "completed" ? (
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          className={styles.outlineBtn}
                          onClick={async () => {
                            try {
                              const doc = await apiGet(`/api/appointments/${a._id}`);
                              setViewDoc(doc);
                            } catch (e) {
                              alert(e.message || "Failed to load session summary.");
                            }
                          }}
                        >
                          View Logs & Rx
                        </Button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {/* Session Summary Modal */}
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
              <div className={styles.metaGrid}>
                <div><b>When (Local):</b> {fmtLocal(viewDoc.startTime)}</div>
                <div><b>When (UTC):</b> {fmtUtc(viewDoc.startTime)}</div>
                <div><b>Status:</b> <span className={`${styles.statusPill} ${styles.badgeInfo}`}>{viewDoc.status}</span></div>
              </div>
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
          <Button variant="secondary" onClick={() => setViewDoc(null)} className={styles.outlineBtn}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
