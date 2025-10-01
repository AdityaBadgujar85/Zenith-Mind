import React, { useState, useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Container, Row, Col, Button, Form } from "react-bootstrap";
import styles from "./SequenceTap.module.css";

export default function SequenceTap() {
  const COLORS = [
    { id: 0, name: "red", class: styles.red },
    { id: 1, name: "orange", class: styles.orange },
    { id: 2, name: "yellow", class: styles.yellow },
    { id: 3, name: "green", class: styles.green },
    { id: 4, name: "teal", class: styles.teal },
    { id: 5, name: "blue", class: styles.blue },
    { id: 6, name: "indigo", class: styles.indigo },
    { id: 7, name: "purple", class: styles.purple },
  ];

  const [sequence, setSequence] = useState([]);
  const [userInput, setUserInput] = useState([]);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [activeButton, setActiveButton] = useState(null);
  const [level, setLevel] = useState(0);
  const [message, setMessage] = useState("Press Start to play");
  const [strict, setStrict] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [best, setBest] = useState(0);
  const timeoutRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  function playTone(index, duration = 300) {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const freqBase = [330, 392, 440, 494, 523, 587, 659, 740];
      o.frequency.value = freqBase[index % freqBase.length];
      o.type = "sine";
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.linearRampToValueAtTime(0.15, now + 0.01);
      o.start(now);
      g.gain.linearRampToValueAtTime(0.001, now + duration / 1000);
      o.stop(now + duration / 1000 + 0.02);
    } catch {}
  }

  function addRandomStep(seq = sequence) {
    const next = Math.floor(Math.random() * COLORS.length);
    return [...seq, next];
  }

  function startGame() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const firstSeq = addRandomStep([]);
    setSequence(firstSeq);
    setLevel(1);
    setUserInput([]);
    setIsRunning(true);
    setMessage("Watch the sequence");
    setTimeout(() => playSequence(firstSeq), 300);
  }

  async function playSequence(seq) {
    setIsPlayingSequence(true);
    setUserInput([]);
    for (let i = 0; i < seq.length; i++) {
      const idx = seq[i];
      setActiveButton(idx);
      playTone(idx, 320);
      await new Promise((res) => (timeoutRef.current = setTimeout(res, 420)));
      setActiveButton(null);
      await new Promise((res) => (timeoutRef.current = setTimeout(res, 140)));
    }
    setIsPlayingSequence(false);
    setMessage("Your turn");
  }

  function handleUserTap(idx) {
    if (!isRunning || isPlayingSequence) return;
    const newInput = [...userInput, idx];
    setUserInput(newInput);
    playTone(idx, 260);
    flashButtonTemporarily(idx);
    checkUserInput(newInput);
  }

  function flashButtonTemporarily(idx) {
    setActiveButton(idx);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setActiveButton(null), 250);
  }

  function checkUserInput(currentInput) {
    const position = currentInput.length - 1;
    if (sequence[position] !== currentInput[position]) {
      handleMistake();
      return;
    }
    if (currentInput.length === sequence.length) {
      const newLevel = level + 1;
      setLevel(newLevel);
      setBest((b) => Math.max(b, newLevel - 1));
      setMessage("Good! Next round");
      const newSeq = addRandomStep(sequence);
      setSequence(newSeq);
      setUserInput([]);
      setTimeout(() => {
        setMessage("Watch the sequence");
        playSequence(newSeq);
      }, 700);
    }
  }

  function handleMistake() {
    setMessage("Wrong!");
    (async function showErrorFlash() {
      setIsPlayingSequence(true);
      for (let i = 0; i < 3; i++) {
        setActiveButton(null);
        await new Promise((r) => (timeoutRef.current = setTimeout(r, 120)));
        setActiveButton(-1);
        playTone(0, 120);
        await new Promise((r) => (timeoutRef.current = setTimeout(r, 160)));
      }
      setActiveButton(null);
      setIsPlayingSequence(false);

      if (strict) {
        setMessage("Starting new game...");
        setTimeout(() => startGame(), 700);
      } else {
        setMessage("Try again. Watch the sequence...");
        setTimeout(() => playSequence(sequence), 700);
      }
    })();
  }

  return (
    <Container fluid className="py-4" style={{marginTop:'5rem'}}>
      {/* Header */}
      <Row className="mb-3 text-center">
        <Col>
          <h1>
            <span role="img" aria-label="icon">
              🔷
            </span>{" "}
            Sequence Tap
          </h1>
          <div>
            Level: <strong>{level}</strong> | Best: <strong>{best}</strong>
          </div>
        </Col>
      </Row>

      {/* Game Grid */}
      <Row className="justify-content-center mb-4">
        <Col xxs={12} md={12} className="d-flex flex-wrap justify-content-center">
          {COLORS.map((c) => (
            <div
              key={c.id}
              role="button"
              aria-label={c.name}
              onClick={() => handleUserTap(c.id)}
              className={`${styles.colorButton} ${c.class} ${
                activeButton === c.id ? styles.active : ""
              } ${activeButton === -1 ? styles.allFlash : ""} m-2`}
              style={{ width: "100px", height: "100px" }}
            >
              <span className="visually-hidden">{c.name}</span>
            </div>
          ))}
        </Col>
      </Row>

      {/* Status */}
      <Row className="mb-3">
        <Col className="text-center">
          <h5>Status</h5>
          <p>{message}</p>
        </Col>
      </Row>

      {/* Controls */}
      <Row className="mb-4 justify-content-center">
        <Col md={6} className="text-center">
          <Button onClick={startGame} variant="success" className="m-2">
            Start
          </Button>
          <Button
            onClick={() => {
              setIsRunning(false);
              setLevel(0);
              setSequence([]);
              setUserInput([]);
              setMessage("Press Start to play");
            }}
            variant="danger"
            className="m-2"
          >
            Reset
          </Button>
          <Form.Check
            type="checkbox"
            label="Strict mode (fail → restart)"
            checked={strict}
            onChange={(e) => setStrict(e.target.checked)}
            inline
          />
        </Col>
      </Row>

      {/* Instructions */}
      <Row className="mb-3">
        <Col className="text-center">
          <h5>Controls</h5>
          <ul className="list-unstyled">
            <li>Start — begins a new game</li>
            <li>Reset — clears progress</li>
            <li>Strict — on fail, restarts from first step</li>
          </ul>
          <p className="text-muted">
            Click the colored pads to repeat the sequence. Each round adds a
            step.
          </p>
        </Col>
      </Row>

      {/* Footer */}
      <Row>
        <Col className="text-center">
          <small>Made with ❤️ — Sequence Tap</small>
        </Col>
      </Row>
    </Container>
  );
}
