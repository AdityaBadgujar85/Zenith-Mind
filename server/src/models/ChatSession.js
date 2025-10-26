import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user","assistant","system"], required: true },
    content: { type: String, required: true },
    meta: Object
  },
  { _id: false, timestamps: false }
);

const chatSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: String,
    messages: [messageSchema]
  },
  { timestamps: true }
);

export default mongoose.model("ChatSession", chatSessionSchema);
