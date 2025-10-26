import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Badge,
  Spinner,
  Alert,
  Form,
  ProgressBar,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import { GoogleFitContext } from "../../context/GoogleFitProvider";
import styles from "./Dashboard.module.css";

// Images
import SleepImg from "../images/Sleep.jpg";
import MoodImg from "../images/Mood.jpg";
import RefreshImg from "../images/Refresh.jpg";
import ReportImg from "../images/Report.jpg";
import StressImg from "../images/Stress.jpg";
import MotivationImg from "../images/Motivation.jpg";
import ExerciseImg from "../images/Mental.jpg";
import GamesImg from "../images/BrainGames.jpg";
import CommunityImg from "../images/BrainGames.jpg";
import TherapistImg from "../images/BrainGames.jpg";

const BRANDS = [
  { value: "fitbit", label: "Fitbit" },
  { value: "amazfit", label: "Amazfit / Zepp" },
  { value: "samsung", label: "Samsung Galaxy Watch" },
  { value: "oneplus", label: "OnePlus / Realme / Oppo" },
  { value: "noise", label: "Noise / boAt / Fire-Boltt" },
  { value: "garmin", label: "Garmin" },
  { value: "others", label: "Other / Not sure" },
];

const FEATURES = [
  { title: "Mental Exercise", img: ExerciseImg, link: "/Exercise" },
  { title: "Sleep & Relaxation", img: SleepImg, link: "/Sleep&Relaxation" },
  { title: "Mood Tracker", img: MoodImg, link: "/mood_tracker" },
  { title: "Stress Monitoring", img: StressImg, link: "/stress_tracker" },
  { title: "Daily Motivation", img: MotivationImg, link: "/daily_motivation" },
  { title: "Mood Refresher", img: RefreshImg, link: "/mood_refresher" },
  { title: "Brain Games", img: GamesImg, link: "/Games" },
  { title: "Report", img: ReportImg, link: "/report" },
  { title: "Community", img: CommunityImg, link: "/community" },
  { title: "1-on-1 Therapist Session", img: TherapistImg, link: "/book-therapist" },
  { title: "Specialised Nutrition", img: TherapistImg, link: "/nutrition" },
];

/* ------------------------------ Utilities ------------------------------ */

function usePlatform() {
  return useMemo(() => {
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    return { isAndroid, isIOS, label: isAndroid ? "Android" : isIOS ? "iOS" : "Unknown" };
  }, []);
}

function brandTipsFor(brand) {
  switch (brand) {
    case "fitbit":
      return [
        "Fitbit app → Profile → Third-party apps → Connect Google Fit",
        "Allow steps, heart rate, and sleep permissions",
      ];
    case "amazfit":
      return [
        "Zepp app → Profile → Add Accounts → Google Fit",
        "Enable activity, sleep, heart rate sync",
      ];
    case "samsung":
      return [
        "Install ‘Health Sync’ from Play Store",
        "Open Health Sync → Source: Samsung Health → Destination: Google Fit",
        "Grant all requested permissions",
      ];
    case "oneplus":
      return [
        "Open your watch app (OnePlus/Realme/Oppo)",
        "Settings → Accounts → Connect / Sync with Google Fit",
      ];
    case "noise":
      return [
        "Open your watch app (Noise/boAt/Fire-Boltt)",
        "Settings → Accounts → Connect with Google Fit",
      ];
    case "garmin":
      return [
        "Open Garmin Connect app",
        "Use a bridge like ‘Health Sync’ to send data → Google Fit",
      ];
    case "others":
    default:
      return [
        "Open your companion app",
        "Look for ‘Google Fit’ in Accounts/Integrations and enable it",
      ];
  }
}

/* ---------------------------- Small Components ---------------------------- */

function StatusPill({ connected, loading }) {
  if (loading) {
    return (
      <span className="d-inline-flex align-items-center">
        <Spinner animation="border" size="sm" className="me-2" />
        <span className="fw-semibold">Checking connection…</span>
      </span>
    );
  }
  return connected ? (
    <Badge bg="success" className="rounded-pill">Connected</Badge>
  ) : (
    <Badge bg="danger" className="rounded-pill">Disconnected</Badge>
  );
}

