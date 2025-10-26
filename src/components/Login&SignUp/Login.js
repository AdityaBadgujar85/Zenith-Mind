// components/Login&SignUp/Login.jsx
import React, { useState } from "react";
import { Container, Row, Col, Card, Form, Button } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./Login.module.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const API_BASE = "http://localhost:7000";

  // Infer intent from path (works for /admin/login, /therapist/login)
  const pathname = location.pathname.toLowerCase();
  const intendedRole =
    pathname.includes("/admin/") ? "admin" :
    pathname.includes("/therapist/") ? "therapist" :
    "user";

  const loginPath =
    intendedRole === "admin"
      ? "/api/admin/auth/login"
      : intendedRole === "therapist"
      ? "/api/therapist/auth/login"
      : "/api/auth/login";

  const redirectForRole = (role) => {
    switch ((role || "user").toLowerCase()) {
      case "admin": return "/admin";
      case "therapist": return "/therapist";
      default: return "/sleep";
    }
  };

  async function whoamiAdmin(token) {
    const res = await fetch(`${API_BASE}/api/admin/auth/whoami`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Admin whoami failed (${res.status}) ${t || ""}`);
    }
    const data = await res.json();
    return data?.user;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}${loginPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // <-- allow httpOnly cookie path as backup
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(`Unexpected non-JSON response (${res.status}).`); }

      if (!res.ok) throw new Error(data?.message || `Login failed (${res.status})`);

      const user = data.user || {};
      const role = (user.role || "user").toLowerCase();
      const token = data.token;

      if (!token) throw new Error("No token received from server.");

      // Store tokens (keep your existing keys, add admin_token for admin)
      localStorage.setItem("auth_token", token);
      localStorage.setItem("token", token);
      if (role === "admin") localStorage.setItem("admin_token", token);
      localStorage.setItem("user", JSON.stringify(user));
      window.dispatchEvent(new Event("userLogin"));

      // If admin, verify session against protected whoami (catches wrong token/header)
      if (role === "admin") {
        try {
          await whoamiAdmin(token);
        } catch (err) {
          console.error("Admin whoami error:", err);
          alert("Admin session could not be verified. Make sure the token is attached to admin requests.");
          return;
        }
      }

      // redirect based on real server role
      navigate(redirectForRole(role), { replace: true });
    } catch (err) {
      alert(err.message || "Unable to login");
      console.error("Login error:", err);
    }
  };

  return (
    <Container fluid className={styles.loginContainer}>
      <Row className="w-100 justify-content-center">
        <Col xs={11} sm={8} md={6} lg={4}>
          <Card className={styles.card}>
            <Card.Body className={styles.cardBody}>
              <h2 className={styles.title}>ZenithMind</h2>
              <p className={styles.subtitle}>Login to continue your mental wellness journey</p>

              <Form onSubmit={handleSubmit}>
                <Form.Group controlId="email" className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={styles.input}
                    required
                  />
                </Form.Group>

                <Form.Group controlId="password" className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.input}
                    required
                  />
                </Form.Group>

                <div className="d-flex justify-content-between align-items-center mb-3">
                  <Form.Check type="checkbox" label="Remember me" />
                  <a href="/forgot-password" className={styles.link}>Forgot password?</a>
                </div>

                <div className="d-grid">
                  <Button type="submit" className={styles.button}>Login</Button>
                </div>
              </Form>

              <div className={styles.signup}>
                <small>
                  Don’t have an account?{" "}
                  <a href="/signup" className={styles.link}>Sign up</a>
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Login;
