import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Container, Navbar, Nav } from 'react-bootstrap';
import classes from './NavBar.module.css';

function NavBar() {
  const changeCss = (isActive) => ({
  fontWeight: isActive ? 'bold' : 'normal'
});

  return (
    <Navbar fixed="top" expand="lg" className={classes['Navbar-Design']}>
      <Container>
        <Navbar.Brand>
          <h1 className={classes['Navbar-Brand']}>Zenith Mind</h1>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link className={classes['Navlink-text']} style={{changeCss}} href="/">Home</Nav.Link>
            <Nav.Link className={classes['Navlink-text']} style={{changeCss}} href="#about">About</Nav.Link>
            <Nav.Link className={classes['Navlink-text']} style={{changeCss}} href="#contact">Contact</Nav.Link>
            <Nav.Link className={classes['Navlink-text']} style={{changeCss}} href="#login">Login</Nav.Link>
            <Nav.Link className={classes['Navlink-text']} style={{changeCss}} href="#signup">SignUp</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavBar;
