import React, { useState, useEffect, useRef } from "react";
import {
  Button, Card, Form, Container, Row, Col, Alert, Dropdown, DropdownButton, Table, Modal, Badge,
} from "react-bootstrap";
import { QuickMathAPI } from "../../../api/quickmath.api";
import classes from "./QuickMathBlitz.module.css";

const NAME_KEY = "qm_player_name";

function QuickMathBlitz() {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [operator, setOperator] = useState("+");
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(10);
  const [difficulty, setDifficulty] = useState("Easy");

  // Leaderboard UI
  const [leaderboard, setLeaderboard] = useState([]);
  const [showSave, setShowSave] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [saveState, setSaveState] = useState({ saved: false, rank: -1 });

  // Timer
  const timerRef = useRef(null);

  /* ---------- Problem generation ---------- */
  function generateProblem() {
    let maxNum = 20;
    let ops = ["+", "-"];
    if (difficulty === "Medium") {
      maxNum = 50; ops = ["+", "-", "*"];
    } else if (difficulty === "Hard") {
      maxNum = 100; ops = ["+", "-", "*"];
    }

    const a = Math.floor(Math.random() * maxNum) + 1;
    const b = Math.floor(Math.random() * maxNum) + 1;
    const op = ops[Math.floor(Math.random() * ops.length)];

    setNum1(a);
    setNum2(b);
    setOperator(op);
    setAnswer("");
    setFeedback("");
  }

  function correctValue() {
    if (operator === "+") return num1 + num2;
    if (operator === "-") return num1 - num2;
    return num1 * num2;
  }

  /* ---------- Effects ---------- */
  // New problem on difficulty change
  useEffect(() => {
    generateProblem();
  }, [difficulty]);

  // Load leaderboard once
  useEffect(() => {
    (async () => {
      try {
        const items = await QuickMathAPI.getLeaderboard(10);
        setLeaderboard(items);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Centralized timer control
  useEffect(() => {
    // If modal is open, pause timer
    if (showSave) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    // Start/resume timer
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [showSave]);

  // Handle time running out (but not while modal is open)
  useEffect(() => {
    if (showSave) return; // paused
    if (timeLeft <= 0) {
      setFeedback("Time's up! Streak reset.");
      setStreak(0);
      setTimeLeft(10);
      generateProblem();
    }
  }, [timeLeft, showSave]);

  /* ---------- Handlers ---------- */
  function checkAnswer(e) {
    e.preventDefault();
    const correct = correctValue();

    if (Number(answer) === correct) {
      const newStreak = streak + 1;
      setScore((s) => s + 10);
      setStreak(newStreak);
      setBestStreak((bs) => Math.max(bs, newStreak));
      setFeedback("Correct! 🎉");
      setTimeLeft((t) => Math.max(5, 10 - Math.floor(newStreak / 3))); // speeds up
      generateProblem();
    } else {
      setFeedback(`Wrong! Correct answer was ${correct}`);
      setStreak(0);
      setTimeLeft(10);
      generateProblem();
    }
  }

  const openSave = () => {
    if (score <= 0) return;
    setSaveState({ saved: false, rank: -1 });
    setShowSave(true); // ⏸️ timer pauses via effect
  };

  const doSave = async () => {
    const name = (playerName || "").trim() || "Player";
    localStorage.setItem(NAME_KEY, name);
    try {
      const { rank } = await QuickMathAPI.submitScore({ name, score, bestStreak });
      setSaveState({ saved: true, rank });
      // refresh LB
      const items = await QuickMathAPI.getLeaderboard(10);
      setLeaderboard(items);
    } catch {
      setSaveState({ saved: true, rank: -1 });
    }
  };

  const closeSave = () => {
    setShowSave(false); // ▶️ timer resumes via effect
  };

  return (
    <Container className={classes.container} fluid>
      <div className={classes.headerBar}>
        <h2 className="mb-0">🧮 Quick Math Blitz</h2>
        <div className={classes.badgeRow}>
          <Badge bg="success">Score: {score}</Badge>
          <Badge bg="warning" text="dark">Streak: {streak}</Badge>
          <Badge bg="secondary">Best: {bestStreak}</Badge>
          <Badge bg={timeLeft <= 3 ? "danger" : "info"} text={timeLeft <= 3 ? "light" : "dark"}>
            Time: {timeLeft}s
          </Badge>
        </div>
      </div>

      <Row className="align-items-center g-2 mb-3">
        <Col xs="auto">
          <DropdownButton
            id="difficulty"
            title={`Difficulty: ${difficulty}`}
            onSelect={(k) => setDifficulty(k)}
            variant="dark"
          >
            <Dropdown.Item eventKey="Easy">Easy</Dropdown.Item>
            <Dropdown.Item eventKey="Medium">Medium</Dropdown.Item>
            <Dropdown.Item eventKey="Hard">Hard</Dropdown.Item>
          </DropdownButton>
        </Col>
        <Col xs="auto">
          <Button variant="outline-primary" onClick={openSave} disabled={score <= 0}>
            Save to Leaderboard
          </Button>
        </Col>
      </Row>

      <Card className={classes.card}>
        <h3 className={classes.problem}>
          {num1} {operator} {num2} = ?
        </h3>
        <Form onSubmit={checkAnswer} className="d-flex flex-column gap-3">
          <Form.Control
            type="number"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Enter your answer"
            autoFocus
            className={classes.input}
            disabled={showSave}
          />
          <div className="d-flex gap-2 justify-content-center">
            <Button variant="dark" type="submit" disabled={showSave}>Submit</Button>
            <Button variant="outline-secondary" onClick={generateProblem} disabled={showSave}>Skip</Button>
          </div>
        </Form>
        {feedback && <Alert className={`${classes.alert} mt-3 mb-0`}>{feedback}</Alert>}
      </Card>

      {/* Leaderboard */}
      <Card className={`${classes.card} mt-3`}>
        <div className={classes.lbHeader}>
          <h5 className="mb-0">🏆 Leaderboard (Top 10)</h5>
          <Button
            size="sm"
            variant="outline-primary"
            onClick={async () => {
              try {
                const items = await QuickMathAPI.getLeaderboard(10);
                setLeaderboard(items);
              } catch {}
            }}
          >
            Refresh
          </Button>
        </div>

        <div className="mt-3">
          {leaderboard.length === 0 ? (
            <div className="text-muted">No scores yet. Be the first!</div>
          ) : (
            <Table striped bordered hover size="sm" responsive className={`${classes.table} mb-0`}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Score</th>
                  <th>Best Streak</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, idx) => (
                  <tr key={`${row._id}-${idx}`}>
                    <td>{idx + 1}</td>
                    <td>{row.name}</td>
                    <td>{row.score}</td>
                    <td>{row.bestStreak}</td>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {/* Save modal (timer is paused while open) */}
      <Modal show={showSave} onHide={closeSave} centered>
        <Modal.Header closeButton>
          <Modal.Title>Save to Leaderboard</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {saveState.saved ? (
            <Alert variant="success" className="mb-0">
              Saved! {saveState.rank > 0 ? `Your rank: #${saveState.rank}` : ""}
            </Alert>
          ) : (
            <>
              <p className="text-muted">
                You’re saving <strong>Score: {score}</strong> (Best Streak: {bestStreak})
              </p>
              <Form.Group>
                <Form.Label>Player Name</Form.Label>
                <Form.Control
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={32}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {!saveState.saved ? (
            <>
              <Button variant="secondary" onClick={closeSave}>Cancel</Button>
              <Button variant="primary" onClick={doSave} disabled={score <= 0}>Save</Button>
            </>
          ) : (
            <Button variant="primary" onClick={closeSave}>Done</Button>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default QuickMathBlitz;
