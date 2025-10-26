import React, { useState, useEffect, useRef } from "react";
import { Container, Row, Col, Button, Form, Card, ListGroup, Badge } from "react-bootstrap";
import { io } from "socket.io-client";
import styles from "./Community.module.css";

// ✅ Connect globally to backend server only once
const socket = io(process.env.REACT_APP_BACKEND_URL || "http://localhost:7000", {
  transports: ["websocket"],
});

function Community() {
  const groups = [
    "Mindful Chat",
    "Stress Relief",
    "Daily Motivation",
    "Sleep Support",
    "Anxiety Help",
    "Positive Vibes",
    "Focus Boosters",
    "Mood Uplifters",
    "Wellness Warriors",
    "Calm Circle",
  ];

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [onlineCount, setOnlineCount] = useState(0);
  const [username, setUsername] = useState("");

  const joinedGroups = useRef(new Set());
  const messagesEndRef = useRef(null);

  // ✅ Scroll to bottom when new message arrives
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ✅ Ask for username once
  useEffect(() => {
    const saved = localStorage.getItem("chat_username");
    if (saved) {
      setUsername(saved);
    } else {
      const name = prompt("Enter your display name (only once):");
      if (name && name.trim() !== "") {
        const clean = name.trim();
        localStorage.setItem("chat_username", clean);
        setUsername(clean);
      } else {
        alert("You must enter a valid name to use community chat.");
      }
    }
  }, []);

  // ✅ Setup socket listeners
  useEffect(() => {
    socket.on("loadMessages", (msgs) => setMessages(msgs));
    socket.on("newMessage", (msg) => setMessages((prev) => [...prev, msg]));
    socket.on("onlineUsers", (count) => setOnlineCount(count));
    socket.on("groupFull", (msg) => alert(msg));

    return () => {
      socket.off("loadMessages");
      socket.off("newMessage");
      socket.off("onlineUsers");
      socket.off("groupFull");
    };
  }, []);

  // ✅ Join group only once
  useEffect(() => {
    if (!selectedGroup || !username) return;
    if (joinedGroups.current.has(selectedGroup)) return;

    socket.emit("joinGroup", { group: selectedGroup, username });
    joinedGroups.current.add(selectedGroup);

    const interval = setInterval(() => {
      socket.emit("getOnlineUsers", { group: selectedGroup });
    }, 3000);

    return () => {
      clearInterval(interval);
      socket.emit("leaveGroup", { group: selectedGroup });
      joinedGroups.current.delete(selectedGroup);
    };
  }, [selectedGroup, username]);

  // ✅ Send message
  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedGroup) return;

    const msg = {
      group: selectedGroup,
      sender: username,
      text: input,
      time: new Date().toISOString(),
    };

    socket.emit("sendMessage", msg);
    setInput("");
  };

  if (!username) {
    return (
      <Container className="text-center mt-5">
        <h4>You must enter a valid name to access the community chat.</h4>
        <p>Refresh the page and provide your name when prompted.</p>
      </Container>
    );
  }

  return (
    <Container fluid className={styles.communityContainer}>
      <Row>
        {/* Sidebar */}
        <Col md={3} className={styles.sidebar}>
          <h5 className="mb-3 text-center">Community Groups</h5>
          <ListGroup>
            {groups.map((group, i) => (
              <ListGroup.Item
                key={i}
                action
                active={selectedGroup === group}
                onClick={() => setSelectedGroup(group)}
                className="d-flex justify-content-between align-items-center"
              >
                <span>{group}</span>
                <Badge bg="secondary">100 max</Badge>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Col>

        {/* Chat Area */}
        <Col md={9}>
          {selectedGroup ? (
            <Card className="p-3 shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="m-0">{selectedGroup} Chat</h5>
                <Badge bg="info">{onlineCount} Online</Badge>
              </div>

              {/* Chat messages */}
              <div className={styles.chatBox}>
                {messages.length === 0 ? (
                  <p className="text-muted">No messages yet. Start the conversation!</p>
                ) : (
                  messages.map((msg, i) => {
                    const isMine = msg.sender === username;
                    return (
                      <div
                        key={i}
                        className={`${styles.messageContainer} ${
                          isMine ? styles.myContainer : styles.otherContainer
                        }`}
                      >
                        <div
                          className={`${styles.messageBubble} ${
                            isMine ? styles.myMessage : styles.otherMessage
                          }`}
                        >
                          {!isMine && <strong className={styles.sender}>{msg.sender}</strong>}
                          <div>{msg.text}</div>
                          <span className={styles.time}>
                            {new Date(msg.time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input box */}
              <Form className="d-flex mt-2" onSubmit={handleSend}>
                <Form.Control
                  type="text"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <Button type="submit" className="ms-2">
                  Send
                </Button>
              </Form>
            </Card>
          ) : (
            <p className="text-muted mt-4 text-center">
              Select a community group to start chatting.
            </p>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default Community;
