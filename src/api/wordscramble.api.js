import { api } from "../lib/api";

export const WordScrambleAPI = {
  async getLeaderboard(limit = 10) {
    const { data } = await api.get("/api/wordscramble/leaderboard", { params: { limit } });
    return data?.data || [];
  },
  async submitScore({ score, bestStreak, name }) {
    const { data } = await api.post("/api/wordscramble/score", { score, bestStreak, name });
    return { saved: Boolean(data?.ok), rank: data?.rank ?? -1, item: data?.data || null };
  },
  async getMyHistory() {
    const { data } = await api.get("/api/wordscramble/me/history");
    return data?.data || [];
  },
};
