import express from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import ChatSession from "../models/ChatSession.js";

const router = express.Router();

router.post("/session", auth, async (req, res) => {
  const { title } = req.body;
  const session = await ChatSession.create({ user: req.user.id, title, messages: [] });
  res.status(201).json(session);
});

const messageSchema = z.object({
  sessionId: z.string(),
  role: z.enum(["user","assistant"]),
  content: z.string().min(1)
});

router.post("/message", auth, async (req, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { sessionId, role, content } = parsed.data;

  const session = await ChatSession.findOne({ _id: sessionId, user: req.user.id });
  if (!session) return res.status(404).json({ message: "Session not found" });

  session.messages.push({ role, content });
  await session.save();

  // Placeholder: integrate LLM call here if desired.
  res.json(session);
});

router.get("/session/:id", auth, async (req, res) => {
  const session = await ChatSession.findOne({ _id: req.params.id, user: req.user.id });
  if (!session) return res.status(404).json({ message: "Not found" });
  res.json(session);
});

router.get("/sessions", auth, async (req, res) => {
  const list = await ChatSession.find({ user: req.user.id }).sort({ updatedAt: -1 });
  res.json(list);
});

export default router;
