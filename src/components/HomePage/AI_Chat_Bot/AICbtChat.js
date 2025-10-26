import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Container, Row, Col, Button, Form, Card } from "react-bootstrap";
import styles from "./AICbtChat.module.css";

export default function AICbtChat() {
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem("cbt_history");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tone, setTone] = useState("gentle");

  // Used to auto-scroll
  const messagesEndRef = useRef(null);

  // Used to cancel in-flight requests (so "Clear" truly clears)
  const controllerRef = useRef(null);

  // Session guard so old async responses don’t append after clearing
  const [sessionId, setSessionId] = useState(() => Date.now());

  useEffect(() => {
    localStorage.setItem("cbt_history", JSON.stringify(messages));
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const cognitiveDistortions = [
    "All-or-nothing thinking",
    "Overgeneralization",
    "Mental filter",
    "Disqualifying the positive",
    "Jumping to conclusions",
    "Magnification / Minimization",
    "Emotional reasoning",
    "Should statements",
    "Labeling",
    "Personalization",
  ];

  const quickPrompts = [
    "I'm feeling anxious about something that happened today.",
    "I made a mistake and can't stop thinking about it.",
    "I'm worried people might think badly of me.",
  ];

  // Simple script check (Devanagari vs Latin). We’ll mostly rely on prompt to mirror language/style,
  // but this can help us add a tiny hint if needed.
  const isDevanagari = (s) => /[\u0900-\u097F]/.test(s);

  async function handleSend(rawText) {
    const text = rawText?.trim();
    if (!text) return;

    setError(null);

    const userMessage = { id: Date.now() + "_u", role: "user", text, ts: Date.now() };
    setMessages((m) => [...m, userMessage]);
    setInput("");
    setLoading(true);

    // Abort any previous pending request (rare, but safe)
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    const currentSession = sessionId;

    try {
      // Language-mirroring instructions:
      // - Reply in the SAME language the user just used.
      // - If Hinglish (code-mixed), keep that exact style (don’t over-translate).
      // - Keep 3–6 sentences + one small practical step.
      const systemPrompt = [
        `You are a calm, thoughtful counselor.`,
        `Help the user explore and reframe their thoughts compassionately.`,
        `Keep responses short (3–6 sentences) and offer one small practical step.`,
        `Tone: ${tone}.`,
        `CRITICAL: Reply strictly in the SAME language/style as the user's last message.`,
        `If the message is Hinglish (mixed Hindi+English in Latin script), keep it Hinglish; do not convert it fully to Hindi or English.`,
        `If the message is in Devanagari (e.g., Hindi/Marathi), reply in Devanagari.`,
        `Avoid clinical jargon; be warm and supportive.`,
      ].join(" ");

      const context = messages
        .slice(-6)
        .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
        .join("\n");

      const finalPrompt = `${systemPrompt}\n\nConversation so far:\n${context}\n\nUser: ${text}\nTherapist:`;

      const key = process.env.REACT_APP_GEMINI_API_KEY || window.__GEMINI_KEY__;
      if (!key) throw new Error("API key missing");

      const MODELS = ["gemini-2.0-flash", "gemini-2.0-pro"];
      let aiText = "";
      let success = false;

      for (const model of MODELS) {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controllerRef.current.signal,
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
                generationConfig: { response_mime_type: "text/plain" },
              }),
            }
          );

          if (resp.ok) {
            const data = await resp.json();
            aiText =
              data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
              "(no response)";
            success = true;
            break;
          }
        } catch (e) {
          // If aborted, bubble out to finally
          if (e?.name === "AbortError") throw e;
          // else try next model
        }
      }

      if (!success) throw new Error("Connection issue.");

      // Don’t append if user cleared the chat mid-request
      if (currentSession !== sessionId) return;

      const aiMessage = {
        id: Date.now() + "_a",
        role: "therapist",
        text: aiText,
        ts: Date.now(),
      };
      setMessages((m) => [...m, aiMessage]);
    } catch (err) {
      if (err?.name === "AbortError") {
        // Silently ignore; user cleared chat
      } else {
        setError(err.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
      // clear the controller
      controllerRef.current = null;
    }
  }

  function handleQuickPrompt(p) {
    handleSend(p);
  }

  function handleDistortionClick(d) {
    const prompt = `I might be thinking in terms of ${d}. My thought: `;
    setInput(prompt);
    setTimeout(() => document.getElementById("cbt-input")?.focus(), 60);
  }

  function clearHistory() {
    if (!window.confirm("Clear chat history?")) return;

    // Abort any pending AI response and reset loading state
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = null;
    setLoading(false);

    // Clear messages + localStorage
    setMessages([]);
    localStorage.removeItem("cbt_history");

    // Bump session so any late async responses don’t append
    setSessionId(Date.now());

    // Also clear errors
    setError(null);
  }

  function exportHistory() {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conversation_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Container fluid className={styles.mainContainer}>
      <Row className={styles.headerRow}>
        <Col>
          <h1 className={styles.header}>Your Space</h1>
          <p className={styles.subText}>A calm place to share, reflect, and reframe.</p>
        </Col>
        <Col xs="auto">
          <Form.Select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            size="sm"
            className={styles.toneSelect}
          >
            <option value="gentle">Gentle</option>
            <option value="direct">Direct</option>
            <option value="encouraging">Encouraging</option>
          </Form.Select>
        </Col>
      </Row>

      <Row>
        {/* Left Panel */}
        <Col md={4} className={styles.leftPanel}>
          <Card className={styles.card}>
            <Card.Body>
              <Card.Title className={styles.cardTitle}>Suggested Prompts</Card.Title>
              {quickPrompts.map((q) => (
                <Button
                  key={q}
                  className={styles.promptBtn}
                  onClick={() => handleQuickPrompt(q)}
                >
                  {q}
                </Button>
              ))}
            </Card.Body>
          </Card>

          <Card className={styles.card}>
            <Card.Body>
              <Card.Title className={styles.cardTitle}>Thinking Patterns</Card.Title>
              {cognitiveDistortions.map((d) => (
                <div key={d} className={styles.distortionItem}>
                  <span>{d}</span>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => handleDistortionClick(d)}
                  >
                    Use
                  </Button>
                </div>
              ))}
            </Card.Body>
          </Card>

          <div className={styles.controlBtns}>
            <Button variant="outline-secondary" onClick={exportHistory}>Export</Button>
            <Button variant="outline-danger" onClick={clearHistory}>Clear</Button>
          </div>
        </Col>

        {/* Chat Panel */}
        <Col md={8} className={styles.chatPanel}>
          <div className={styles.chatBox}>
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`${styles.message} ${
                    m.role === "user" ? styles.userMsg : styles.therapistMsg
                  }`}
                >
                  <div>{m.text}</div>
                  <div className={styles.timestamp}>
                    {new Date(m.ts).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {error && <div className="text-danger small mb-2">{error}</div>}

          <div className={styles.inputArea}>
            <Form.Control
              as="textarea"
              id="cbt-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your thoughts here..."
              className={styles.textarea}
            />
            <div className={styles.inputButtons}>
              <Button
                variant="success"
                disabled={loading}
                onClick={() => handleSend(input)}
              >
                {loading ? "Responding..." : "Send"}
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => setInput("")}
              >
                Clear
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      <Row className="mt-3">
        <Col>
          <p className={styles.footer}>
            This space is meant for reflection and emotional wellness.&nbsp;
            If you’re in crisis, please reach out to a mental health professional.
          </p>
        </Col>
      </Row>
    </Container>
  );
}
