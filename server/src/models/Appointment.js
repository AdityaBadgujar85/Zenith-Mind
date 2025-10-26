import mongoose from "mongoose";

const PrescriptionSchema = new mongoose.Schema(
  {
    text: { type: String, default: "" },
  },
  { _id: false }
);

const AppointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    therapist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    startTime: { type: Date, required: true },
    durationMin: { type: Number, default: 30, min: 10, max: 60 },

    status: {
      type: String,
      enum: ["confirmed", "cancelled", "completed"],
      default: "confirmed",
    },

    spaceKey: { type: String }, // chat room key (optional)
    notes: { type: String, default: "" },

    // Zoom (optional; can be stubbed)
    zoomMeetingId: String,
    zoomJoinUrl: String,
    zoomStartUrl: String,
    zoomPassword: String,

    // Therapist completion data
    meetingLogs: { type: String, default: "" },
    prescription: { type: PrescriptionSchema, default: () => ({}) },
    completedAt: Date,
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.models.Appointment ||
  mongoose.model("Appointment", AppointmentSchema);
