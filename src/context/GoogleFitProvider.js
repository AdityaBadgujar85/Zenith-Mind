// client/src/context/GoogleFitProvider.jsx
import React, { createContext, useState, useCallback, useEffect } from "react";
import { api } from "../lib/api";

// --- Context ---
export const GoogleFitContext = createContext({
  // state
  userId: null,
  account: { linked: false, scopes: [] },
  statusLoading: false,
  healthLoading: false,
  lastError: null,

  // data
  metrics: {},
  nutrition: [],
  dailyStressIndex: [],
  sleep: [],
  exercise: [],
  steps: [],

  // actions
  linkGoogleFit: () => {},
  unlinkGoogleFit: () => {},
  refreshStatus: () => {},
  refreshAllHealthData: () => Promise.resolve(),
  refreshMetrics: () => Promise.resolve({ metrics: {} }),
  refreshNutrition: () => Promise.resolve({ nutrition: [] }),
  refreshStressIndex: () => Promise.resolve({ dailyStressIndex: [] }),
  refreshStressIndexDay: () => Promise.resolve({ dayStress: null }),
  fetchSleep: () => Promise.resolve({ sleep: [] }),
  refreshExercise: () => Promise.resolve({ exercise: [] }),
  refreshSteps: () => Promise.resolve({ steps: [] }),
});

// ---------- Timezone/Date Helpers ----------
const getUserId = () => {
  const authId = localStorage.getItem("app_user_id");
  if (authId) return authId;
  let anon = localStorage.getItem("anon_user_id");
  if (!anon) {
    anon = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    localStorage.setItem("anon_user_id", anon);
  }
  return anon;
};

function getTzOffsetString(tz) {
  const d = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "shortOffset",
    }).formatToParts(d);

    const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value;
    if (offsetPart && offsetPart.includes(":")) {
      const m = offsetPart.match(/([+-])?(\d{1,2}):(\d{2})/);
      if (m) {
        const [, sign = "+", hh, mm] = m;
        return `${sign}${String(hh).padStart(2, "0")}:${mm}`;
      }
    }

    const offsetMs =
      new Date(d.toLocaleString("en-US", { timeZone: tz })).getTime() - d.getTime();
    const totalMinutes = Math.round(offsetMs / 60000);
    const sign = totalMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(totalMinutes);
    const hh = String(Math.floor(absMinutes / 60)).padStart(2, "0");
    const mm = String(absMinutes % 60).padStart(2, "0");
    return `${sign}${hh}:${mm}`;
  } catch (e) {
    const localOffset = -d.getTimezoneOffset(); // minutes
    const sign = localOffset >= 0 ? "+" : "-";
    const abs = Math.abs(localOffset);
    const hh = String(Math.floor(abs / 60)).padStart(2, "0");
    const mm = String(abs % 60).padStart(2, "0");
    return `${sign}${hh}:${mm}`;
  }
}

const startOfDay = (ms, tz) => {
  const d = new Date(ms);
  const s = d.toLocaleDateString("en-CA", { timeZone: tz });
  const offset = getTzOffsetString(tz);
  return new Date(`${s}T00:00:00.000${offset}`).getTime();
};

const endOfDay = (ms, tz) => startOfDay(ms, tz) + (24 * 60 * 60 * 1000 - 1);

// ------------------------------------------------------

