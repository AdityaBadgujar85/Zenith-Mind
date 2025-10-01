import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, RefreshCw, Sun, Moon, Clipboard, Share2, X } from "lucide-react";
import { Container, Row, Col, Button } from "react-bootstrap";

// Load quotes locally
import quotesData from "./quotes.json"; // adjust path if needed

export default function DailyMotivationAffirmations({ initialTheme = "system" }) {
  const LS_FAV_KEY = "dm_affirmations_favs_v1";
  const LS_THEME_KEY = "dm_affirmations_theme_v1";

  const [quote, setQuote] = useState({ text: "", author: "", id: 0 });
  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_FAV_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem(LS_THEME_KEY) || initialTheme);

  // Load a random quote
  function fetchQuote() {
    if (!quotesData || quotesData.length === 0) return;

    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * quotesData.length);
    } while (quotesData[randomIndex].id === quote.id);

    setQuote(quotesData[randomIndex]);
  }

  useEffect(() => {
    fetchQuote(); // load first quote
  }, []);

  // Persist favorites + theme
  useEffect(() => {
    localStorage.setItem(LS_FAV_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(LS_THEME_KEY, theme);
    if (theme === "dark") document.documentElement.classList.add("dark");
    else if (theme === "light") document.documentElement.classList.remove("dark");
    else {
      const prefersDark =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  function toggleFavorite(id) {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [id, ...f]));
  }

  function removeFavorite(id) {
    setFavorites((f) => f.filter((x) => x !== id));
  }

  function copyCurrent() {
    navigator.clipboard?.writeText(`"${quote.text}" — ${quote.author}`).catch(() => {});
  }

  async function shareCurrent() {
    const payload = { text: `"${quote.text}" — ${quote.author}` };
    try {
      if (navigator.share) await navigator.share(payload);
      else {
        copyCurrent();
        alert("Quote copied to clipboard — share anywhere!");
      }
    } catch {}
  }

  return (
    <Container fluid className="py-4 bg-light dark:bg-dark min-vh-100" style={{ marginTop: "6rem" }}>
      <Row className="justify-content-center">
        <Col md={8}>
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2>Daily Motivation & Affirmations</h2>
              <p className="text-muted">A fresh nudge every time you click.</p>
            </div>
            <div className="d-flex gap-2">
              <Button
                variant="light"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </Button>
            </div>
          </div>

          {/* Quote Card */}
          <div className="p-4 bg-white rounded shadow-sm dark:bg-secondary">
            <AnimatePresence mode="wait">
              <motion.div
                key={quote.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <blockquote className="fs-5 fw-semibold">“{quote.text}”</blockquote>
                {quote.author && <footer className="text-muted small">— {quote.author}</footer>}

                {/* Actions */}
                <div className="d-flex gap-2 mt-3 align-items-center">
                  <Button size="sm" variant="primary" onClick={fetchQuote}>
                    Next
                  </Button>
                  <Button size="sm" variant="outline-secondary" onClick={fetchQuote}>
                    <RefreshCw size={14} />
                  </Button>
                  <Button size="sm" variant="outline-secondary" onClick={() => toggleFavorite(quote.id)}>
                    <Heart size={14} className={favorites.includes(quote.id) ? "text-danger" : ""} />
                  </Button>
                  <Button size="sm" variant="outline-secondary" onClick={copyCurrent}>
                    <Clipboard size={14} />
                  </Button>
                  <Button size="sm" variant="outline-secondary" onClick={shareCurrent}>
                    <Share2 size={14} />
                  </Button>
                  <span className="ms-auto small text-muted">Favorites: {favorites.length}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Favorites List */}
          {favorites.length > 0 && (
            <div className="mt-4">
              <h6>Saved Favorites</h6>
              <ul className="list-unstyled">
                {favorites.map((id) => {
                  const favQuote = quotesData.find((q) => q.id === id);
                  if (!favQuote) return null;
                  return (
                    <li key={id} className="mb-2 small d-flex justify-content-between align-items-center">
                      <span>
                        ❤️ "{favQuote.text}" — {favQuote.author}
                      </span>
                      <Button size="sm" variant="outline-danger" onClick={() => removeFavorite(id)}>
                        <X size={14} />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
}
