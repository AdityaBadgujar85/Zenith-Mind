import React, { useState, useEffect } from "react";
import {
  Button,
  Card,
  Form,
  Alert,
  Spinner,
  Badge,
  Container,
  Modal,
  Table,
} from "react-bootstrap";
import classes from "./WordScramble.module.css";

const RANDOM_API = "https://random-word-api.vercel.app/api";
const DICT_API = "https://api.dictionaryapi.dev/api/v2/entries/en";

// ====== SERVER LB endpoints ======
const API_BASE =
  process.env.REACT_APP_API_BASE ||
  process.env.VITE_API_BASE ||
  (window.location.hostname === "localhost"
    ? "http://localhost:7000"
    : `${window.location.origin.replace(/:\d+$/, "")}:7000`);

const LB_GET_URL = `${API_BASE}/api/wordscramble/leaderboard?limit=10`;
const LB_POST_URL = `${API_BASE}/api/wordscramble/score`;

/* ------------------------ Helpers ------------------------ */
function scrambleWord(str) {
  if (!str || str.length < 2) return str;
  let arr = str.split("");
  let shuffled = str;
  for (let attempt = 0; attempt < 10 && shuffled === str; attempt++) {
    arr = str.split("");
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    shuffled = arr.join("");
  }
  return shuffled;
}

async function getRandomWord() {
  try {
    const response = await fetch(`${RANDOM_API}?words=1`);
    const data = await response.json();
    return data[0];
  } catch (error) {
    console.error("Error fetching random word:", error);
    return null;
  }
}

