// src/api/stress.api.js
import { api } from "../lib/api"; // ← reuse the shared, authed axios instance

export const StressAPI = {
  async upsertDay({ date, manual, gf }) {
    const { data } = await api.post("/api/stress", { date, manual, gf });
    return data?.data;
  },
  async getDay(date) {
    const { data } = await api.get(`/api/stress/${encodeURIComponent(date)}`);
    return data?.data;
  },
  async listRange(start, end) {
    const { data } = await api.get("/api/stress", { params: { start, end } });
    return data?.data || [];
  },
  async removeDay(date) {
    const { data } = await api.delete(`/api/stress/${encodeURIComponent(date)}`);
    return data?.ok;
  },
};

export default StressAPI;
