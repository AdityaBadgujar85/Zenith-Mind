import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import classes from './Dashboard.module.css';
import { Link } from 'react-router-dom';
import BrainGames from '../images/BrainGames.jpg';
import ExerciseImg from '../images/Exercise.png' 

function Dashboard() {
  return (
    <Container className={classes.mainContainer} fluid>
     <Row>
 <Col xs={6} sm={6} md={3}>
     <div className={classes.CardDesign}>
        <Link to='/Sleep&Relaxation'>
      <img className={classes.imageDesign} src={BrainGames} alt="" />
      </Link>
      <h4 className={classes.cardText}>Sleep and Relaxation</h4>
      </div>
  </Col>
  <Col xs={6} sm={6} md={3}>
    <div className={classes.CardDesign}>
        <Link to='/mood_tracker'>
      <img className={classes.imageDesign} src={BrainGames} alt="" />
      </Link>
      <h4 className={classes.cardText}>Mood Tracker </h4>
      </div>
  </Col>
  <Col xs={6} sm={6} md={3}>
    <div className={classes.CardDesign}>
        <Link to='/mood_refresher'>
      <img className={classes.imageDesign} src={BrainGames} alt="" />
      </Link>
      <h4 className={classes.cardText}>Mood Refresher </h4>
      </div>
  </Col>
  <Col xs={6} sm={6} md={3}>
    
      <div className={classes.CardDesign}>
        <Link to='/report'>
      <img className={classes.imageDesign} src={ExerciseImg} alt="" />
      </Link>
      <h4 className={classes.cardText}>Report</h4>
      </div>
  </Col>
</Row>

     <Row>
  <Col xs={6} sm={6} md={3}>
    
      <div className={classes.CardDesign}>
        <Link to='/stress_tracker'>
      <img className={classes.imageDesign} src={ExerciseImg} alt="" />
      </Link>
      <h4 className={classes.cardText}>StressMonitoring</h4>
      </div>
  </Col>
  <Col xs={6} sm={6} md={3}>
    
      <div className={classes.CardDesign}>
        <Link to='/daily_motivation'>
      <img className={classes.imageDesign} src={ExerciseImg} alt="" />
      </Link>
      <h4 className={classes.cardText}>DailyMotivation</h4>
      </div>
  </Col>
  <Col xs={6} sm={6} md={3}>
      <div className={classes.CardDesign}>
        <Link to='/Exercise'>
      <img className={classes.imageDesign} src={ExerciseImg} alt="" />
      </Link>
      <h4 className={classes.cardText}>Mental Exercise</h4>
      </div>
  </Col>
  <Col xs={6} sm={6} md={3}>
     <div className={classes.CardDesign}>
        <Link to='/Games'>
      <img className={classes.imageDesign} src={BrainGames} alt="" />
      </Link>
      <h4 className={classes.cardText}>Brain Games</h4>
      </div>
  </Col>
</Row>

    </Container>
  );
}

export default Dashboard;
