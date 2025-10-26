import mongoose from "mongoose";

const exerciseSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, index: true },
    title: { type: String, required: true },
    type: { type: String, enum: ["cbt","mindfulness","breathing","education"], required: true },
    steps: [{ prompt: String, hint: String }],
    difficulty: { type: String, enum: ["easy","medium","hard"], default: "easy" }
  },
  { timestamps: true }
);

export default mongoose.model("Exercise", exerciseSchema);
