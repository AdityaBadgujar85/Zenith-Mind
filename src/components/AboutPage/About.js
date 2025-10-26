import React from "react";
import { Container, Row, Col, Card } from "react-bootstrap";
import classes from "./About.module.css";
import MissionImg from "../images/Mission.jpg"; // placeholder
import VisionImg from "../images/Vision.png"; // placeholder
import TeamImg from "../images/Team.png"; // placeholder

function About() {
  return (
    <Container fluid className={classes.aboutContainer}>
      <Row className="justify-content-center text-center">
        <Col xs={11} md={10} lg={8}>
          <h2 className={classes.aboutTitle}>About ZenithMind</h2>
          <p className={classes.aboutSubtitle}>
            ZenithMind is dedicated to enhancing mental fitness and cognitive skills through fun and innovative games, exercises, and learning experiences.
          </p>
        </Col>
      </Row>

      <Row className="g-4 justify-content-center mt-4">
        <Col xs={12} md={4}>
          <Card className={classes.infoCard}>
            <Card.Img variant="top" src={MissionImg} className={classes.cardImg} />
            <Card.Body>
              <Card.Title>Our Mission</Card.Title>
              <Card.Text>
                To provide engaging tools that enhance mental agility, focus, and overall cognitive well-being for all age groups.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={4}>
          <Card className={classes.infoCard}>
            <Card.Img variant="top" src={VisionImg} className={classes.cardImg} />
            <Card.Body>
              <Card.Title>Our Vision</Card.Title>
              <Card.Text>
                To become a leading platform that promotes mental health awareness and encourages lifelong cognitive development.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={4}>
          <Card className={classes.infoCard}>
            <Card.Img variant="top" src={TeamImg} className={classes.cardImg} />
            <Card.Body>
              <Card.Title>Our Team</Card.Title>
              <Card.Text>
                A passionate group of educators, developers, and psychologists committed to delivering innovative mental fitness solutions.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default About;
