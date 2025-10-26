import express from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import JournalEntry from "../models/JournalEntry.js";

const router = express.Router();

const createSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  labels: z.array(z.string()).optional()
});

router.post("/", auth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const doc = await JournalEntry.create({ user: req.user.id, ...parsed.data });
  res.status(201).json(doc);
});

router.get("/", auth, async (req, res) => {
  const docs = await JournalEntry.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json(docs);
});

router.put("/:id", auth, async (req, res) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const updated = await JournalEntry.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    parsed.data,
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json(updated);
});

router.delete("/:id", auth, async (req, res) => {
  const del = await JournalEntry.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!del) return res.status(404).json({ message: "Not found" });
  res.json({ ok: true });
});

export default router;
