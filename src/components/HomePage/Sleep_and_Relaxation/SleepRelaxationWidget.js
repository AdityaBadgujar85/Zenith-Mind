// SleepRelaxationWidget.jsx
import React, { useEffect, useRef, useState, useContext } from 'react';
import { Container, Row, Col, Card, Button, Form, ProgressBar, ListGroup } from 'react-bootstrap';
import { AppDataContext } from '../../../App'; // Context from App.js

const SOUNDS = [
  { id: 'rain', name: 'Gentle Rain', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_9f9a6b9a2b.mp3?filename=rain-ambient-110564.mp3', description: 'Soft rain to help you relax.' },
  { id: 'ocean', name: 'Ocean Waves', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_3f2b6c6d6b.mp3?filename=ocean-waves-110163.mp3', description: 'Calming ocean waves.' },
  { id: 'white-noise', name: 'White Noise', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_af1d2d6c9b.mp3?filename=white-noise-110162.mp3', description: 'Steady white noise for focus and sleep.' },
];

const BEDTIME_TIPS = [
  'Keep screens away 30 minutes before bed — blue light affects sleep.',
  'Maintain a regular sleep schedule, even on weekends.',
  'Use a short relaxation or breathing exercise before bed.',
  'Make your bedroom cool, quiet, and dark for better sleep quality.',
  'Limit caffeine after 2 PM and heavy meals right before bedtime.',
  'Try a light walk earlier in the evening to burn off extra energy.',
  'Write down any worries in a journal to clear your mind before bed.',
  'Use a comfortable pillow and mattress that support proper posture.',
];

function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function SleepRelaxationWidget() {
  const { sleepData, setSleepData } = useContext(AppDataContext);
  const [sessions, setSessions] = useState(sleepData || []);
  const [runningSession, setRunningSession] = useState(null);
  const [goalHours, setGoalHours] = useState(8);
  const [selectedSound, setSelectedSound] = useState(SOUNDS[0].id);
  const [volume, setVolume] = useState(0.5);
  const [isLoop, setIsLoop] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);
  const audioRef = useRef(null);

  // Sync with context (persist automatically)
  useEffect(() => setSleepData(sessions), [sessions, setSleepData]);

  // Timer for current session
  useEffect(() => {
    const timer = setInterval(() => {
      if (runningSession) setRunningSession((rs) => ({ ...rs }));
    }, 1000);
    return () => clearInterval(timer);
  }, [runningSession]);

  // Audio settings
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.loop = isLoop;
    }
  }, [volume, isLoop, selectedSound]);

  // Session functions
  const startSession = () => {
    if (runningSession) return;
    setRunningSession({ id: `s_${Date.now()}`, start: Date.now() });
  };

  const stopSession = () => {
    if (!runningSession) return;
    const end = Date.now();
    const elapsed = end - runningSession.start;
    const newSession = { id: runningSession.id, start: runningSession.start, end, duration: elapsed };
    setSessions((s) => [newSession, ...s].slice(0, 200));
    setRunningSession(null);
  };

  const clearHistory = () => {
    if (!window.confirm('Clear all sleep history? This cannot be undone.')) return;
    setSessions([]);
  };

  const totalSleepMs = () =>
    sessions.reduce((acc, s) => acc + (s.duration || (s.end - s.start || 0)), 0) + (runningSession ? Date.now() - runningSession.start : 0);

  const averageSessionMs = () =>
    sessions.length === 0 ? 0 : Math.round(sessions.reduce((a, b) => a + (b.duration || (b.end - b.start || 0)), 0) / sessions.length);

  // Audio controls
  const togglePlaySound = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play();
    else audioRef.current.pause();
  };

  const handleSelectSound = (id) => {
    setSelectedSound(id);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
      }
    }, 120);
  };

  const shuffleTip = () => setTipIndex(Math.floor(Math.random() * BEDTIME_TIPS.length));

  const totalMs = totalSleepMs();
  const avgMs = averageSessionMs();
  const goalMs = goalHours * 60 * 60 * 1000;
  const progress = Math.min(100, Math.round((totalMs / goalMs) * 100));
  const selectedSoundObj = SOUNDS.find((s) => s.id === selectedSound) || SOUNDS[0];

  return (
    <Container style={{ marginTop: '6rem' }}>
      <h2 className="mb-3">Sleep & Relaxation Aid 🌙</h2>
      <Row>
        {/* Left: Tracker */}
        <Col md={6}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Sleep Tracker</Card.Title>
              <p>Track your sleep sessions and goals.</p>
              <div className="d-flex gap-2 mb-3">
                <Button onClick={startSession} disabled={!!runningSession} variant="primary">Start</Button>
                <Button onClick={stopSession} disabled={!runningSession} variant="danger">Stop</Button>
                <Button onClick={clearHistory} variant="outline-secondary" className="ms-auto">Clear History</Button>
              </div>

              <p><strong>Current Session:</strong> {runningSession ? formatDuration(Date.now() - runningSession.start) : '—:—:—'}</p>
              <p><strong>Total:</strong> {formatDuration(totalMs)} | <strong>Average:</strong> {formatDuration(avgMs)}</p>

              <Form.Group className="mb-3">
                <Form.Label>Sleep Goal (hours)</Form.Label>
                <Form.Control type="number" min={1} max={24} value={goalHours} onChange={(e) => setGoalHours(Number(e.target.value))} style={{ width: "100px" }} />
                <ProgressBar now={progress} label={`${progress}%`} className="mt-2" />
              </Form.Group>

              <h6>Recent Sessions</h6>
              <ListGroup style={{ maxHeight: "150px", overflowY: "auto" }}>
                {sessions.length === 0 && <ListGroup.Item>No past sessions yet.</ListGroup.Item>}
                {sessions.map((s) => (
                  <ListGroup.Item key={s.id}>
                    <div>{new Date(s.start).toLocaleString()} - {new Date(s.end).toLocaleString()}</div>
                    <div><strong>{formatDuration(s.duration)}</strong></div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>

        {/* Right: Sounds & Tips */}
        <Col md={6}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Soothing Sounds</Card.Title>
              <div className="mb-2">
                {SOUNDS.map((snd) => (
                  <Button
                    key={snd.id}
                    variant={selectedSound === snd.id ? "primary" : "outline-primary"}
                    size="sm"
                    className="me-2 mb-2"
                    onClick={() => handleSelectSound(snd.id)}
                  >
                    {snd.name}
                  </Button>
                ))}
              </div>

              <div className="d-flex align-items-center gap-2 mb-2">
                <Button onClick={togglePlaySound}>Play / Pause</Button>
                <Form.Label className="mb-0">Volume</Form.Label>
                <Form.Range min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
                <Form.Check type="checkbox" label="Loop" checked={isLoop} onChange={(e) => setIsLoop(e.target.checked)} />
              </div>

              <small className="text-muted">{selectedSoundObj.description}</small>
              <audio ref={audioRef} controls className="w-100 mt-2">
                <source src={selectedSoundObj.url} type="audio/mpeg" />
              </audio>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <Card.Title>Bedtime Tips</Card.Title>
              <p>{BEDTIME_TIPS[tipIndex]}</p>
              <Button size="sm" variant="outline-secondary" onClick={shuffleTip}>Shuffle</Button>
              <Button size="sm" variant="outline-dark" className="ms-2"
                onClick={() => alert(BEDTIME_TIPS.map((t, i) => `${i + 1}. ${t}`).join('\n'))}>
                View All Tips
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Mini Stats */}
      <Row className="mt-4">
        <Col>
          <Card className="text-center"><Card.Body><h6>Total Sleep</h6><div>{formatDuration(totalMs)}</div></Card.Body></Card>
        </Col>
        <Col>
          <Card className="text-center"><Card.Body><h6>Sessions</h6><div>{sessions.length}</div></Card.Body></Card>
        </Col>
        <Col>
          <Card className="text-center"><Card.Body><h6>Average</h6><div>{formatDuration(avgMs)}</div></Card.Body></Card>
        </Col>
      </Row>
    </Container>
  );
}