function AssistantSteps({ platform, brand }) {
  const tips = brandTipsFor(brand);
  return (
    <Row className="g-4 mt-1">
      <Col md={6}>
        <h6 className="fw-bold mb-2">Step 1 — Install & Sign In</h6>
        <ul className="mb-0">
          <li>
            Install <strong>Google Fit</strong> on your phone (
            {platform.isAndroid ? "Play Store" : platform.isIOS ? "App Store" : "Android/iOS"}
            ).
          </li>
          <li>
            Sign in with the <strong>same Google account</strong> you’ll use here.
          </li>
        </ul>
      </Col>

      <Col md={6}>
        <h6 className="fw-bold mb-2">Step 2 — Link Watch → Google Fit</h6>
        <ul className="mb-0">
          {tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </Col>

      <Col md={6}>
        <h6 className="fw-bold mb-2">Step 3 — Connect Google Fit → Website</h6>
        <ul className="mb-0">
          <li>Return here and click <strong>Connect Now</strong>.</li>
          <li>Approve permissions for activity, sleep, and stress (read-only).</li>
        </ul>
      </Col>

      <Col md={6}>
        <h6 className="fw-bold mb-2">Tips</h6>
        <ul className="mb-0">
          <li>If data doesn’t appear, open Google Fit and pull-to-refresh.</li>
          <li>Samsung users: ensure <em>Health Sync</em> shows “Synced”.</li>
        </ul>
      </Col>
    </Row>
  );
}

function FeatureCardGrid({ features, isConnected }) {
  return (
    <Row className="g-4 mt-3">
      {features.map((item, index) => (
        <Col key={index} xs={6} sm={6} md={4} lg={3} className="d-flex justify-content-center">
          <Link
            to={item.link}
            className={`${styles.card} shadow-lg`}
            aria-label={`Open ${item.title}`}
          >
            <div className={styles.imageWrapper}>
              <img src={item.img} alt={item.title} className={styles.image} />
            </div>
            <p className={styles.cardTitle}>{item.title}</p>

            {(item.title === "Sleep & Relaxation" ||
              item.title === "Stress Monitoring" ||
              item.title === "Mental Exercise") &&
              isConnected && (
                <Badge
                  bg="primary"
                  className={styles.dataBadge}
                  style={{ position: "absolute", top: 10, right: 10 }}
                >
                  GF Sync
                </Badge>
              )}
          </Link>
        </Col>
      ))}
    </Row>
  );
}

/* ---------------------------- Main Component ---------------------------- */

export default function Dashboard() {
  const { account, statusLoading, linkGoogleFit, unlinkGoogleFit } = useContext(GoogleFitContext);
  const isConnected = !!account?.linked;
  const platform = usePlatform();

  const [brand, setBrand] = useState(() => localStorage.getItem("watch_brand") || "");
  useEffect(() => {
    if (brand) localStorage.setItem("watch_brand", brand);
  }, [brand]);

  const [showAssistant, setShowAssistant] = useState(() => !isConnected);
  useEffect(() => {
    setShowAssistant(!isConnected);
  }, [isConnected]);

  const progress = useMemo(() => {
    if (isConnected) return 100;
    let p = 20; // onboarding shown
    if (platform.label !== "Unknown") p += 20;
    if (brand) p += 30;
    // remaining 30% on actual OAuth connect
    return Math.min(p, 95);
  }, [isConnected, platform.label, brand]);

  const handleAuthClick = (e) => {
    e.stopPropagation();
    isConnected ? unlinkGoogleFit() : linkGoogleFit();
  };

  return (
    <div className={styles.dashboard}>
      <Container fluid="md">
        {/* Page Intro — moved to top */}
        <header className="mb-3">
          <h2 className={styles.heading}>Your Mindful Wellness Space</h2>
          <p className={styles.subheading}>
            Build calm, motivation, and growth through guided activities.
          </p>
        </header>

        {/* Connection Assistant (Below the header now) */}
        <Card
          className="mb-4 shadow-sm"
          style={{
            borderRadius: 15,
            border: "2px solid",
            borderColor: isConnected ? "#198754" : "#0d6efd",
            backgroundColor: isConnected ? "#e9f7ee" : "#eaf4ff",
            transition: "border-color 200ms ease, background-color 200ms ease",
          }}
        >
          <Card.Body className="py-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div className="d-flex align-items-center">
                <StatusPill connected={isConnected} loading={statusLoading} />

                {!statusLoading && isConnected && (
                  <>
                    {account?.picture && (
                      <img
                        src={account.picture}
                        alt="Profile avatar"
                        width={40}
                        height={40}
                        style={{
                          borderRadius: "50%",
                          objectFit: "cover",
                          marginLeft: 12,
                          marginRight: 12,
                        }}
                      />
                    )}
                    <div className="me-3">
                      <div className="fw-semibold">Google Fit Connected</div>
                      <div className="small text-muted">
                        {account?.name || "User"} {account?.email ? `• ${account.email}` : ""}
                      </div>
                    </div>
                  </>
                )}

                {!statusLoading && !isConnected && (
                  <div className="ms-2">
                    <div className="fw-semibold text-danger">
                      Connect Google Fit to unlock real-time insights
                    </div>
                    <div className="small text-muted">Detected platform: {platform.label}</div>
                  </div>
                )}
              </div>

              {!statusLoading && (
                <div className="d-flex align-items-center gap-2">
                  <Button
                    variant={isConnected ? "outline-danger" : "primary"}
                    size="sm"
                    onClick={handleAuthClick}
                    aria-label={isConnected ? "Disconnect Google Fit" : "Connect Google Fit"}
                  >
                    {isConnected ? "Disconnect" : "Connect Now"}
                  </Button>
                  {!isConnected && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setShowAssistant((s) => !s)}
                      aria-expanded={showAssistant}
                      aria-controls="connection-assistant"
                    >
                      {showAssistant ? "Hide Guide" : "Show Guide"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {!isConnected && showAssistant && (
              <>
                <hr />
                <Row className="g-3 align-items-end">
                  <Col md={6}>
                    <Form.Group controlId="brandSelect">
                      <Form.Label className="fw-semibold mb-1">Smartwatch brand</Form.Label>
                      <Form.Select
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        aria-label="Select smartwatch brand"
                      >
                        <option value="">Select brand…</option>
                        {BRANDS.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </Form.Select>
                      <div className="form-text">We’ll tailor the steps below.</div>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <div className="mb-1 d-flex justify-content-between">
                      <span className="fw-semibold">Connection Progress</span>
                      <span className="small text-muted">{progress}%</span>
                    </div>
                    <ProgressBar now={progress} animated aria-label="Connection progress" />
                  </Col>
                </Row>

                <div id="connection-assistant" className="mt-2">
                  <AssistantSteps platform={platform} brand={brand} />
                </div>

                <Alert variant="success" className="mt-3 mb-0 py-2">
                  ✅ After connecting, your metrics will flow into <em>Stress Monitoring</em>,{" "}
                  <em>Sleep & Relaxation</em>, and <em>Mental Exercise</em> automatically.
                </Alert>
              </>
            )}
          </Card.Body>
        </Card>

        {/* Feature Grid */}
        <FeatureCardGrid features={FEATURES} isConnected={isConnected} />
      </Container>
    </div>
  );
}
