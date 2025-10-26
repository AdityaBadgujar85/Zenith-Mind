// server/src/models/sleepLog.model.js
import mongoose from "mongoose";

const sleepLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    start: { type: Date, required: true, index: true },
    end:   { type: Date, required: true, index: true },
    duration: { type: Number, required: true }, // ms
    quality: { type: Number, min: 1, max: 10 },
    notes: { type: String, default: "" },
    soundId: { type: String, default: "" },
    source: { type: String, enum: ["timer", "googlefit"], default: "timer" },
  },
  { timestamps: true }
);

// Ensure “one session per user per (start,end)”
sleepLogSchema.index({ userId: 1, start: 1, end: 1 }, { unique: true });

const SleepLog = mongoose.models.SleepLog || mongoose.model("SleepLog", sleepLogSchema);
export default SleepLog;
