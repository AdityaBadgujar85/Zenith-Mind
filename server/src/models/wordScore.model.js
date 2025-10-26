import mongoose from "mongoose";

const WordScoreSchema = new mongoose.Schema(
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

// High scores first; tie-break by bestStreak, then newest
WordScoreSchema.index({ score: -1, bestStreak: -1, createdAt: -1 });

const WordScore =
  mongoose.models.WordScore || mongoose.model("WordScore", WordScoreSchema);

export default WordScore;
