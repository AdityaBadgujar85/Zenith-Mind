import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import WordScramble from '../../images/WordScrumble.jpg';
import MemoryGame from '../../images/MemoryGame.png'
import QuickMathBlitzGames from '../../images/Maths.jpg';
import SequenceTap from '../../images/SeqenceTap.png';
import classes from './MentalFitnessGamesDashBoard.module.css';
import { Link } from 'react-router-dom';

function MentalFitnessGamesDashboard() {
    return ( 
        <Container fluid className={classes.mainContainer}>
            <Row>
                <Col xs={6} md={3}>
                    <Link to="/Display/Word-Scramble">
                        <img src={WordScramble} alt="Word Scramble" className={classes.ImageDesign}/>
                    </Link>
                </Col>
                <Col xs={6} md={3}>
                    <Link to='/Display/Memory-Card-Game'>
                    <img src={MemoryGame} alt="" className={classes.ImageDesign}/>
                    </Link>
                </Col>
                <Col xs={6} md={3}>
                    <Link to='/Display/Quick-Maths-Blitz'>
                    <img src={QuickMathBlitzGames} alt="" className={classes.ImageDesign}/>
                    </Link>                
                </Col>
                <Col xs={6} md={3}>
                    <Link to='/Display/Sequence-Taps'>
                    <img src={SequenceTap} alt="" className={classes.ImageDesign} style={{background:'#121212'}}/>
                    </Link> 
            </Col>
            </Row>  
        </Container>
     );
}

export default MentalFitnessGamesDashboard;
