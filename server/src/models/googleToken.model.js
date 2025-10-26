import mongoose from "mongoose";

const GoogleTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true, unique: true },
    accessToken: String,
    refreshToken: String,
    expiryDate: Number,
    email: String,
    name: String,
    picture: String,
    scopes: [String],
  },
  { timestamps: true }
);

const GoogleToken =
  mongoose.models.GoogleToken || mongoose.model("GoogleToken", GoogleTokenSchema);

export default GoogleToken;
