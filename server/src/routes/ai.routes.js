// server/src/routes/ai.routes.js
import express from "express";

const router = express.Router();

// ───────────────── helpers ─────────────────
const isFiniteNum = (v) => Number.isFinite(Number(v));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const JSON_SCHEMA = {
  type: "object",
  properties: {
    insights: { type: "array", items: { type: "string" }, maxItems: 8 },
    recommendations: { type: "array", items: { type: "string" }, maxItems: 7 },
    riskFlags: { type: "array", items: { type: "string" }, maxItems: 6 },
    summary: { type: "string" },
  },
  required: ["insights", "recommendations", "riskFlags", "summary"],
  additionalProperties: false,
};

function summarizeCounts(input = {}) {
  const sleepRows = input?.sleep?.rows ?? [];
  const stressDays = Object.keys(input?.stress || {}).length;
  const moodPts = Array.isArray(input?.mood?.series) ? input.mood.series.filter(x => isFiniteNum(x?.mood)).length : 0;
  return `Data summary — sleep rows: ${sleepRows.length}, stress days: ${stressDays}, mood points: ${moodPts}.`;
}
function buildJSONPrompt(input = {}) {
  const parts = [];
  parts.push(`User timezone: ${input?.timeframe?.tz || "UTC"}`);
  parts.push(`Time range: ${input?.timeframe?.start || "?"} → ${input?.timeframe?.end || "?"}`);
  if (input?.user?.googleFitLinked) parts.push(`Google Fit linked as: ${input?.user?.accountName || "linked account"}`);
  const sleepRows = (input?.sleep?.rows || []).slice(0, 200).map(s => ({
    start: s.start, end: s.end, durationMs: s.durationMs, quality: s.quality, src: s.source || s.soundId || null
  }));
  parts.push(`Sleep rows (trimmed): ${JSON.stringify(sleepRows)}`);
  const stressObj = input?.stress || {};
  const stressTrimmed = {};
  Object.entries(stressObj).slice(-45).forEach(([d, v]) => {
    stressTrimmed[d] = { stress: (v?.stress || []).slice(0, 30).map(s => ({
      category: s.category, level: isFiniteNum(s.level) ? clamp(Number(s.level), 1, 10) : undefined
    }))};
  });
  parts.push(`Stress (trimmed): ${JSON.stringify(stressTrimmed)}`);
  const moodSeries = (input?.mood?.series || []).slice(-45);
  parts.push(`Mood series (1–5, trimmed): ${JSON.stringify(moodSeries)}`);
  parts.push(`Mood stats(avg,last7,best,worst): ${JSON.stringify({
    avg: input?.mood?.avg, last7Avg: input?.mood?.last7Avg, best: input?.mood?.best, worst: input?.mood?.worst
  })}`);
  const act = input?.activity || {};
  const stepsComp = Object.fromEntries(Object.entries(act?.stepsByDay || {}).slice(-45));
  const sessionsComp = (act?.sessions || []).slice(-60);
  parts.push(`Activity stepsByDay (trimmed): ${JSON.stringify(stepsComp)}`);
  parts.push(`Activity sessions (trimmed): ${JSON.stringify(sessionsComp)}`);
  parts.push(`Activity totals: ${JSON.stringify(act?.totals || {})}`);
  parts.push(`Computed: ${JSON.stringify(input?.computed || {})}`);
  const goals = input?.ask?.goals || [
    "Summarize sleep, stress, mood, and activity patterns succinctly.",
    "Highlight the top issues blocking mental wellness.",
    "Give 5 actionable, personalized recommendations (1 week plan).",
    "Return JSON fields: insights[], recommendations[], riskFlags[], summary."
  ];
  parts.push(`Goals: ${JSON.stringify(goals)}`);
  parts.push("Be specific, practical, evidence-informed, and mention limitations if data is sparse.");
  parts.push("Prefer short, clear bullets. Avoid medical diagnosis; suggest generic wellness actions.");
  return parts.join("\n");
}
function buildNarrativePrompt(input = {}) {
  return [
    "Write a concise narrative (120–180 words) in a supportive tone summarizing the user's last 30 days.",
    "Connect patterns across sleep, stress, mood, and activity; suggest a weekly rhythm (no numbered JSON).",
    summarizeCounts(input),
    "End with a one-sentence encouragement."
  ].join("\n");
}

async function tryLoadSDK() {
  try {
    // dynamic import so server doesn’t crash if package missing
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  } catch {
    return null; // fall back to REST
  }
}

