import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, RefreshCw, Clipboard, Share2, X } from "lucide-react";
import { Container, Row, Col, Button, Card } from "react-bootstrap";
import quotesData from "./quotes.json";
import styles from "./DailyMotivationAffirmations.module.css";

export default function DailyMotivationAffirmations() {
  const LS_FAV_KEY = "dm_affirmations_favs_v1";
  const [quote, setQuote] = useState({ text: "", author: "", id: 0 });
  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_FAV_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  function fetchQuote() {
    if (!quotesData || quotesData.length === 0) return;
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * quotesData.length);
    } while (quotesData[randomIndex].id === quote.id);
    setQuote(quotesData[randomIndex]);
  }

  useEffect(() => {
    fetchQuote();
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_FAV_KEY, JSON.stringify(favorites));
  }, [favorites]);

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
    <div className={styles.pageWrapper}>
      <Container>
        <Row className="justify-content-center">
          <Col md={8}>
            {/* Header */}
            <div className={styles.header}>
              <h2 className={styles.title}>Daily Motivation & Affirmations 🌿</h2>
              <p className={styles.subtitle}>
                Find peace and encouragement — one quote at a time.
              </p>
            </div>

            {/* Quote Card */}
            <Card className={styles.quoteCard}>
              <Card.Body>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={quote.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <blockquote className={styles.quoteText}>“{quote.text}”</blockquote>
                    {quote.author && (
                      <footer className={styles.quoteAuthor}>— {quote.author}</footer>
                    )}

                    {/* Action Buttons */}
                    <div className={styles.actions}>
                      <Button className={styles.nextBtn} onClick={fetchQuote}>
                        <RefreshCw size={16} /> New Quote
                      </Button>
                      <Button
                        className={`${styles.iconBtn} ${
                          favorites.includes(quote.id) ? styles.favActive : ""
                        }`}
                        onClick={() => toggleFavorite(quote.id)}
                      >
                        <Heart size={16} />
                      </Button>
                      <Button className={styles.iconBtn} onClick={copyCurrent}>
                        <Clipboard size={16} />
                      </Button>
                      <Button className={styles.iconBtn} onClick={shareCurrent}>
                        <Share2 size={16} />
                      </Button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </Card.Body>
            </Card>

            {/* Favorites */}
            {favorites.length > 0 && (
              <Card className={styles.favoritesCard}>
                <Card.Body>
                  <h5 className={styles.favTitle}>❤️ Saved Favorites</h5>
                  <ul className={styles.favList}>
                    {favorites.map((id) => {
                      const favQuote = quotesData.find((q) => q.id === id);
                      if (!favQuote) return null;
                      return (
                        <li key={id} className={styles.favItem}>
                          <span>
                            “{favQuote.text}” — {favQuote.author}
                          </span>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => removeFavorite(id)}
                            className={styles.removeBtn}
                          >
                            <X size={14} />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </Card.Body>
              </Card>
            )}
          </Col>
        </Row>
      </Container>
    </div>
  );
}
