import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import MoodEntry from "../models/MoodEntry.js";
import SleepLog from "../models/SleepLog.js";
import JournalEntry from "../models/JournalEntry.js";

const router = express.Router();

router.get("/summary", auth, async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);

  const [moods, sleeps, journals] = await Promise.all([
    MoodEntry.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$mood", count: { $sum: 1 }, avgIntensity: { $avg: "$intensity" } } }
    ]),
    SleepLog.aggregate([
      { $match: { user: userId } },
      { $project: { duration: { $divide: [{ $subtract: ["$end", "$start"] }, 3600000] }, quality: 1 } },
      { $group: { _id: null, avgHours: { $avg: "$duration" }, avgQuality: { $avg: "$quality" } } }
    ]),
    JournalEntry.countDocuments({ user: userId })
  ]);

  res.json({
    moods,
    sleep: sleeps[0] || { avgHours: 0, avgQuality: 0 },
    journalCount: journals
  });
});

export default router;
