// src/api/GoogleFitAPI.js
const API_BASE = "http://localhost:7000";

export const getToken = () => localStorage.getItem("auth_token");

export const fetchGoogleFitSleep = async (userId) => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/googlefit`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("OAuth required");
    }
    throw new Error("Failed to fetch Google Fit sleep data");
  }

  return res.json();
};

export const syncGoogleFitSleep = async (userId) => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/googlefit/sync/${userId}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("OAuth required");
    }
    throw new Error("Failed to sync Google Fit sleep data");
  }

  return res.json();
};
