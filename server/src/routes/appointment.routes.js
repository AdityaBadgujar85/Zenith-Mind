import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listTherapists,
  getMyTherapistProfile,
  upsertTherapistProfile,
  getTherapistSlots,
  bookAppointment,
  myAppointments,
  getAppointment,
  cancelAppointment,
  completeAppointment,
} from "../controllers/appointment.controller.js";

const router = Router();

// Public directory of therapists
router.get("/therapists/public", listTherapists);

// Therapist profile (self)
router.get("/therapists/profile", requireAuth, requireRole("therapist", "admin"), getMyTherapistProfile);
router.post("/therapists/profile", requireAuth, requireRole("therapist", "admin"), upsertTherapistProfile);

// Available 30-min slots (UTC) on a date
router.get("/therapists/:id/slots", requireAuth, getTherapistSlots);

// User books an appointment (30 mins)
router.post("/book", requireAuth, requireRole("user", "admin"), bookAppointment);

// Lists (either side)
router.get("/my", requireAuth, myAppointments);

// Read single appointment
router.get("/:id", requireAuth, getAppointment);

// Cancel appointment
router.patch("/:id/cancel", requireAuth, cancelAppointment);

// Mark done + save logs/prescription (therapist/admin)
router.patch("/:id/complete", requireAuth, requireRole("therapist", "admin"), completeAppointment);

export default router;
