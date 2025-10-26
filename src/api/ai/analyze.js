// server/routes/ai.routes.js
import express from "express";
const router = express.Router();

router.post("/analyze", async (req, res) => {
  try {
    const { model = "gemini-1.5-pro", system = "", input } = req.body || {};

    // TODO: Replace this mock with a real Gemini call using your API key.
    // Return the shape { ok:true, json, text } so the UI can render both.
    return res.json({
      ok: true,
      json: {
        insights: [
          "Sleep often below 8h target; variability on weekdays.",
          "Stress categories cluster around 'Work' and 'Commute'.",
          "Mood dips follow short sleep and high-stress days.",
        ],
        recommendations: [
          "Fix a consistent sleep window (7.5–8h) for the next 7 days.",
          "5–10 min guided breathing after lunch daily.",
          "20 min light walk on 3 non-consecutive days.",
          "Limit caffeine after 2 PM; hydrate 2–3L/day.",
          "Nightly 3-item gratitude note to end the day.",
        ],
        riskFlags: input?.computed?.avgMood < 2.5 ? ["Low average mood — monitor closely."] : [],
        summary: "Improving sleep consistency and short daily mindfulness should lift baseline mood within 1–2 weeks.",
      },
      text: "AI: Patterns suggest mid-week fatigue driven by short sleep and work stress. Tighten your bedtime window and insert brief mindful resets.",
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "AI analysis error" });
  }
});

export default router;
