import mongoose from "mongoose";

const DaySlotSchema = new mongoose.Schema(
  { from: { type: String, required: true }, to: { type: String, required: true } }, // "HH:mm"
  { _id: false }
);

const TherapistProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    zoomUserId: { type: String },                       // Host email/userId in Zoom account
    timezone: { type: String, default: "UTC" },         // IANA tz (kept for future), treated as UTC for v1
    specialties: [String],
    bio: String,
    availability: {
      mon: [DaySlotSchema],
      tue: [DaySlotSchema],
      wed: [DaySlotSchema],
      thu: [DaySlotSchema],
      fri: [DaySlotSchema],
      sat: [DaySlotSchema],
      sun: [DaySlotSchema],
    },
    isAccepting: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.TherapistProfile ||
  mongoose.model("TherapistProfile", TherapistProfileSchema);
