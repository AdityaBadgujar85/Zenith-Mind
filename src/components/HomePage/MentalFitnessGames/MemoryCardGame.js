import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import classes from "./MemoryCardGame.module.css";

const EMOJIS = [
  "🍎","🍌","🍇","🍉","🍒",
  "🍓","🥝","🍍","🥭","🍑",
  "🥑","🌶️","🥕","🍆","🥔",
  "🍄","🥦","🥬","🥯","🥐",
];

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

export default function MemoryCardGame() {
  const [numCards, setNumCards] = useState(20);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    const selectedEmojis = shuffleArray(EMOJIS).slice(0, numCards);
    const paired = shuffleArray([...selectedEmojis, ...selectedEmojis])
      .slice(0, numCards * 2)
      .map((emoji, index) => ({ id: index, emoji, visible: true }));

    setCards(paired);
    setFlipped([]);
    setMoves(0);
  }, [numCards]);

  const handleFlip = (index) => {
    if (flipped.includes(index) || !cards[index].visible) return;

    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [first, second] = newFlipped;
      if (cards[first].emoji === cards[second].emoji) {
        const newCards = [...cards];
        newCards[first].visible = false;
        newCards[second].visible = false;
        setCards(newCards);
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 1000);
      }
    }
  };

  const getGridColumns = () => {
    if (numCards <= 10) return 5;
    if (numCards <= 15) return 5;
    return 10; // keep 20 cards as 5x4 grid for neat layout
  };

  return (
    <Container fluid className={classes.memoryGameContainer}>
      {/* Header row */}
      <div className={classes.headerRow}>
  <div className={classes.left}>
    <h2 className={classes.title}>🧠 Memory Game</h2>
  </div>

  <div className={classes.center}>
    <div className={classes.cardOptions}>
      <button onClick={() => setNumCards(10)}>10 Cards</button>
      <button onClick={() => setNumCards(15)}>15 Cards</button>
      <button onClick={() => setNumCards(20)}>20 Cards</button>
    </div>
  </div>

  <div className={classes.right}>
    <div className={classes.movesMatched}>
      Moves: {moves} | Matched: {cards.filter((c) => !c.visible).length / 2}
    </div>
  </div>
</div>


      {/* Game board */}
     <div className={classes.cardsGrid}>
  {cards.map((card, index) => {
    if (!card.visible)
      return <div key={card.id} className={classes.invisibleCard}></div>;

    const isFlipped = flipped.includes(index);
    return (
      <div
        key={card.id}
        className={`${classes.card} ${isFlipped ? classes.flipped : ""}`}
        onClick={() => handleFlip(index)}
      >
        <div className={classes.cardInner}>
          <div className={classes.cardFront}></div>
          <div className={classes.cardBack}>{card.emoji}</div>
        </div>
      </div>
    );
  })}
</div>

    </Container>
  );
}
