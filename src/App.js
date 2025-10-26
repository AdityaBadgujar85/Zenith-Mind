import React, { createContext, useState, useEffect, useMemo } from "react";
import "./App.css";
import { Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";

import NavBar from "./components/Navbar/NavBar";
import Dashboard from "./components/HomePage/Dashboard";
import MentalFitnessGamesDashboard from "./components/HomePage/MentalFitnessGames/MentalFitnessGamesDashboard";
import WordScramble from "./components/HomePage/MentalFitnessGames/WordScrable";
import Displaygames from "./components/HomePage/MentalFitnessGames/Displaygames";
import MemoryCardGame from "./components/HomePage/MentalFitnessGames/MemoryCardGame";
import QuickMathBlitz from "./components/HomePage/MentalFitnessGames/QuickMathBlitz";
import SequenceTap from "./components/HomePage/MentalFitnessGames/SequenceTap";
import MenalExerciseDashboard from "./components/HomePage/MentalExercise.js/MentalExerciseDashboard";
import SleepRelaxationWidget from "./components/HomePage/Sleep_and_Relaxation/SleepRelaxationWidget";
import AdvancedMoodTracker from "./components/HomePage/Mood_Tracker/AdvancedMoodTracker";
import AICbtChat from "./components/HomePage/AI_Chat_Bot/AICbtChat";
import DailyMotivationAffirmations from "./components/HomePage/DailyMotivation/DailyMotivationAffirmations";
import StressHabitTracker from "./components/HomePage/StressHabitTracker/StressHabitTracker";
import ReportPage from "./components/HomePage/ReportPage/ReportPage";
import Login from "./components/Login&SignUp/Login";
import SignUp from "./components/Login&SignUp/SignUp";
import Footer from "./components/Navbar/Footer";
import Contact from "./components/ContactPage/Contact";
import About from "./components/AboutPage/About";
import Community from "./components/HomePage/Community/Community";

// Admin
import AdminDashboard from "./components/AdminPage/AdminDashboard";

// 1-on-1 Therapist
import TherapistDirectory from "./components/one_on_one_therapist/TherapistDirectory";
import BookAppointment from "./components/one_on_one_therapist/BookAppointment";
import MyAppointments from "./components/one_on_one_therapist/MyAppointments";
import TherapistProfileEditor from "./components/one_on_one_therapist/TherapistProfileEditor";
import TherapistDashboard from "./components/one_on_one_therapist/TherapistDashboard";

// Google Fit context
import { GoogleFitProvider } from "./context/GoogleFitProvider";

// Nutrients Page
import SpecialistNutrition from "./components/HomePage/Special_Nutrients/SpecialistNutrition";

export const AppDataContext = createContext(null);

const LOCAL_KEYS = {
  MOOD: "app_mood_data",
  SLEEP: "app_sleep_data",
  STRESS: "app_stress_data",
};

// Prefer same-origin relative API (works with dev proxy). Fallback to localhost:7000.
const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  "" || // relative (recommended with proxy)
  "http://localhost:7000";

function parseAuthUserId() {
  try {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return null;
    const user = JSON.parse(rawUser);
    return user?._id || null;
  } catch {
    return null;
  }
}

/** Protected route with optional role gating + backend admin verification (no conditional hooks) */
function ProtectedRoute({ children, roles }) {
  const location = useLocation();
  const [checking, setChecking] = useState(false);
  const [allowed, setAllowed] = useState(true); // default allow unless we must verify

  const getToken = () =>
    localStorage.getItem("admin_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    "";

  const token = getToken();

  // role config
  const hasRoleGate = Array.isArray(roles) && roles.length > 0;
  const requiredRoles = hasRoleGate ? roles.map((r) => r.toLowerCase()) : [];

  // cached role
  let cachedRole = "user";
  try {
    const rawUser = localStorage.getItem("user");
    const user = rawUser ? JSON.parse(rawUser) : null;
    cachedRole = (user?.role || "user").toLowerCase();
  } catch {
    cachedRole = "user";
  }

  const needsAdmin = requiredRoles.includes("admin");

  // Always run effect (no conditional hooks)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // If there is no role gate, stay allowed.
      if (!hasRoleGate) {
        if (!cancelled) setAllowed(true);
        return;
      }

      // If admin is required, verify with backend once.
      if (needsAdmin) {
        if (!token) {
          if (!cancelled) setAllowed(false);
          return;
        }
        if (!cancelled) {
          setChecking(true);
          setAllowed(false);
        }
        try {
          const res = await fetch(`${API_BASE}/api/admin/auth/whoami`, {
            method: "GET",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: "include",
          });
          if (!cancelled) setAllowed(res.ok);
        } catch {
          if (!cancelled) setAllowed(false);
        } finally {
          if (!cancelled) setChecking(false);
        }
        return;
      }

      // Non-admin gated route: check cached role
      if (!cancelled) setAllowed(requiredRoles.includes(cachedRole));
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRoleGate, needsAdmin, token, cachedRole, API_BASE, JSON.stringify(requiredRoles)]);

  // RENDER (no hooks below)

  // If no token, send to appropriate login page
  if (!token) {
    const path = location.pathname.startsWith("/admin")
      ? "/admin/login"
      : location.pathname.startsWith("/therapist")
      ? "/therapist/login"
      : "/login";
    return <Navigate to={path} replace state={{ from: location }} />;
  }

  if (!hasRoleGate) {
    return children;
  }

  if (needsAdmin) {
    if (checking) return <div style={{ padding: 24 }}>Checking admin session…</div>;
    if (!allowed) return <Navigate to="/admin/login" replace state={{ from: location }} />;
    return children;
  }

  if (!allowed) {
    if (cachedRole === "admin") return <Navigate to="/admin" replace />;
    if (cachedRole === "therapist") return <Navigate to="/therapist" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/** Redirect / -> role-specific home (prefers admin_token) */
function RoleHomeRedirect() {
  const getToken = () =>
    localStorage.getItem("admin_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    "";
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;

  let role = "user";
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    role = (u.role || "user").toLowerCase();
  } catch {}

  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "therapist") return <Navigate to="/therapist" replace />;
  return <Navigate to="/dashboard" replace />;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Local app state (persisted)
  const [moodEntries, setMoodEntries] = useState(() => {
    const raw = localStorage.getItem(LOCAL_KEYS.MOOD);
    return raw ? JSON.parse(raw) : [];
  });
  const [sleepData, setSleepData] = useState(() => {
    const raw = localStorage.getItem(LOCAL_KEYS.SLEEP);
    return raw ? JSON.parse(raw) : [];
  });
  const [stressData, setStressData] = useState(() => {
    const raw = localStorage.getItem(LOCAL_KEYS.STRESS);
    return raw ? JSON.parse(raw) : {};
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_KEYS.MOOD, JSON.stringify(moodEntries));
  }, [moodEntries]);
  useEffect(() => {
    localStorage.setItem(LOCAL_KEYS.SLEEP, JSON.stringify(sleepData));
  }, [sleepData]);
  useEffect(() => {
    localStorage.setItem(LOCAL_KEYS.STRESS, JSON.stringify(stressData));
  }, [stressData]);

  // Reset contexts when auth changes
  const [authUserId, setAuthUserId] = useState(() => parseAuthUserId());
  useEffect(() => {
    const handleAuthUpdated = () => setAuthUserId(parseAuthUserId());
    const handleStorage = (e) => {
      if (e.key === "auth_token" || e.key === "user" || e.key === "admin_token") handleAuthUpdated();
    };
    const handleVisibility = () => {
      if (!document.hidden) handleAuthUpdated();
    };
    window.addEventListener("auth_token_updated", handleAuthUpdated);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("auth_token_updated", handleAuthUpdated);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Remove ?gf=linked noise after OAuth
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("gf") === "linked" && location.pathname === "/Sleep&Relaxation") {
      params.delete("gf");
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const contextValue = useMemo(
    () => ({
      moodEntries,
      setMoodEntries,
      sleepData,
      setSleepData,
      stressData,
      setStressData,
    }),
    [moodEntries, sleepData, stressData]
  );

  return (
    <AppDataContext.Provider value={contextValue}>
      <GoogleFitProvider key={authUserId || "guest"}>
        <div className="App">
          <NavBar />
          <Routes>
            {/* Public auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin/signup" element={<SignUp />} />
            <Route path="/therapist/login" element={<Login />} />
            <Route path="/therapist/signup" element={<SignUp />} />

            {/* Home redirect */}
            <Route path="/" element={<RoleHomeRedirect />} />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Therapist */}
            <Route
              path="/therapist"
              element={
                <ProtectedRoute roles={["therapist"]}>
                  <TherapistDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/therapist/profile"
              element={
                <ProtectedRoute roles={["therapist", "admin"]}>
                  <TherapistProfileEditor />
                </ProtectedRoute>
              }
            />

            {/* User features */}
            <Route path="/book-therapist" element={<ProtectedRoute><TherapistDirectory /></ProtectedRoute>} />
            <Route path="/book-therapist/:therapistId" element={<ProtectedRoute><BookAppointment /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><MyAppointments /></ProtectedRoute>} />

            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/Games" element={<ProtectedRoute><MentalFitnessGamesDashboard /></ProtectedRoute>} />
            <Route path="/Display" element={<ProtectedRoute><Displaygames /></ProtectedRoute>}>
              <Route path="Word-Scramble" element={<WordScramble />} />
              <Route path="Memory-Card-Game" element={<MemoryCardGame />} />
              <Route path="Quick-Maths-Blitz" element={<QuickMathBlitz />} />
              <Route path="Sequence-Taps" element={<SequenceTap />} />
            </Route>
            <Route path="/Exercise" element={<ProtectedRoute><MenalExerciseDashboard /></ProtectedRoute>} />

            {/* Sleep & Fit-integrated */}
            <Route path="/Sleep&Relaxation" element={<ProtectedRoute><SleepRelaxationWidget /></ProtectedRoute>} />

            <Route path="/mood_tracker" element={<ProtectedRoute><AdvancedMoodTracker /></ProtectedRoute>} />
            <Route path="/mood_refresher" element={<ProtectedRoute><AICbtChat /></ProtectedRoute>} />
            <Route path="/daily_motivation" element={<ProtectedRoute><DailyMotivationAffirmations /></ProtectedRoute>} />
            <Route path="/stress_tracker" element={<ProtectedRoute><StressHabitTracker /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
            <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
            <Route path="/contact" element={<ProtectedRoute><Contact /></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />

            {/* Nutrients Tab */}
            <Route path="/nutrition" element={<SpecialistNutrition />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
        </div>
      </GoogleFitProvider>
    </AppDataContext.Provider>
  );
}

export default App;
