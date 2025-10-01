import React, { useState } from "react";
import { Container, Col, Row, Modal, Button } from "react-bootstrap";
import classes from "./MenalExerciseDashboard.module.css";
import MentalExerciseVideo from "../../Video/MentalExercise.mp4";
import BreathingImg from "../../images/Exercise.png";

function MenalExerciseDashboard() {
  const [show, setShow] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const handleClose = () => setShow(false);
  const handleShow = (video) => {
    setSelectedVideo(video);
    setShow(true);
  };

  // ✅ Added "steps" for each exercise
  const videoData = [
    {
      title: "Breathing Exercise",
      description: "A guided breathing exercise to calm the mind.",
      thumbnail: BreathingImg,
      exerciseVideo: MentalExerciseVideo,
      steps: [
        "Sit comfortably with your back straight.",
        "Close your eyes and relax your shoulders.",
        "Inhale deeply through your nose for 4 seconds.",
        "Hold your breath for 2 seconds.",
        "Exhale slowly through your mouth for 6 seconds.",
        "Repeat this cycle 5 times."
      ],
    },
    {
      title: "Mental Relaxation",
      description: "Simple relaxation exercise for stress relief.",
      thumbnail: BreathingImg,
      exerciseVideo: MentalExerciseVideo,
      steps: [
        "Find a quiet place and sit comfortably.",
        "Take a deep breath and close your eyes.",
        "Focus on releasing tension from your body.",
        "Visualize a calm and peaceful place.",
        "Continue slow breathing for 5 minutes."
      ],
    },
  ];

  return (
    <Container fluid style={{ marginTop: "6rem" }}>
      <Row style={{ justifyContent: "space-evenly" }}>
        {videoData.map((item, index) => (
          <Col
            key={index}
            xs={12}
            md={6}
            className={classes.exreciseCard}
            onClick={() => handleShow(item)}
            style={{ cursor: "pointer" }}
          >
            <div className={classes.exreciseCardDesign}>
              <div className={classes.exreciseInfo}>
                <h1>{item.title}</h1>
                <p>{item.description}</p>
              </div>
              <div>
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className={classes.exreciseImg}
                />
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Video Modal */}
      <Modal
        show={show}
        onHide={handleClose}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>{selectedVideo?.title}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* Video */}
          {selectedVideo && (
            <video
              src={selectedVideo.exerciseVideo}
              controls
              autoPlay
              style={{ width: "100%", borderRadius: "10px", marginBottom: "1rem" }}
            />
          )}

          {/* Steps */}
          {selectedVideo?.steps && (
            <div>
              <h5>Steps:</h5>
              <ol>
                {selectedVideo.steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default MenalExerciseDashboard;
