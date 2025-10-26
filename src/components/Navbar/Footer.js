import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaFacebookF, FaInstagram, FaTwitter, FaLinkedinIn } from "react-icons/fa";
import styles from "./Footer.module.css";

function Footer() {
  return (
    <footer className={`shadow ${styles["footer-design"]}`}>
      <Container>
        <Row className="align-items-center text-center text-md-start">
          {/* Brand + Tagline */}
          <Col md={4}>
            <h2 className={styles["footer-brand"]}>ZenithMind</h2>
            <p className={styles["footer-tagline"]}>
              Guiding your mind toward peace, purpose, and clarity.
            </p>
          </Col>

          {/* Navigation Links */}
          <Col md={4} className="my-3 my-md-0">
            <ul className={styles["footer-links"]}>
              <li><a href="/">Home</a></li>
              <li><a href="/about">About</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </Col>

          {/* Social Media */}
          <Col md={4} className={styles["social-col"]}>
            <div className={styles["social-icons"]}>
              <a href="#" aria-label="Facebook"><FaFacebookF /></a>
              <a href="#" aria-label="Instagram"><FaInstagram /></a>
              <a href="#" aria-label="Twitter"><FaTwitter /></a>
              <a href="#" aria-label="LinkedIn"><FaLinkedinIn /></a>
            </div>
          </Col>
        </Row>

        {/* Copyright */}
        <Row>
          <Col className="text-center mt-3">
            <hr className={styles["divider"]} />
            <p className={styles["footer-copy"]}>
              © {new Date().getFullYear()} ZenithMind. All rights reserved.
            </p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
}

export default Footer;
