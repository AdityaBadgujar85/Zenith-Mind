import { api } from "../lib/api"; // your axios instance

export const QuickMathAPI = {
  async getLeaderboard(limit = 10) {
    const { data } = await api.get("/api/quickmath/leaderboard", { params: { limit } });
    return data?.data || [];
  },
  async submitScore({ name, score, bestStreak }) {
    const { data } = await api.post("/api/quickmath/score", { name, score, bestStreak });
    return { ok: !!data?.ok, rank: data?.rank ?? -1 };
  },
};