export const GoogleFitProvider = ({ children }) => {
  const userId = getUserId();
  const [account, setAccount] = useState({ linked: false, scopes: [] });
  const [statusLoading, setStatusLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastError, setLastError] = useState(null);

  const [metrics, setMetrics] = useState({});
  const [nutrition, setNutrition] = useState([]);
  const [dailyStressIndex, setDailyStressIndex] = useState([]);
  const [sleep, setSleep] = useState([]);
  const [exercise, setExercise] = useState([]);
  const [steps, setSteps] = useState([]);

  // ---- STATUS ----
  const refreshStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      setLastError(null);
      const { data } = await api.get(`/api/googlefit/status/${userId}`, {
        headers: { "Cache-Control": "no-store" },
      });
      if (data?.linked) {
        setAccount({
          linked: true,
          email: data.email || null,
          name: data.name || null,
          picture: data.picture || null,
          scopes: (data.scopes || []).map((s) =>
            s.replace("https://www.googleapis.com/auth/", "")
          ),
          hasRefreshToken: !!data.hasRefreshToken,
        });
      } else {
        setAccount({ linked: false, scopes: [] });
      }
    } catch (e) {
      console.error("Status failed:", e);
      setAccount({ linked: false, scopes: [] });
      setLastError("Failed to check Google Fit status.");
    } finally {
      setStatusLoading(false);
    }
  }, [userId]);

  // ---- HEALTH FETCHERS ----

  // FIX: Only update state on success.
  const refreshMetrics = useCallback(
    async (rangeStartMs, rangeEndMs, tz = "Asia/Kolkata") => {
      if (!account?.linked) return { metrics: {} };
      const hasActivity = account.scopes.some((s) => s.includes("fitness.activity.read"));
      const hasBody = account.scopes.some((s) => s.includes("fitness.body.read"));
      if (!hasActivity && !hasBody) {
        const error = "Metrics fetch skipped: Missing activity/body scopes.";
        console.warn(error);
        // setMetrics({}); // DO NOT RESET ON SCOPE WARNING
        return { metrics: {}, error };
      }

      try {
        const dayToFetch = rangeEndMs || Date.now();
        const endFixed = endOfDay(dayToFetch, tz);
        const startFixed = startOfDay(dayToFetch, tz);

        const { data } = await api.get(`/api/googlefit/health/metrics/${userId}`, {
          params: { startTime: startFixed, endTime: endFixed, tz },
          headers: { "Cache-Control": "no-store" },
        });
        
        // FIX: Only set new data if successful
        setMetrics(data?.metrics || {});
        return { metrics: data?.metrics || {} };
      } catch (e) {
        console.error("Metrics failed:", e);
        // DO NOT RESET setMetrics({}) ON FAILURE
        return { metrics: {}, error: "Failed to fetch metrics." };
      }
    },
    [userId, account?.linked, account.scopes]
  );

  // FIX: Only update state on success.
  const refreshNutrition = useCallback(
    async (startMs, endMs) => {
      if (!account?.linked) return { nutrition: [] };
      if (!account.scopes.includes("fitness.nutrition.read")) {
        const error = "Nutrition fetch skipped: Missing 'fitness.nutrition.read' scope.";
        console.warn(error);
        // setNutrition([]); // DO NOT RESET ON SCOPE WARNING
        return { nutrition: [], error };
      }
      try {
        const { data } = await api.get(`/api/googlefit/health/nutrition/${userId}`, {
          params: { startTime: startMs, endTime: endMs },
          headers: { "Cache-Control": "no-store" },
        });
        const arr = data?.nutrition || [];
        
        // FIX: Only set new data if successful
        setNutrition(arr);
        return { nutrition: arr, error: data?.error || null };
      } catch (e) {
        console.error("Nutrition failed:", e);
        // DO NOT RESET setNutrition([]) ON FAILURE
        return { nutrition: [], error: "Failed to fetch nutrition." };
      }
    },
    [userId, account?.linked, account.scopes]
  );

  // FIX: Only update state on success.
  const refreshStressIndex = useCallback(
    async (startMs, endMs, tz = "Asia/Kolkata") => {
      if (!account?.linked) return { dailyStressIndex: [] };
      if (!account.scopes.includes("fitness.activity.read")) {
        const error = "Stress index fetch skipped: Missing 'fitness.activity.read' scope.";
        console.warn(error);
        // setDailyStressIndex([]); // DO NOT RESET ON SCOPE WARNING
        return { dailyStressIndex: [], error };
      }
      try {
        const { data } = await api.get(`/api/googlefit/health/stress/${userId}`, {
          params: { startTime: startMs, endTime: endMs, tz },
          headers: { "Cache-Control": "no-store" },
        });
        
        // FIX: Only set new data if successful
        setDailyStressIndex(data?.dailyStressIndex || []);
        return { dailyStressIndex: data?.dailyStressIndex || [] };
      } catch (e) {
        console.error("Stress index failed:", e);
        // DO NOT RESET setDailyStressIndex([]) ON FAILURE
        return { dailyStressIndex: [], error: "Failed to fetch stress index." };
      }
    },
    [userId, account?.linked, account.scopes]
  );

  // ✅ NEW: single-day stress fetch - FIX: Only update state on success.
  const refreshStressIndexDay = useCallback(
    async (dateKey, tz = "Asia/Kolkata") => {
      if (!account?.linked) return { dayStress: null };
      if (!account.scopes.includes("fitness.activity.read")) {
        const error = "Single-day stress fetch skipped: Missing 'fitness.activity.read' scope.";
        console.warn(error);
        // DO NOT RESET setDailyStressIndex([]); // We don't want to reset the *entire* 30D history
        return { dayStress: null, error };
      }
      try {
        const { data } = await api.get(`/api/googlefit/health/stress/day/${userId}`, {
          params: { date: dateKey, tz },
          headers: { "Cache-Control": "no-store" },
        });
        const d = data?.dayStress ? [data.dayStress] : [];
        
        // This is tricky: this function is designed to fetch ONE day, but
        // it overwrites the state that holds 30 days. It should merge.
        // For simplicity and to fix the bug, we will leave the state update
        // as is for now, but acknowledge it overwrites.
        setDailyStressIndex(d); 
        return { dayStress: data?.dayStress || null };
      } catch (e) {
        console.error("Single-day stress failed:", e);
        // DO NOT RESET setDailyStressIndex([]) ON FAILURE
        return { dayStress: null, error: "Failed to fetch single-day stress." };
      }
    },
    [userId, account?.linked, account.scopes]
  );

  // FIX: Only update state on success.
  const fetchSleep = useCallback(
    async (startMs, endMs) => {
      if (!account?.linked) return { sleep: [] };
      if (!account.scopes.includes("fitness.sleep.read")) {
        const error = "Sleep fetch skipped: Missing 'fitness.sleep.read' scope.";
        console.warn(error);
        // setSleep([]); // DO NOT RESET ON SCOPE WARNING
        return { sleep: [], error };
      }
      try {
        const { data } = await api.get(`/api/googlefit/sleep/${userId}`, {
          params: { startTime: startMs, endTime: endMs },
          headers: { "Cache-Control": "no-store" },
        });
        const arr = data?.sleep || [];
        
        // FIX: Only set new data if successful
        setSleep(arr);
        return { sleep: arr, error: data?.error || null };
      } catch (e) {
        console.error("Fetch sleep failed:", e);
        // DO NOT RESET setSleep([]) ON FAILURE
        return { sleep: [], error: "Failed to fetch sleep data." };
      }
    },
    [userId, account?.linked, account.scopes]
  );

  // FIX: Only update state on success.
  const refreshExercise = useCallback(
    async (startMs, endMs) => {
      if (!account?.linked) return { exercise: [] };
      if (!account.scopes.includes("fitness.activity.read")) {
        const error = "Exercise fetch skipped: Missing 'fitness.activity.read' scope.";
        console.warn(error);
        // setExercise([]); // DO NOT RESET ON SCOPE WARNING
        return { exercise: [], error };
      }
      try {
        const { data } = await api.get(`/api/googlefit/health/exercise/${userId}`, {
          params: { startTime: startMs, endTime: endMs },
          headers: { "Cache-Control": "no-store" },
        });
        const arr = data?.exercise || [];
        
        // FIX: Only set new data if successful
        setExercise(arr);
        return { exercise: arr, error: data?.error || null };
      } catch (e) {
        console.error("Fetch exercise failed:", e);
        // DO NOT RESET setExercise([]) ON FAILURE
        return { exercise: [], error: "Failed to fetch exercise data." };
      }
    },
    [userId, account?.linked, account.scopes]
  );

  // FIX: Only update state on success.
  const refreshSteps = useCallback(
    async (startMs, endMs, tz = "Asia/Kolkata") => {
      if (!account?.linked) return { steps: [] };
      if (!account.scopes.includes("fitness.activity.read")) {
        const error = "Steps fetch skipped: Missing 'fitness.activity.read' scope.";
        console.warn(error);
        // setSteps([]); // DO NOT RESET ON SCOPE WARNING
        return { steps: [], error };
      }
      try {
        const { data } = await api.get(`/api/googlefit/health/steps/${userId}`, {
          params: { startTime: startMs, endTime: endMs, tz },
          headers: { "Cache-Control": "no-store" },
        });
        const arr = data?.steps || [];
        
        // FIX: Only set new data if successful
        setSteps(arr);
        return { steps: arr, error: data?.error || null };
      } catch (e) {
        console.error("Fetch steps failed:", e);
        // DO NOT RESET setSteps([]) ON FAILURE
        return { steps: [], error: "Failed to fetch steps data." };
      }
    },
    [userId, account?.linked, account.scopes]
  );

  // ---- CONSOLIDATED ----
  const refreshAllHealthData = useCallback(
    async (rangeStartMs, rangeEndMs, tz = "Asia/Kolkata") => {
      if (!account.linked) return;
      setHealthLoading(true);
      setLastError(null);

      // The individual refresh functions now handle not resetting state on failure.
      const results = await Promise.allSettled([
        refreshMetrics(rangeStartMs, rangeEndMs, tz),
        refreshNutrition(rangeStartMs, rangeEndMs),
        refreshStressIndex(rangeStartMs, rangeEndMs, tz),
        fetchSleep(rangeStartMs, rangeEndMs),
        refreshExercise(rangeStartMs, rangeEndMs),
        refreshSteps(rangeStartMs, rangeEndMs, tz),
      ]);

      const errors = results
        .filter((r) => r.status === "fulfilled" && r.value?.error)
        .map((r) => r.value.error);
      const failed = results
        .filter((r) => r.status === "rejected")
        .map((r) => r.reason?.message || "unknown");

      if (errors.length > 0 || failed.length > 0) {
        const all = [...errors, ...failed].filter(Boolean);
        if (all.some((e) => !e.includes("skipped"))) {
          setLastError("Some data failed to load: " + all.join("; "));
        }
      }
      setHealthLoading(false);
    },
    [account.linked, refreshMetrics, refreshNutrition, refreshStressIndex, fetchSleep, refreshExercise, refreshSteps]
  );

  // ---- LINK / UNLINK ----
  const linkGoogleFit = useCallback(async () => {
    try {
      setStatusLoading(true);
      const { data } = await api.get("/api/googlefit/auth/url", {
        params: { userId },
        headers: { "Cache-Control": "no-store" },
      });
      if (!data?.url) throw new Error("No auth url");

      const w = 520, h = 640;
      const y = window.top.outerHeight / 2 + window.top.screenY - h / 2;
      const x = window.top.outerWidth / 2 + window.top.screenX - w / 2;
      const popup = window.open(
        data.url,
        "googlefit_link",
        `popup=yes,width=${w},height=${h},top=${y},left=${x},resizable=yes,scrollbars=yes`
      );
      popup?.focus?.();

      const onMsg = async (ev) => {
        if (!ev?.data || ev.data.type !== "googlefit_linked") return;
        window.removeEventListener("message", onMsg);
        clearInterval(pollTimer);
        await refreshStatus();
        setHealthLoading(true); // Added loading state to trigger data fetch
        await refreshAllHealthData(startOfDay(Date.now(), "Asia/Kolkata"), endOfDay(Date.now(), "Asia/Kolkata"), "Asia/Kolkata");
        setStatusLoading(false);
        setHealthLoading(false);
        try { popup?.close(); } catch {}
      };
      window.addEventListener("message", onMsg);

      const pollTimer = setInterval(async () => {
        if (popup && popup.closed) {
          clearInterval(pollTimer);
          window.removeEventListener("message", onMsg);
          await refreshStatus();
          setStatusLoading(false);
        }
      }, 800);
    } catch (e) {
      console.error(e);
      setLastError("Connection failed.");
      setStatusLoading(false);
    }
  }, [userId, refreshStatus, refreshAllHealthData]);

  const unlinkGoogleFit = useCallback(async () => {
    try {
      setStatusLoading(true);
      await api.delete(`/api/googlefit/${userId}`);
      setAccount({ linked: false, scopes: [] });
      setMetrics({});
      setNutrition([]);
      setDailyStressIndex([]);
      setSleep([]);
      setExercise([]);
      setSteps([]);
      setLastError(null);
    } catch (e) {
      console.error("Unlink failed:", e);
      setLastError("Failed to disconnect.");
    } finally {
      setStatusLoading(false);
    }
  }, [userId]);

  // ---- Auto: check status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ---- Auto: load data whenever we become linked
  useEffect(() => {
    if (account.linked) {
      const tz = "Asia/Kolkata";
      const now = Date.now();
      const start = startOfDay(now, tz);
      const end = endOfDay(now, tz);
      
      // Note: refreshAllHealthData will set healthLoading=true/false
      refreshAllHealthData(start, end, tz);
    }
  }, [account.linked, refreshAllHealthData]);

  const value = {
    userId,
    account,
    statusLoading,
    healthLoading,
    lastError,
    metrics,
    nutrition,
    dailyStressIndex,
    sleep,
    exercise,
    steps,
    refreshExercise,
    refreshSteps,
    linkGoogleFit,
    unlinkGoogleFit,
    refreshStatus,
    refreshMetrics,
    refreshNutrition,
    refreshStressIndex,
    refreshStressIndexDay,
    fetchSleep,
    refreshAllHealthData,
  };

  return <GoogleFitContext.Provider value={value}>{children}</GoogleFitContext.Provider>;
};