async function geminiJSON_viaSDK(genAI, model, system, input) {
  const m = genAI.getGenerativeModel({
    model,
    systemInstruction:
      (system || "You are a compassionate mental-wellness analyst. Be specific, practical, and evidence-informed. If data is sparse, state limitations briefly.")
      + " Avoid medical diagnoses; focus on general wellness."
  });
  const r = await m.generateContent({
    contents: [{ role: "user", parts: [{ text: buildJSONPrompt(input) }]}],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: JSON_SCHEMA,
      temperature: 0.6,
    },
  });
  return r?.response?.text?.() ?? "";
}
async function geminiText_viaSDK(genAI, model, system, input) {
  const m = genAI.getGenerativeModel({
    model,
    systemInstruction: (system || "You are a compassionate mental-wellness analyst.") + " Write in warm, encouraging, plain language.",
  });
  const r = await m.generateContent({
    contents: [{ role: "user", parts: [{ text: buildNarrativePrompt(input) }]}],
    generationConfig: { temperature: 0.7 },
  });
  return r?.response?.text?.() ?? "";
}

async function geminiJSON_viaREST(model, system, input) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: buildJSONPrompt(input) }]}],
    systemInstruction: {
      role: "system",
      parts: [{ text: (system || "You are a compassionate mental-wellness analyst. Be specific, practical, and evidence-informed. If data is sparse, state limitations briefly.") + " Avoid medical diagnoses; focus on general wellness." }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: JSON_SCHEMA,
      temperature: 0.6,
    },
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  // response.candidates[0].content.parts[0].text
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text;
}
async function geminiText_viaREST(model, system, input) {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: buildNarrativePrompt(input) }]}],
    systemInstruction: {
      role: "system",
      parts: [{ text: (system || "You are a compassionate mental-wellness analyst.") + " Write in warm, encouraging, plain language." }]
    },
    generationConfig: { temperature: 0.7 },
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text;
}

// ───────────────── route ─────────────────
router.post("/analyze", async (req, res) => {
  const { model = "gemini-1.5-pro", system = "", input } = req.body || {};
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");

    const genAI = await tryLoadSDK();

    // JSON (structured)
    let jsonText;
    if (genAI) jsonText = await geminiJSON_viaSDK(genAI, model, system, input);
    else jsonText = await geminiJSON_viaREST(model, system, input);

    // Parse or extract JSON
    let parsed;
    try {
      parsed = jsonText ? JSON.parse(jsonText) : null;
    } catch {
      const start = jsonText.indexOf("{");
      const end = jsonText.lastIndexOf("}");
      if (start >= 0 && end > start) parsed = JSON.parse(jsonText.slice(start, end + 1));
    }

    // Narrative
    const narrative = genAI
      ? await geminiText_viaSDK(genAI, model, system, input)
      : await geminiText_viaREST(model, system, input);

    const safeJson = parsed || {
      insights: [
        "Sleep shows variability vs 8h target.",
        "Stress clusters around recurring categories on busy days.",
        "Mood correlates with short sleep and higher stress.",
      ],
      recommendations: [
        "Fix a consistent 7.5–8h sleep window this week.",
        "Insert a 5–8 min breathing break after lunch daily.",
        "Take three 20-min light walks on non-consecutive days.",
        "Hydrate 2–3L/day; limit caffeine after 2 PM.",
        "Do nightly 3-item gratitude reflection.",
      ],
      riskFlags: (input?.computed?.avgMood < 2.5) ? ["Low average mood — monitor trends and seek support if it persists."] : [],
      summary: "Tightening sleep consistency and adding brief daily recovery should raise baseline mood within 1–2 weeks.",
    };

    return res.json({ ok: true, json: safeJson, text: narrative });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: e?.message || "AI analysis error",
      json: {
        insights: [
          "Sleep often below 8h target; variability on weekdays.",
          "Stress categories cluster around frequent triggers.",
          "Mood dips follow short sleep and high-stress days.",
        ],
        recommendations: [
          "Keep a fixed sleep window (7.5–8h) for 7 days.",
          "5–10 min guided breathing after lunch daily.",
          "20 min light walk on 3 non-consecutive days.",
          "Limit caffeine after 2 PM; hydrate 2–3L/day.",
          "Nightly 3-item gratitude note.",
        ],
        riskFlags: [],
        summary: "Improving sleep consistency and micro-recovery breaks should lift baseline mood within 1–2 weeks.",
      },
      text: "AI fallback: Patterns suggest mid-week fatigue driven by short sleep and stress. Tighten bedtime and add brief mindful resets.",
    });
  }
});

export default router;
