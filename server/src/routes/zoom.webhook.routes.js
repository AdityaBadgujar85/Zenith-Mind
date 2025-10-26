import { Router } from "express";
import Appointment from "../models/Appointment.js"; // <-- must end with .js (ESM)

const router = Router();

function verify(req) {
  const token = process.env.ZOOM_WEBHOOK_TOKEN || "";
  const hdr   = req.headers["authorization"] || "";
  return token && hdr === `Bearer ${token}`;
}

router.post("/zoom/webhook", async (req, res) => {
  if (!verify(req)) return res.status(401).send("unauthorized");

  const event   = req.body?.event;
  const meeting = req.body?.payload?.object;

  try {
    if (event === "meeting.started" && meeting?.id) {
      await Appointment.findOneAndUpdate(
        { zoomMeetingId: String(meeting.id) },
        { $set: { status: "confirmed" } }
      );
    }
    if (event === "meeting.ended" && meeting?.id) {
      await Appointment.findOneAndUpdate(
        { zoomMeetingId: String(meeting.id) },
        { $set: { status: "completed" } }
      );
    }
  } catch (e) {
    console.error("[zoom webhook] error:", e.message);
  }

  res.json({ received: true });
});

export default router;
