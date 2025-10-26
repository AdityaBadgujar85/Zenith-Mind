// server/src/models/ExerciseSession.js
import mongoose from "mongoose";

const exerciseSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    title: { type: String, default: "Guided Session" },
    source: { type: String, default: "guided" }, // e.g., "guided" | "fit" | "manual"
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    minutes: { type: Number, default: 0 },
    dateKey: { type: String, index: true }, // "YYYY-MM-DD"
  },
  { timestamps: true }
);

// convenience: keep dateKey in sync
exerciseSessionSchema.pre("save", function (next) {
  if (!this.dateKey && this.startedAt) {
    const tz = "Asia/Kolkata";
    this.dateKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(this.startedAt));
  }
  if (!this.minutes && this.startedAt && this.endedAt) {
    const ms = new Date(this.endedAt).getTime() - new Date(this.startedAt).getTime();
    if (!Number.isNaN(ms) && ms > 0) this.minutes = Math.round(ms / 60000);
  }
  next();
});

export default mongoose.models.ExerciseSession
  || mongoose.model("ExerciseSession", exerciseSessionSchema);
