import mongoose from "mongoose";

const QuickMathScoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // optional
    name: { type: String, required: true, trim: true, maxlength: 64 },
    score: { type: Number, required: true, min: 0 },
    bestStreak: { type: Number, required: true, min: 0 },
    ip: { type: String, default: "" },
    ua: { type: String, default: "" },
  },
  { timestamps: true }
);

// High score first, then best streak, then newest
QuickMathScoreSchema.index({ score: -1, bestStreak: -1, createdAt: -1 });

const QuickMathScore =
  mongoose.models.QuickMathScore || mongoose.model("QuickMathScore", QuickMathScoreSchema);

export default QuickMathScore;
