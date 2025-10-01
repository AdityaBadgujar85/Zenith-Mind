// StressHabitTracker.jsx
import React, { useState, useEffect, useContext } from "react";
import { Container, Row, Col, Button, Form, Badge } from "react-bootstrap";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Trash2, CheckCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { AppDataContext } from "../../../App"; // shared context

const STRESS_CATEGORIES = ["Work", "Health", "Family", "Finance", "Other"];
const CATEGORY_COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];

const STRESS_HABITS = {
  Work: ["Take a short walk", "Practice deep breathing", "Organize your tasks"],
  Health: ["Meditate for 5 minutes", "Drink water", "Do some stretching"],
  Family: ["Call a loved one", "Spend quality time", "Write a gratitude note"],
  Finance: ["Review budget", "List financial goals", "Track expenses"],
  Other: ["Listen to music", "Read a book", "Take a short break"],
};

export default function StressHabitTracker() {
  const { stressData, setStressData } = useContext(AppDataContext);

  const [theme, setTheme] = useState("light");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const [data, setData] = useState(stressData || {});

  const [stressInput, setStressInput] = useState("");
  const [stressIntensity, setStressIntensity] = useState(5);
  const [stressCategory, setStressCategory] = useState(STRESS_CATEGORIES[0]);

  // Theme effect
  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  // Sync data to context
  useEffect(() => {
    setStressData(data);
  }, [data, setStressData]);

  const currentDay = data[selectedDate] || { stress: [], habits: [] };

  function addStress() {
    if (!stressInput) return;

    const newStress = [
      ...currentDay.stress,
      { text: stressInput, intensity: stressIntensity, category: stressCategory },
    ];

    const suggestedHabits = STRESS_HABITS[stressCategory].map((text) => ({
      text,
      done: false,
      streak: 0,
    }));

    const mergedHabits = [...currentDay.habits];
    suggestedHabits.forEach((h) => {
      if (!mergedHabits.some((mh) => mh.text === h.text)) mergedHabits.push(h);
    });

    const newDay = { stress: newStress, habits: mergedHabits };
    setData({ ...data, [selectedDate]: newDay });

    setStressInput("");
    setStressIntensity(5);
    setStressCategory(STRESS_CATEGORIES[0]);
  }

  function removeStress(index) {
    const newStress = [...currentDay.stress];
    newStress.splice(index, 1);
    const newDay = { ...currentDay, stress: newStress };
    setData({ ...data, [selectedDate]: newDay });
  }

  function toggleHabit(index) {
    const newHabits = [...currentDay.habits];
    newHabits[index].done = !newHabits[index].done;

    if (newHabits[index].done) {
      newHabits[index].streak = (newHabits[index].streak || 0) + 1;
    } else {
      newHabits[index].streak = Math.max(0, (newHabits[index].streak || 1) - 1);
    }

    const newDay = { ...currentDay, habits: newHabits };
    setData({ ...data, [selectedDate]: newDay });
  }

  const weekDates = Object.keys(data).slice(-7);
  const weeklyStats = weekDates.map((date) => {
    const day = data[date];
    return {
      date,
      habitsDone: day?.habits.filter((h) => h.done).length || 0,
      habitsTotal: day?.habits.length || 0,
      stressAvg: day?.stress.length
        ? Math.round(day.stress.reduce((sum, s) => sum + s.intensity, 0) / day.stress.length)
        : 0,
    };
  });

  const categoryCounts = STRESS_CATEGORIES.map((cat) =>
    currentDay.stress.filter((s) => s.category === cat).length
  );

  return (
    <Container fluid className="py-4 min-vh-100" style={{ background: theme === "dark" ? "#121212" : "#f9f9f9" }}>
      {/* Header */}
      <Row className="justify-content-center mb-4">
        <Col md={8} className="d-flex justify-content-between align-items-center">
          <h2 style={{ color: theme === "dark" ? "#fff" : "#333" }}>Stress & Habit Tracker ⏱️</h2>
          <Button variant={theme === "dark" ? "light" : "dark"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </Col>
      </Row>

      {/* Date Picker */}
      <Row className="justify-content-center mb-4">
        <Col md={4}>
          <Form.Control type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </Col>
      </Row>

      {/* Stress & Habits */}
      <Row className="justify-content-center mb-5">
        <Col md={5} className="mb-4">
          <h5 style={{ color: theme === "dark" ? "#fff" : "#333" }}>Stress Triggers</h5>
          <div className="mb-2 d-flex gap-2 flex-wrap">
            <Form.Control
              type="text"
              placeholder="Add stress trigger..."
              value={stressInput}
              onChange={(e) => setStressInput(e.target.value)}
            />
            <Form.Control
              type="number"
              min="1"
              max="10"
              value={stressIntensity}
              onChange={(e) => setStressIntensity(Number(e.target.value))}
              style={{ width: 70 }}
            />
            <Form.Select value={stressCategory} onChange={(e) => setStressCategory(e.target.value)} style={{ width: 120 }}>
              {STRESS_CATEGORIES.map((cat, i) => (
                <option key={i} value={cat}>{cat}</option>
              ))}
            </Form.Select>
            <Button onClick={addStress}>Add</Button>
          </div>
          <ul className="list-unstyled">
            <AnimatePresence>
              {currentDay.stress.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="d-flex justify-content-between align-items-center mb-2 p-2 rounded"
                  style={{ background: theme === "dark" ? "#1e1e1e" : "#fff" }}
                >
                  <span>
                    {s.text} <Badge bg="danger">{s.intensity}</Badge> <Badge bg="secondary">{s.category}</Badge>
                  </span>
                  <Button variant="outline-danger" size="sm" onClick={() => removeStress(i)}>
                    <Trash2 size={16} />
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Col>

        <Col md={5} className="mb-4">
          <h5 style={{ color: theme === "dark" ? "#fff" : "#333" }}>Suggested Habits</h5>
          <ul className="list-unstyled">
            <AnimatePresence>
              {currentDay.habits.map((h, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="d-flex justify-content-between align-items-center mb-2 p-2 rounded"
                  style={{ background: theme === "dark" ? "#1e1e1e" : "#fff" }}
                >
                  <span>{h.text} <Badge bg="success">Streak: {h.streak}</Badge></span>
                  <Button
                    variant={h.done ? "success" : "outline-secondary"}
                    size="sm"
                    onClick={() => toggleHabit(i)}
                  >
                    {h.done ? <CheckCircle size={16} /> : "Mark"}
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </Col>
      </Row>

      {/* Analytics */}
      <Row className="justify-content-center mb-5">
        <Col md={6} className="mb-4">
          <h5 style={{ color: theme === "dark" ? "#fff" : "#333" }}>Weekly Analytics</h5>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weeklyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#444" : "#ccc"} />
              <XAxis dataKey="date" stroke={theme === "dark" ? "#fff" : "#333"} />
              <YAxis stroke={theme === "dark" ? "#fff" : "#333"} />
              <Tooltip />
              <Line type="monotone" dataKey="habitsDone" stroke="#6366F1" name="Habits Done" />
              <Line type="monotone" dataKey="stressAvg" stroke="#EF4444" name="Stress Avg" />
            </LineChart>
          </ResponsiveContainer>
        </Col>

        <Col md={4} className="mb-4">
          <h5 style={{ color: theme === "dark" ? "#fff" : "#333" }}>Stress Categories</h5>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={STRESS_CATEGORIES.map((cat, i) => ({ name: cat, value: categoryCounts[i] }))}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
                label
              >
                {CATEGORY_COLORS.map((color, i) => (
                  <Cell key={i} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Col>
      </Row>
    </Container>
  );
}
