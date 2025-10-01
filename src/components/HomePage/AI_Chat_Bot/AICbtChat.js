import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Container, Row, Col, Button, Form, Card } from "react-bootstrap";

export default function AICbtChat() {
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem("cbt_history");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tone, setTone] = useState("gentle");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("cbt_history", JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }

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
    "I'm feeling anxious about a conversation I had. Help me reframe the thought.",
    "I feel like a failure because I made a mistake at work.",
    "I'm worried they'll reject me if I ask for help.",
  ];

  async function handleSend(rawText) {
    const text = rawText?.trim();
    if (!text) return;

    setError(null);

    const userMessage = {
      id: Date.now() + "_u",
      role: "user",
      text,
      ts: Date.now(),
    };

    setMessages((m) => [...m, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const systemPrompt = `You are a supportive CBT chatbot that helps users identify cognitive distortions and reframe thoughts. Keep responses short (3-6 sentences), provide an evidence-based reframe, and offer one small behavioural step the user can try. If the user shares facts, ask 1 clarifying question. Tone: ${tone}.`;

      const context = messages
        .slice(-6)
        .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
        .join("\n");

      const finalPrompt = `${systemPrompt}\n\nConversation so far:\n${context}\n\nUser: ${text}\nAssistant:`;

      const key = process.env.REACT_APP_GEMINI_API_KEY || window?.__GEMINI_KEY__;
      if (!key) {
        throw new Error(
          "Gemini API key not found. Add REACT_APP_GEMINI_API_KEY to your environment or set window.__GEMINI_KEY__ for testing."
        );
      }

      const resp = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
          key,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: finalPrompt }],
              },
            ],
          }),
        }
      );

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Gemini API error: ${resp.status} — ${txt}`);
      }

      const data = await resp.json();
      const aiText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "(no response)";

      const aiMessage = {
        id: Date.now() + "_a",
        role: "assistant",
        text: aiText.trim(),
        ts: Date.now(),
      };

      setMessages((m) => [...m, aiMessage]);
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + "_err",
          role: "assistant",
          text: `Sorry — I couldn't reach Gemini. ${err.message || "Unknown error"}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickPrompt(p) {
    handleSend(p);
  }

  function handleDistortionClick(d) {
    const prompt = `I might be using the cognitive distortion: ${d}. Here is my thought: `;
    setInput(prompt);
    setTimeout(() => document.getElementById("cbt-input")?.focus(), 60);
  }

  function clearHistory() {
    if (!window.confirm("Clear chat history? This cannot be undone.")) return;
    setMessages([]);
    localStorage.removeItem("cbt_history");
  }

  function exportHistory() {
    const blob = new Blob([JSON.stringify(messages, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cbt_history_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Container
      fluid
      className="py-4 bg-white rounded shadow-lg"
      style={{ marginTop: "5rem" }}
    >
      <Row className="mb-4 align-items-center justify-content-between">
        <Col>
          <h1 className="h4">AI CBT Chat Support 🤖 (Gemini)</h1>
          <p className="text-muted small mb-0">
            Thought reframing assistant — evidence-based, compassionate.
          </p>
        </Col>
        <Col xs="auto" className="d-flex gap-2">
          <Form.Select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            size="sm"
          >
            <option value="gentle">Gentle</option>
            <option value="direct">Direct</option>
            <option value="encouraging">Encouraging</option>
          </Form.Select>
        </Col>
      </Row>

      <Row>
        {/* Left Panel */}
        <Col md={4} className="mb-3">
          <Card className="mb-3">
            <Card.Body>
              <Card.Title className="h6">Quick prompts</Card.Title>
              {quickPrompts.map((q) => (
                <Button
                  key={q}
                  variant="light"
                  className="w-100 text-start mb-2"
                  size="sm"
                  onClick={() => handleQuickPrompt(q)}
                >
                  {q}
                </Button>
              ))}
            </Card.Body>
          </Card>

          <Card
            className="mb-3"
            style={{ maxHeight: "38vh", overflowY: "auto" }}
          >
            <Card.Body>
              <Card.Title className="h6">Cognitive distortions</Card.Title>
              {cognitiveDistortions.map((d) => (
                <div
                  key={d}
                  className="d-flex justify-content-between align-items-center mb-2"
                >
                  <span className="small">{d}</span>
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

          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              className="flex-fill"
              onClick={exportHistory}
            >
              Export
            </Button>
            <Button
              variant="outline-danger"
              className="flex-fill"
              onClick={clearHistory}
            >
              Clear
            </Button>
          </div>
        </Col>

        {/* Chat Panel */}
        <Col md={8} className="d-flex flex-column" style={{ height: "60vh" }}>
          <div className="flex-fill border rounded p-3 overflow-auto">
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`mb-3 ${
                    m.role === "user" ? "text-end" : "text-start"
                  }`}
                >
                  <div
                    className={`d-inline-block p-2 rounded ${
                      m.role === "user"
                        ? "bg-primary text-white"
                        : "bg-light text-dark"
                    }`}
                  >
                    <div className="small">{m.text}</div>
                    <div className="text-muted small mt-1">
                      {new Date(m.ts).toLocaleString()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          <div className="mt-3">
            {error && <div className="text-danger small mb-2">{error}</div>}
            <Row>
              <Col>
                <Form.Control
                  as="textarea"
                  id="cbt-input"
                  rows={3}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a thought (eg. I'm sure they'll hate my idea)..."
                />
              </Col>
              <Col xs="auto" className="d-flex flex-column gap-2">
                <Button
                  variant="success"
                  disabled={loading}
                  onClick={() => handleSend(input)}
                >
                  {loading ? "Thinking..." : "Reframe"}
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => {
                    setInput("");
                    document.getElementById("cbt-input")?.focus();
                  }}
                >
                  Clear
                </Button>
              </Col>
            </Row>
            <div className="mt-2 text-muted small">
              Suggestion: start with the automatic thought, then ask for help
              reframing.
            </div>
          </div>
        </Col>
      </Row>

      <Row className="mt-3">
        <Col>
          <p className="text-muted small mb-0">
            Not a substitute for professional care. If you are in crisis, please
            contact local emergency services or a mental health professional.
          </p>
        </Col>
      </Row>
    </Container>
  );
}
