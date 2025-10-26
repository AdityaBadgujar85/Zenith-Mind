// server/src/models/stressEntry.model.js
import mongoose from "mongoose";

const HabitSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
    streak: { type: Number, default: 0 },
    lastDone: { type: String, default: "" }, // YYYY-MM-DD
  },
  { _id: false }
);

const ManualStressItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    intensity: { type: Number, min: 1, max: 10, required: true },
    category: { type: String, default: "Other" },
  },
  { _id: false }
);

const NoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    category: { type: String, default: "Other" },
    stressIndex: { type: Number, min: 0, max: 100, default: 0 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * One document per user+date (YYYY-MM-DD).
 * Holds manual tracker (triggers+habits) and GF day data (index+notes+habits).
 */
const StressEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    manual: {
      stress: { type: [ManualStressItemSchema], default: [] },
      habits: { type: [HabitSchema], default: [] },
    },
    gf: {
      stressIndex: { type: Number, min: 0, max: 100 },
      notes: { type: [NoteSchema], default: [] },
      habits: { type: [HabitSchema], default: [] },
    },
  },
  { timestamps: true }
);

StressEntrySchema.index({ user: 1, date: 1 }, { unique: true });

const StressEntry =
  mongoose.models.StressEntry || mongoose.model("StressEntry", StressEntrySchema);

export default StressEntry;
