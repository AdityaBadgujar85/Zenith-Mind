import React, { useState } from "react";
import { Container, Row, Col, Form, Button, Card } from "react-bootstrap";
import classes from "./Contact.module.css";

function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Contact Form Submitted:", formData);
    alert("Thank you! We will get back to you soon.");
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <Container fluid className={classes.contactContainer}>
      <Row className="justify-content-center">
        <Col xs={11} md={10} lg={8}>
          <Card className={classes.contactCard}>
            <Card.Body>
              <h2 className={classes.contactTitle}>Contact ZenithMind</h2>
              <p className={classes.contactSubtitle}>
                We'd love to hear from you! Reach out for inquiries, feedback, or support.
              </p>
              <Row>
                <Col md={6}>
                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3" controlId="contactName">
                      <Form.Label>Name</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Your Name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="contactEmail">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="Your Email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="contactSubject">
                      <Form.Label>Subject</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="contactMessage">
                      <Form.Label>Message</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={5}
                        placeholder="Your Message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>

                    <Button type="submit" className={classes.submitBtn}>
                      Send Message
                    </Button>
                  </Form>
                </Col>

                <Col md={6} className={classes.contactInfoCol}>
                  <div className={classes.contactInfo}>
                    <h5>Contact Information</h5>
                    <p>Email: support@zenithmind.com</p>
                    <p>Phone: +91 98765 43210</p>
                    <p>Address: 123 Zenith Street, Mumbai, India</p>
                    <div className={classes.mapContainer}>
                      {/* Replace with your real Google Maps iframe */}
                      <iframe
                        title="ZenithMind Location"
                        src="https://maps.google.com/maps?q=Mumbai&t=&z=13&ie=UTF8&iwloc=&output=embed"
                        width="100%"
                        height="200"
                        style={{ border: 0, borderRadius: "12px" }}
                        allowFullScreen=""
                        loading="lazy"
                      ></iframe>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Contact;
