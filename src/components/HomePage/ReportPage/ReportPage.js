import React, { useContext, useMemo } from "react";
import { Container, Row, Col, Card, ProgressBar } from "react-bootstrap";
import { AppDataContext } from "../../../App";

// Utility: format milliseconds into HH:MM:SS
function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function ReportPage() {
  const { sleepData = [], stressData = {}, moodEntries = [] } = useContext(AppDataContext);

  // ===== Sleep Analysis =====
  const sleepStats = useMemo(() => {
    const totalMs = sleepData.reduce(
      (acc, s) => acc + (s.duration || (s.end && s.start ? s.end - s.start : 0)),
      0
    );

    const goalHours = 8;
    const percent = Math.min(100, Math.round((totalMs / (goalHours * 3600 * 1000)) * 100));

    const suggestion =
      percent < 75
        ? "Consider improving your sleep routine and try relaxation sounds."
        : "Sleep is on track! Keep it consistent.";

    return { totalMs, goalHours, percent, suggestion };
  }, [sleepData]);

  // ===== Stress Analysis =====
  const stressStats = useMemo(() => {
    const categories = {};
    Object.values(stressData || {}).forEach((day) => {
      if (day && Array.isArray(day.stress)) {
        day.stress.forEach((s) => {
          if (s && s.category) {
            categories[s.category] = (categories[s.category] || 0) + 1;
          }
        });
      }
    });

    const highStressCategories = Object.entries(categories)
      .filter(([_, count]) => count > 2)
      .map(([name, count]) => ({ name, count }));

    const suggestion =
      highStressCategories.length > 0
        ? `Focus on stress management for: ${highStressCategories
            .map((c) => c.name)
            .join(", ")}. Try meditation or mental exercises.`
        : "Stress levels are low or data insufficient. Keep practicing healthy habits.";

    return { categories, highStressCategories, suggestion };
  }, [stressData]);

  // ===== Mood Analysis =====
  const moodStats = useMemo(() => {
    const validMoods = moodEntries.filter((e) => typeof e.mood === "number");
    const avgMood = validMoods.length
      ? validMoods.reduce((acc, e) => acc + e.mood, 0) / validMoods.length
      : 0;

    const suggestion =
      avgMood < 3
        ? "Consider daily motivation videos and chatbot guidance to uplift your mood."
        : "Mood is stable. Challenge yourself with mental exercises and games.";

    return { avgMood, suggestion };
  }, [moodEntries]);

  // ===== Recommendations =====
  const recommendedGames = [];
  if (sleepStats.percent < 75 || moodStats.avgMood < 3)
    recommendedGames.push("Relaxation Sounds & Meditation Videos");
  if (stressStats.highStressCategories.length > 0)
    recommendedGames.push("Memory Game, Math Puzzle Game, Sequence Tap");
  if (moodStats.avgMood >= 4)
    recommendedGames.push("Scramble Words Game, Mental Exercise Videos");

  return (
    <Container className="py-4" style={{ marginTop: "5rem" }}>
      <h2 className="mb-4">Your Mental Wellness Report</h2>

      <Row className="mb-4">
        {/* Sleep */}
        <Col md={4}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Sleep Analysis</Card.Title>
              <ProgressBar now={sleepStats.percent} label={`${sleepStats.percent}%`} className="mb-2" />
              <p>Total Sleep: {formatDuration(sleepStats.totalMs)}</p>
              <p>{sleepStats.suggestion}</p>
            </Card.Body>
          </Card>
        </Col>

        {/* Stress */}
        <Col md={4}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Stress Analysis</Card.Title>
              {stressStats.highStressCategories.length > 0 ? (
                <ul>
                  {stressStats.highStressCategories.map((c) => (
                    <li key={c.name}>
                      {c.name} ({c.count})
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Stress is well managed!</p>
              )}
              <p>{stressStats.suggestion}</p>
            </Card.Body>
          </Card>
        </Col>

        {/* Mood */}
        <Col md={4}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Mood Analysis</Card.Title>
              <p>Average Mood: {moodStats.avgMood.toFixed(1)} / 5</p>
              <p>{moodStats.suggestion}</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recommendations */}
      <Card>
        <Card.Body>
          <Card.Title>Recommended Actions & Games</Card.Title>
          {recommendedGames.length > 0 ? (
            <ul>
              {recommendedGames.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          ) : (
            <p>Keep up your current habits! No immediate action needed.</p>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
