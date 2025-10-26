// server/src/models/ActivityDay.js
import mongoose from "mongoose";

const activityDaySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    dateKey: { type: String, required: true }, // "YYYY-MM-DD" (Asia/Kolkata by default)
    steps: { type: Number, default: 0 },
    minutes: { type: Number, default: 0 },     // exercise minutes (guided + Google Fit)
    qualifies: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    meta: {
      tz: { type: String, default: "Asia/Kolkata" },
      computedAt: { type: Date, default: Date.now },
      source: { type: String, default: "client-sync" }, // or "server-recompute"
    },
  },
  { timestamps: true }
);

activityDaySchema.index({ user: 1, dateKey: 1 }, { unique: true });

export default mongoose.model("ActivityDay", activityDaySchema);
