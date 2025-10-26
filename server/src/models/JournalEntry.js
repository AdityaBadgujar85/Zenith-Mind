import mongoose from "mongoose";

const journalEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    labels: [String]
  },
  { timestamps: true }
);

export default mongoose.model("JournalEntry", journalEntrySchema);
