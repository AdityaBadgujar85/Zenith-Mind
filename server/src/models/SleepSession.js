import mongoose from "mongoose";

const sleepSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    start: Date,
    end: Date,
    duration: Number,
    quality: Number,
    source: { type: String, enum: ["timer", "googlefit"], default: "timer" },
    soundId: String,
  },
  { timestamps: true }
);

export default mongoose.models.SleepSession ||
  mongoose.model("SleepSession", sleepSessionSchema);
