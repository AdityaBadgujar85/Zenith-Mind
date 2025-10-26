// ========================= AdminDashboard.jsx =========================
import React, { useEffect, useMemo, useState } from "react";
import { Container, Row, Col, Card, Button, Badge, Table, Form, Spinner, Alert } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import styles from "./AdminDashboard.module.css";

// Use relative API if you have a dev proxy; otherwise keep localhost:
const API_BASE = ""; // "" (recommended with proxy) or "http://localhost:7000"
const BACKUP_TOKEN_KEY = "admin_backup_token";
const BACKUP_USER_KEY  = "admin_backup_user";

function StatCard({ title, value, sub, pill }) {
  return (
    <Card className={`${styles.card} ${styles.statCard}`}>
      <Card.Body className={styles.cardBody}>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className={styles.statTitle}>{title}</div>
            <div className={styles.statValue}>{value}</div>
            {sub && <div className={styles.statSub}>{sub}</div>}
          </div>
          {pill && <Badge bg="" className={styles.pill}>{pill}</Badge>}
        </div>
      </Card.Body>
    </Card>
  );
}

function InlineLoader() {
  return (
    <div className="d-flex align-items-center gap-2">
      <Spinner size="sm" animation="border" />
      <small>Loading…</small>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [loading, setLoading] = useState(true);
  const [tableBusy, setTableBusy] = useState(false);
  const [whoami, setWhoami] = useState(null);
  const [error, setError] = useState("");

  // Prefer admin token; fall back to others
  const getToken = () =>
    localStorage.getItem("admin_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    "";

  // ===== Fetch helper with Bearer token + cookies =====
  async function api(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    // Try to parse JSON even for errors (to bubble message)
    const txt = await res.text();
    let data;
    try { data = txt ? JSON.parse(txt) : {}; } catch { data = { raw: txt }; }

    if (!res.ok) {
      const msg = data?.message || `Request failed ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // ===== Ensure we have an admin session (server-truth) =====
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // whoami returns { user: {...} } — normalize it!
        const resp = await api("/api/admin/auth/whoami"); // protected
        const me = resp?.user || resp || null;
        if (cancelled) return;

        setWhoami(me);

        if (!me || String(me.role || "").toLowerCase() !== "admin") {
          setError("You are not using an admin session. Please log in as admin.");
          // small delay so user can see the message, then redirect
          setTimeout(() => navigate("/admin/login", { replace: true }), 600);
          return;
        }

        const [s, u] = await Promise.all([
          api("/api/admin/stats"),
          api("/api/admin/users?limit=25"),
        ]);
        if (cancelled) return;

        setStats(s);
        setUsers(u?.items || u || []);
      } catch (e) {
        console.error("[AdminDashboard] init error:", e);
        if (!cancelled) {
          setError(e.message || "Failed to verify admin session.");
          setTimeout(() => navigate("/admin/login", { replace: true }), 800);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQ =
        !q ||
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        String(u._id || "").toLowerCase().includes(q);
      const matchesRole = role === "all" || (String(u.role || "user").toLowerCase() === role);
      return matchesQ && matchesRole;
    });
  }, [users, query, role]);

  async function toggleFlag(userId, field) {
    try {
      setTableBusy(true);
      const updated = await api(`/api/admin/users/${userId}/toggle`, {
        method: "POST",
        body: JSON.stringify({ field }),
      });
      setUsers((prev) => prev.map((u) => (u._id === userId ? updated : u)));
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setTableBusy(false);
    }
  }

  async function approveTherapist(userId) {
    try {
      setTableBusy(true);
      const updated = await api(`/api/admin/therapists/${userId}/approve`, { method: "POST" });
      setUsers((prev) => prev.map((u) => (u._id === userId ? updated : u)));
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setTableBusy(false);
    }
  }

  // Save admin session, impersonate target, navigate away (optional)
  async function impersonate(userId) {
    if (!window.confirm("Impersonate this user? You'll switch tokens.")) return;
    try {
      // backup current admin session
      const adminToken = getToken();
      const adminUser  = localStorage.getItem("user");
      if (adminToken) localStorage.setItem(BACKUP_TOKEN_KEY, adminToken);
      if (adminUser)  localStorage.setItem(BACKUP_USER_KEY, adminUser);

      const data = await api(`/api/admin/impersonate/${userId}`, { method: "POST" });
      localStorage.setItem("auth_token", data.token);
      // if you also use admin_token, remove it while impersonated
      localStorage.removeItem("admin_token");
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("userLogin"));

      // After impersonation, admin endpoints will be forbidden; go to home
      navigate("/", { replace: true });
    } catch (e) {
      alert(e.message);
    }
  }

  // Restore backed-up admin session, if available
  function restoreAdminSession() {
    const bToken = localStorage.getItem(BACKUP_TOKEN_KEY);
    const bUser  = localStorage.getItem(BACKUP_USER_KEY);
    if (!bToken || !bUser) return alert("No admin backup session found.");
    // restore to both keys so admin fetches work everywhere
    localStorage.setItem("auth_token", bToken);
    localStorage.setItem("admin_token", bToken);
    localStorage.setItem("user", bUser);
    localStorage.removeItem(BACKUP_TOKEN_KEY);
    localStorage.removeItem(BACKUP_USER_KEY);
    window.dispatchEvent(new Event("userLogin"));
    window.location.reload();
  }

  function logout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("user");
    localStorage.removeItem(BACKUP_TOKEN_KEY);
    localStorage.removeItem(BACKUP_USER_KEY);
    window.dispatchEvent(new Event("userLogout"));
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <InlineLoader />
      </div>
    );
  }

  const hasBackup = !!localStorage.getItem(BACKUP_TOKEN_KEY);

  return (
    <div className={styles.dashboard}>
      <Container fluid="md">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div>
            <h2 className={styles.heading}>Admin Control Center</h2>
            <p className={styles.subheading}>Manage users, sessions, content and platform health.</p>
          </div>
          <div className="d-flex gap-2">
            {hasBackup && (
              <Button variant="outline-success" className={styles.outlineBtn} onClick={restoreAdminSession}>
                Restore Admin Session
              </Button>
            )}
            <Button variant="outline" className={styles.outlineBtn} onClick={logout}>
              Logout
            </Button>
          </div>
        </div>

        {/* Inline warnings */}
        {error && (
          <Alert variant="danger" className="mb-2">
            {error}
          </Alert>
        )}
        {whoami && String(whoami.role || "").toLowerCase() !== "admin" && !error && (
          <Alert variant="danger" className="mb-2">
            You are not using an admin token. Please restore admin session or log in as admin.
          </Alert>
        )}

        {/* ===== Top Stats ===== */}
        <Row className="g-3 mt-1">
          <Col md={4} lg={3}>
            <StatCard title="Total Users" value={stats?.totalUsers ?? "-"} sub={`${stats?.active24h ?? 0} active last 24h`} pill="Users" />
          </Col>
          <Col md={4} lg={3}>
            <StatCard title="Therapists" value={stats?.therapists ?? "-"} sub={`${stats?.pendingTherapistApprovals ?? 0} pending approvals`} pill="Clinical" />
          </Col>
          <Col md={4} lg={3}>
            <StatCard title="Sessions Today" value={stats?.sessionsToday ?? "-"} sub={`${stats?.avgSessionLen ?? 0}m avg`} pill="Engagement" />
          </Col>
          <Col md={4} lg={3}>
            <StatCard title="Open Tickets" value={stats?.ticketsOpen ?? 0} sub={`${stats?.ticketsSLA ?? 0}% within SLA`} pill="Support" />
          </Col>
        </Row>

        {/* ===== Secondary Widgets ===== */}
        <Row className="g-3 mt-2">
          <Col md={6}>
            <Card className={styles.card}>
              <Card.Body className={styles.cardBody}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h5 className={styles.blockTitle}>Feature Flags</h5>
                  <Badge bg="" className={styles.pill}>Runtime</Badge>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {(stats?.flags || [
                    { key: "sleep_v2", on: true },
                    { key: "cbt_stream", on: false },
                    { key: "therapist_bookings", on: true },
                  ]).map((f) => (
                    <span key={f.key} className={`${styles.flag} ${f.on ? styles.flagOn : styles.flagOff}`}>
                      {f.key}
                    </span>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className={styles.card}>
              <Card.Body className={styles.cardBody}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h5 className={styles.blockTitle}>Quick Actions</h5>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <Button className={styles.button} onClick={() => navigate("/report")}>View Reports</Button>
                  <Button className={styles.button} onClick={() => navigate("/book-therapist")}>Review Therapists</Button>
                  <Button className={styles.button} onClick={() => navigate("/community")}>Open Community</Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* ===== Users Table ===== */}
        <Card className={`${styles.card} mt-3`}>
          <Card.Body className={styles.cardBody}>
            <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
              <div>
                <h5 className={styles.blockTitle}>Recent Users</h5>
                <small className="text-muted">Search, filter by role and take actions.</small>
              </div>
              <div className="d-flex gap-2">
                <Form.Control
                  placeholder="Search name / email / id"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={styles.input}
                />
                <Form.Select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={styles.input}
                >
                  <option value="all">All roles</option>
                  <option value="user">User</option>
                  <option value="therapist">Therapist</option>
                  <option value="admin">Admin</option>
                </Form.Select>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <Table responsive hover className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Verified</th>
                    <th>Active</th>
                    <th>Joined</th>
                    <th style={{ width: 300 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => (
                    <tr key={u._id || i}>
                      <td>{i + 1}</td>
                      <td>{u.name || "—"}</td>
                      <td>{u.email || "—"}</td>
                      <td>
                        <Badge bg="" className={styles.rolePill + " " + styles[`role_${u.role || "user"}`]}>
                          {u.role || "user"}
                        </Badge>
                      </td>
                      <td>{u.isVerified ? <Badge bg="" className={styles.ok}>Yes</Badge> : <Badge bg="" className={styles.warn}>No</Badge>}</td>
                      <td>{u.isActive ? <Badge bg="" className={styles.ok}>Active</Badge> : <Badge bg="" className={styles.muted}>Inactive</Badge>}</td>
                      <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          <Button size="sm" className={styles.button} disabled={tableBusy} onClick={() => toggleFlag(u._id, "isVerified")}>
                            Toggle Verify
                          </Button>
                          <Button size="sm" className={styles.button} disabled={tableBusy} onClick={() => toggleFlag(u._id, "isActive")}>
                            {u.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          {u.role === "therapist" && !u.isApprovedTherapist && (
                            <Button size="sm" className={styles.button} disabled={tableBusy} onClick={() => approveTherapist(u._id)}>
                              Approve
                            </Button>
                          )}
                          <Button size="sm" variant="outline-secondary" className={styles.outlineBtn} disabled={tableBusy} onClick={() => impersonate(u._id)}>
                            Impersonate
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        {tableBusy ? <InlineLoader /> : "No users match your filter."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}
