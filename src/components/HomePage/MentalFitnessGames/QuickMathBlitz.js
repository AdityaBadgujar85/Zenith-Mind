import React, { useState, useEffect } from "react";
import { Button, Card, Form, Container, Row, Col, Alert, Dropdown, DropdownButton } from "react-bootstrap";
import classes from "./QuickMathBlitz.module.css";

function QuickMathBlitz() {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [operator, setOperator] = useState("+");
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(10);
  const [difficulty, setDifficulty] = useState("Easy");

  useEffect(() => {
    generateProblem();
  }, [difficulty]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    if (timeLeft <= 0) {
      setFeedback("Time's up! Streak reset.");
      setStreak(0);
      setTimeLeft(10);
      generateProblem();
    }

    return () => clearInterval(timer);
  }, [timeLeft]);

  function generateProblem() {
    let maxNum = 20;
    let ops = ["+", "-"];
    if (difficulty === "Medium") {
      maxNum = 50;
      ops = ["+", "-", "*"];
    } else if (difficulty === "Hard") {
      maxNum = 100;
      ops = ["+", "-", "*"];
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

  function checkAnswer(e) {
    e.preventDefault();
    let correct;
    if (operator === "+") correct = num1 + num2;
    if (operator === "-") correct = num1 - num2;
    if (operator === "*") correct = num1 * num2;

    if (parseInt(answer) === correct) {
      setScore(score + 10);
      setStreak(streak + 1);
      setFeedback("Correct! 🎉");
      setTimeLeft(Math.max(5, 10 - Math.floor(streak / 3))); // faster as streak increases
      generateProblem();
    } else {
      setFeedback(`Wrong! Correct answer was ${correct}`);
      setStreak(0);
      setTimeLeft(10);
      generateProblem();
    }
  }

  return (
    <Container className={classes.container} fluid>
      <h2>🧮 Quick Math Blitz</h2>

      <Row className={classes.header}>
        <Col>Score: {score}</Col>
        <Col>Streak: {streak}</Col>
        <Col>Time: {timeLeft}s</Col>
      </Row>

      <DropdownButton
        id="dropdown-basic-button"
        title={`Difficulty: ${difficulty}`}
        className="mb-3"
        onSelect={(eventKey) => setDifficulty(eventKey)}
        variant="dark"
      >
        <Dropdown.Item eventKey="Easy">Easy</Dropdown.Item>
        <Dropdown.Item eventKey="Medium">Medium</Dropdown.Item>
        <Dropdown.Item eventKey="Hard">Hard</Dropdown.Item>
      </DropdownButton>

      <Card className={classes.card}>
        <h3>{num1} {operator} {num2} = ?</h3>
        <Form onSubmit={checkAnswer}>
          <Form.Control
            type="number"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Enter your answer"
            autoFocus
          />
          <Button variant="dark" type="submit">Submit</Button>
        </Form>
        {feedback && <Alert className={classes.alert}>{feedback}</Alert>}
      </Card>
    </Container>
  );
}

export default QuickMathBlitz;
