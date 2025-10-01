import React, { useState, useEffect } from "react";
import { Button, Card, Form, Alert, Spinner, Badge, Container } from "react-bootstrap";
import classes from "./WordScramble.module.css";

const RANDOM_API = "https://random-word-api.herokuapp.com/word";
const DICT_API = "https://api.dictionaryapi.dev/api/v2/entries/en";

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

async function fetchDefinition(word) {
  try {
    const res = await fetch(`${DICT_API}/${word}`);
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    const meaning = data[0]?.meanings?.[0];
    const def = meaning?.definitions?.[0]?.definition;
    return typeof def === "string" && def.trim().length ? def.trim() : null;
  } catch {
    return null;
  }
}

async function getValidRandomWord(maxTries = 6) {
  for (let t = 0; t < maxTries; t++) {
    const res = await fetch(`${RANDOM_API}?number=5`);
    const words = await res.json();
    const candidates = words
      .map((w) => String(w).toLowerCase())
      .filter((w) => /^[a-z]+$/.test(w) && w.length >= 3 && w.length <= 12);

    for (const candidate of candidates) {
      const def = await fetchDefinition(candidate);
      if (def) return { word: candidate, definition: def };
    }
  }
  return { word: "puzzle", definition: "A difficult question or problem." };
}

// New helper function to reveal a random percentage of letters
const revealRandomLetters = (word, percentage) => {
  const letters = word.split('');
  const numToReveal = Math.round(letters.length * (percentage / 100));
  
  // Create an array of all indices and shuffle them
  const indices = Array.from({ length: letters.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  
  // Mark the selected indices for revelation
  const revealedIndices = new Set(indices.slice(0, numToReveal));
  
  return letters.map((letter, i) =>
    revealedIndices.has(i) ? letter : '_'
  ).join(' ');
};


function WordScramble() {
  const [scrambled, setScrambled] = useState("");
  const [correctWord, setCorrectWord] = useState("");
  const [storedMeaning, setStoredMeaning] = useState(null);
  const [hint, setHint] = useState("");
  const [guess, setGuess] = useState("");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const loadNewWord = async () => {
    setLoading(true);
    setHint("");
    setGuess("");
    setWrongAttempts(0);

    const { word, definition } = await getValidRandomWord();
    const scrambledWord = scrambleWord(word);

    setCorrectWord(word);
    setStoredMeaning(definition);
    setScrambled(scrambledWord);
    setLoading(false);
  };

  useEffect(() => {
    loadNewWord();
  }, []);

  const awardPoints = (attempts) => {
    if (attempts === 0) return 10;
    if (attempts === 1) return 7;
    if (attempts === 2) return 5;
    return 0;
  };

  const checkGuess = () => {
    if (!guess.trim()) {
      setHint("⚠️ Please enter your guess.");
      return;
    }

    if (guess.toLowerCase() === correctWord.toLowerCase()) {
      const points = awardPoints(wrongAttempts);
      const streakBonus = streak >= 3 ? 5 : 0;
      setScore((prev) => prev + points + streakBonus);
      setStreak((prev) => prev + 1);
      setHint(`✅ Correct! +${points}${streakBonus ? ` (Streak bonus +${streakBonus})` : ""} points.`);
      return;
    }

    const next = wrongAttempts + 1;
    setWrongAttempts(next);

    // New hint logic based on wrong attempts
    switch (next) {
      case 1:
        if (storedMeaning) {
          setHint(`🧠 Hint: ${storedMeaning}`);
        } else {
          setHint("❌ Incorrect. Try again!");
        }
        break;
      case 2:
        setHint(`❌ Incorrect. Here's a hint: ${revealRandomLetters(correctWord, 30)}`);
        break;
      case 3:
        setHint(`❌ Incorrect. Here's another hint: ${revealRandomLetters(correctWord, 80)}`);
        break;
      default:
        setHint(`❌ The word was: ${correctWord}. Press "Next" to continue.`);
        setStreak(0);
        break;
    }
  };

  // The submit button is disabled after the fourth failed attempt (wrongAttempts >= 4)
  const submitDisabled = loading || wrongAttempts >= 4 || !scrambled;

  return (
    <Container fluid className={classes.mainContainer}>
      {/* Header */}
      <div className={classes.header}>
        <h4 className="mb-0">🧩 Word Scramble</h4>
        <div>
          <Badge bg="success" className="me-2 fs-6">Score: {score}</Badge>
          <Badge bg={streak > 0 ? "warning" : "secondary"} className="fs-6">Streak: {streak}</Badge>
        </div>
      </div>

      {/* Game Card */}
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
              placeholder="Type your guess..."
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!submitDisabled) checkGuess();
                }
              }}
              className={classes.guessInput}
            />

            <div className="d-flex justify-content-between mt-3">
              <Button variant="success" size="lg" onClick={checkGuess} disabled={submitDisabled}>
                Submit
              </Button>
              <Button variant="info" size="lg" onClick={loadNewWord}>
                Next
              </Button>
            </div>

            {hint && (
              <Alert
                variant={hint.startsWith("✅") ? "success" : hint.startsWith("⚠️") ? "warning" : "danger"}
                className="mt-4 text-center fs-6"
              >
                {hint}
              </Alert>
            )}
          </>
        )}
      </Card>
    </Container>
  );
}

export default WordScramble;
