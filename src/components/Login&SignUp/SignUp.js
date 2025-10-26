// components/Login&SignUp/SignUp.jsx
import React, { useState } from "react";
import { Container, Row, Col, Card, Form, Button } from "react-bootstrap";
import { useLocation } from "react-router-dom";
import styles from "./SignUp.module.css";

const API_BASE = "http://localhost:7000"; // use "" with proxy; or "http://localhost:7000" without proxy

function SignUp() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agree: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();

  // Infer role from path: /admin/signup, /therapist/signup, else user
  const pathname = location.pathname.toLowerCase();
  const role =
    pathname.includes("/admin/") ? "admin" :
    pathname.includes("/therapist/") ? "therapist" :
    "user";

  // Query params
  const qs = new URLSearchParams(location.search);
  const inviteCode = (qs.get("code") || "").trim();           // /admin/signup?code=SECRET
  const credentials = (qs.get("cred") || "").trim() || undefined; // /therapist/signup?cred=RCI-2024

  const baseSignupPath =
    role === "admin"
      ? "/api/admin/auth/signup"
      : role === "therapist"
      ? "/api/therapist/auth/signup"
      : "/api/auth/register";

  const loginPath =
    role === "admin"
      ? "/api/admin/auth/login"
      : role === "therapist"
      ? "/api/therapist/auth/login"
      : "/api/auth/login";

  const postSignupRedirect =
    role === "admin" ? "/admin" : role === "therapist" ? "/therapist" : "/";

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
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

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    if (!formData.agree) {
      alert("You must agree to the terms and conditions.");
      return;
    }

    const name = formData.name.trim();
    const email = formData.email.trim();
    const password = formData.password;

    const signupBody =
      role === "admin"
        ? { name, email, password, inviteCode }
        : role === "therapist"
        ? { name, email, password, credentials }
        : { name, email, password };

    const signupPath =
      role === "admin" && inviteCode
        ? `${baseSignupPath}?code=${encodeURIComponent(inviteCode)}`
        : baseSignupPath;

    setSubmitting(true);
    try {
      // 1) Signup
      const resReg = await fetch(`${API_BASE}${signupPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // allow backend cookie too
        body: JSON.stringify(signupBody),
      });

      const regText = await resReg.text();
      let regData;
      try {
        regData = JSON.parse(regText);
      } catch {
        throw new Error(
          `Signup failed (non-JSON response). Check backend/proxy.\n${regText.slice(0, 200)}…`
        );
      }
      if (!resReg.ok) {
        throw new Error(regData?.message || "Signup failed");
      }

      // 2) Auto-login
      const resLogin = await fetch(`${API_BASE}${loginPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const loginText = await resLogin.text();
      let loginData;
      try {
        loginData = JSON.parse(loginText);
      } catch {
        throw new Error(
          `Login after signup failed (non-JSON). Check backend/proxy.\n${loginText.slice(0, 200)}…`
        );
      }
      if (!resLogin.ok) {
        throw new Error(loginData?.message || "Login failed");
      }

      const token = loginData.token;
      const user = loginData.user || {};
      const userRole = (user.role || "user").toLowerCase();

      if (!token) throw new Error("No token received from server.");

      // Store tokens (keep existing keys, add admin_token for admin)
      localStorage.setItem("auth_token", token);
      localStorage.setItem("token", token);
      if (userRole === "admin") localStorage.setItem("admin_token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // 3) Verify admin session if applicable
      if (userRole === "admin") {
        try {
          await whoamiAdmin(token);
        } catch (err) {
          console.error("Admin whoami error:", err);
          alert("Admin session could not be verified. Make sure the token is attached to admin requests.");
          return;
        }
      }

      // 4) Redirect based on actual server role
      window.location.href = userRole === "admin" ? "/admin" : userRole === "therapist" ? "/therapist" : "/";
    } catch (err) {
      alert(err.message || "Unable to sign up");
      console.error("Signup error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container fluid className={styles.signupContainer}>
      <Row className="w-100 justify-content-center">
        <Col xs={11} sm={8} md={6} lg={4}>
          <Card className={styles.card}>
            <Card.Body className={styles.cardBody}>
              <h2 className={styles.title}>ZenithMind</h2>
              <p className={styles.subtitle}>
                Create your account and start your mental wellness journey
              </p>

              <Form onSubmit={handleSubmit}>
                <Form.Group controlId="name" className="mb-3">
                  <Form.Label>Full Name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter your full name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={styles.input}
                    required
                  />
                </Form.Group>

                <Form.Group controlId="email" className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="Enter your email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={styles.input}
                    required
                  />
                </Form.Group>

                <Form.Group controlId="password" className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Enter your password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={styles.input}
                    required
                  />
                </Form.Group>

                <Form.Group controlId="confirmPassword" className="mb-3">
                  <Form.Label>Confirm Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Re-enter your password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={styles.input}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="I agree to the Terms and Conditions"
                    name="agree"
                    checked={formData.agree}
                    onChange={handleChange}
                    className={styles.checkBox}
                    required
                  />
                </Form.Group>

                <div className="d-grid">
                  <Button type="submit" className={styles.button} disabled={submitting}>
                    {submitting ? "Creating..." : "Sign Up"}
                  </Button>
                </div>
              </Form>

              <div className={styles.loginRedirect}>
                <small>
                  Already have an account?{" "}
                  <a href="/login" className={styles.link}>
                    Log in
                  </a>
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default SignUp;
