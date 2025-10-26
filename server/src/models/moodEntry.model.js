import mongoose from "mongoose";

const MoodEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** YYYY-MM-DD (local date key) */
    date: { type: String, required: true, index: true },
    /** 1..5 */
    mood: { type: Number, min: 1, max: 5, required: true },
    /** array of lowercase tags */
    tags: { type: [String], default: [] },
    /** optional free text */
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

/** One doc per user+date */
MoodEntrySchema.index({ user: 1, date: 1 }, { unique: true });

const MoodEntry =
  mongoose.models.MoodEntry || mongoose.model("MoodEntry", MoodEntrySchema);

export default MoodEntry;
