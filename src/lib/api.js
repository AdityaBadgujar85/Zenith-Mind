// src/lib/api.js
import axios from "axios";

export const API_BASE =
  process.env.REACT_APP_API_BASE ||
  (window.location.hostname === "localhost"
    ? "http://localhost:7000"
    : `${window.location.origin.replace(/:\d+$/, "")}:7000`);

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false, // keep false for header-based JWT
  headers: { "Cache-Control": "no-store" },
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("auth_token") ||
    sessionStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Optional: helps you see when the header would be missing
    // console.debug("[api] no auth token present for", config.method?.toUpperCase(), config.url);
  }
  return config;
});