async function getWordMeaning(word) {
  try {
    const res = await fetch(`${DICT_API}/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : null;
    const meanings = entry?.meanings || [];
    for (const m of meanings) {
      const defs = m?.definitions || [];
      if (defs.length && defs[0]?.definition) return defs[0].definition;
    }
    return null;
  } catch {
    return null;
  }
}

function buildRevealPattern(word) {
  if (!word) return "";
  const letters = [...word];
  const isAlpha = (ch) => /[a-z]/i.test(ch);

  const alphaIdx = letters
    .map((ch, i) => (isAlpha(ch) ? i : -1))
    .filter((i) => i >= 0);

  if (alphaIdx.length === 0) return word;

  const reveal = new Set();
  reveal.add(alphaIdx[0]);
  reveal.add(alphaIdx[alphaIdx.length - 1]);

  const remaining = alphaIdx.slice(1, -1);
  const toReveal = Math.max(1, Math.floor(remaining.length * 0.4));
  for (let r = 0; r < toReveal && remaining.length > 0; r++) {
    const j = Math.floor(Math.random() * remaining.length);
    reveal.add(remaining[j]);
    remaining.splice(j, 1);
  }

  return letters
    .map((ch, i) => (!/[a-z]/i.test(ch) ? ch : reveal.has(i) ? ch : "_"))
    .join("");
}

/* -------------------- Local fallback LB -------------------- */
const LB_KEY = "ws_leaderboard";
const NAME_KEY = "ws_player_name";
const MAX_ENTRIES = 10;

function loadLocalLB() {
  try {
    const raw = localStorage.getItem(LB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveLocalLB(list) {
  try {
    localStorage.setItem(LB_KEY, JSON.stringify(list));
  } catch {}
}
function recordLocal({ name, score, streak }) {
  const entry = {
    name: name?.trim() || "Player",
    score: Number(score) || 0,
    bestStreak: Number(streak) || 0,
    at: new Date().toISOString(),
  };
  const list = loadLocalLB();
  list.push(entry);
  list.sort(
    (a, b) =>
      b.score - a.score ||
      b.bestStreak - a.bestStreak ||
      new Date(b.at) - new Date(a.at)
  );
  const trimmed = list.slice(0, MAX_ENTRIES);
  saveLocalLB(trimmed);
  const rank = trimmed.findIndex((e) => e === entry) + 1 || -1;
  return { list: trimmed, rank };
}

/* -------------------- Server LB utils -------------------- */
function authHeaders() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchServerLeaderboard() {
  const r = await fetch(LB_GET_URL, {
    headers: { "Cache-Control": "no-store", ...authHeaders() },
    credentials: "include",
  });
  if (!r.ok) throw new Error("LB fetch failed");
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "LB error");
  return j.data || [];
}

async function submitServerScore({ name, score, bestStreak }) {
  const r = await fetch(LB_POST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
    body: JSON.stringify({ name, score, bestStreak }),
  });
  if (r.status === 401) throw new Error("unauth");
  if (!r.ok) throw new Error("submit failed");
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "submit error");
  return { rank: j.rank || -1 };
}

/* ========================================================== */

function WordScramble() {
  const [scrambled, setScrambled] = useState("");
  const [correctWord, setCorrectWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [partialReveal, setPartialReveal] = useState("");

  const [hint, setHint] = useState("");
  const [guess, setGuess] = useState("");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [roundOver, setRoundOver] = useState(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbSource, setLbSource] = useState("server"); // "server" | "local"
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem(NAME_KEY) || ""
  );
  const [saveResult, setSaveResult] = useState({ saved: false, rank: -1 });
  const [lbError, setLbError] = useState("");

  const loadNewWord = async () => {
    setLoading(true);
    setHint("");
    setGuess("");
    setWrongAttempts(0);
    setPartialReveal("");
    setDefinition("");
    setRoundOver(false);

    const word = await getRandomWord();
    if (word) {
      const scrambledWord = scrambleWord(word);
      setCorrectWord(word);
      setScrambled(scrambledWord);

      const def = await getWordMeaning(word);
      setDefinition(def || "(Meaning not found)");
    } else {
      setScrambled("Error loading word");
      setDefinition("");
    }
    setLoading(false);
  };

  // Load leaderboard (server first, fallback to local)
  useEffect(() => {
    (async () => {
      try {
        const items = await fetchServerLeaderboard();
        setLeaderboard(items);
        setLbSource("server");
        setLbError("");
      } catch (e) {
        const local = loadLocalLB();
        setLeaderboard(local);
        setLbSource("local");
        setLbError("Using local leaderboard (not signed in or server unreachable).");
      }
    })();
    loadNewWord();
  }, []);

  const awardPoints = (attempts) => {
    if (attempts === 0) return 10;
    if (attempts === 1) return 7;
    if (attempts === 2) return 5;
    return 0;
  };

  const checkGuess = () => {
    if (roundOver) return;

    if (!guess.trim()) {
      setHint("⚠️ Please enter your guess.");
      return;
    }

    if (guess.toLowerCase() === correctWord.toLowerCase()) {
      const points = awardPoints(wrongAttempts);
      const streakBonus = streak >= 3 ? 5 : 0;
      setScore((prev) => prev + points + streakBonus);
      setStreak((prev) => prev + 1);
      setHint(
        `✅ Correct! +${points}${
          streakBonus ? ` (Streak bonus +${streakBonus})` : ""
        } points.`
      );
      setRoundOver(true);
      return;
    }

    const next = wrongAttempts + 1;
    setWrongAttempts(next);

    if (next === 1) {
      setHint(`💡 Meaning: ${definition || "(Meaning not found)"}`);
    } else if (next === 2) {
      const pattern = buildRevealPattern(correctWord);
      setPartialReveal(pattern);
      setHint(`🧩 Reveal: ${pattern}`);
    } else {
      setHint(`❌ The word was: ${correctWord}. Press "Next" to continue.`);
      setStreak(0);
      setRoundOver(true);
    }
  };

  const submitDisabled = loading || roundOver || !scrambled;

  /* ---------------- Leaderboard actions ---------------- */
  const openSave = () => {
    if (score <= 0) return;
    setSaveResult({ saved: false, rank: -1 });
    setShowSaveModal(true);
  };

  const refreshServerLB = async () => {
    try {
      const items = await fetchServerLeaderboard();
      setLeaderboard(items);
      setLbSource("server");
      setLbError("");
    } catch {
      setLbError(
        "Couldn’t load server leaderboard. (Not signed in or network issue.)"
      );
    }
  };

  const handleSaveScore = async () => {
    const nameToSave = playerName.trim() || "Player";
    localStorage.setItem(NAME_KEY, nameToSave);

    // Try server first if token exists
    const hasToken = Boolean(localStorage.getItem("auth_token"));
    if (hasToken) {
      try {
        const { rank } = await submitServerScore({
          name: nameToSave,
          score,
          bestStreak: streak,
        });
        setSaveResult({ saved: true, rank });
        await refreshServerLB();
        return;
      } catch {
        setLbSource("local");
        setLbError(
          "Couldn’t save to server (not signed in or network issue). Saved locally instead."
        );
      }
    }

    // Local fallback
    const { list, rank } = recordLocal({ name: nameToSave, score, streak });
    setLeaderboard(list);
    setSaveResult({ saved: true, rank });
  };

  const handleCloseModal = () => setShowSaveModal(false);

  return (
    <Container fluid className={classes.mainContainer}>
      <div className={classes.header}>
        <h4 className="mb-0">🧩 Word Scramble</h4>
        <div className="d-flex align-items-center gap-2">
          <Badge bg="success" className="me-2 fs-6">
            Score: {score}
          </Badge>
          <Badge bg={streak > 0 ? "warning" : "secondary"} className="fs-6">
            Streak: {streak}
          </Badge>
          <Button
            variant="outline-primary"
            size="sm"
            className="ms-2"
            onClick={openSave}
            disabled={score <= 0}
            title={
              score > 0
                ? "Save your score to the leaderboard"
                : "Play to earn a score first"
            }
          >
            Save to Leaderboard
          </Button>
        </div>
      </div>

      <Card className={classes.gameCard}>
        {loading ? (
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 mb-0 text-muted">Loading word…</p>
          </div>
        ) : (
          <>
            <h2 className={classes.scrambledWord}>{scrambled}</h2>

            <Form.Control
              type="text"
              placeholder={roundOver ? "Round over. Press Next." : "Type your guess..."}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!submitDisabled) checkGuess();
                }
              }}
              className={classes.guessInput}
              disabled={roundOver}
            />

            <div className="d-flex justify-content-between mt-3">
              <Button
                variant="success"
                size="lg"
                onClick={checkGuess}
                disabled={submitDisabled}
              >
                Submit
              </Button>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-secondary"
                  size="lg"
                  onClick={() => setGuess("")}
                  disabled={roundOver}
                >
                  Clear
                </Button>
                <Button variant="info" size="lg" onClick={loadNewWord}>
                  Next
                </Button>
              </div>
            </div>

            {hint && (
              <Alert
                variant={
                  hint.startsWith("✅")
                    ? "success"
                    : hint.startsWith("⚠️")
                    ? "warning"
                    : "info"
                }
                className="mt-4 text-center fs-6"
              >
                {hint}
              </Alert>
            )}
          </>
        )}
      </Card>

      {/* Leaderboard Card */}
      <Card className={`${classes.gameCard} mt-3`}>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <h5 className="mb-0">🏆 Leaderboard (Top {MAX_ENTRIES})</h5>
              <Badge bg={lbSource === "server" ? "primary" : "secondary"}>
                {lbSource === "server" ? "Global" : "Local"}
              </Badge>
            </div>
            <div className="d-flex gap-2">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={refreshServerLB}
              >
                Refresh
              </Button>
              {/* No reset button on client — admin-only on server */}
            </div>
          </div>

          {lbError && (
            <Alert variant="warning" className="mt-3 mb-0">
              {lbError}
            </Alert>
          )}

          {leaderboard.length === 0 ? (
            <div className="text-muted mt-3">
              No scores yet. Play and save your score!
            </div>
          ) : (
            <div className="mt-3">
              <Table striped bordered hover size="sm" responsive>
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
                    <tr key={`${row._id || ""}${row.name}-${row.at || row.createdAt}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td>{row.name}</td>
                      <td>{row.score}</td>
                      <td>{row.bestStreak}</td>
                      <td>
                        {new Date(row.at || row.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Save Modal */}
      <Modal show={showSaveModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Save to Leaderboard</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {saveResult.saved ? (
            <Alert variant="success" className="mb-3">
              🎉 Score saved!{" "}
              {saveResult.rank > 0 ? `Your current rank: #${saveResult.rank}.` : ""}
            </Alert>
          ) : (
            <>
              <p className="mb-2 text-muted">
                You’re about to save your <strong>Score: {score}</strong> (Best
                Streak: {streak})
              </p>
              <Form.Group className="mb-2">
                <Form.Label>Player Name</Form.Label>
                <Form.Control
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={32}
                />
              </Form.Group>
              {lbSource === "local" && (
                <small className="text-muted">
                  Tip: Sign in to save to the global leaderboard.
                </small>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {!saveResult.saved ? (
            <>
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveScore}
                disabled={score <= 0}
              >
                Save
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={handleCloseModal}>
              Done
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default WordScramble;
