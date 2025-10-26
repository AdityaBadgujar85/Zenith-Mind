import Appointment from "../models/Appointment.js";
import TherapistProfile from "../models/TherapistProfile.js";
import User from "../models/User.js";
import { createZoomMeeting } from "../services/zoom.js";

const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"];

function makeSpaceKey(therapistId, patientId) {
  return `space:t:${therapistId}:p:${patientId}`;
}

function toHHMM(date) {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}

function overlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** Check if requested [start, end) (UTC) fits therapist weekly availability (stored in HH:mm UTC windows) */
function isWithinAvailabilityUTC(profile, startISO, durationMin) {
  if (!profile?.availability) return false;
  const start = new Date(startISO);
  const end = addMinutes(start, durationMin);

  const dow = DAY_KEYS[start.getUTCDay()];
  const windows = profile.availability[dow] || [];
  if (!windows.length) return false;

  const sHHMM = toHHMM(start);
  const eHHMM = toHHMM(end);

  return windows.some(w => sHHMM >= w.from && eHHMM <= w.to);
}

/** Get all 30-min free slots (UTC) for one date (YYYY-MM-DD) */
async function computeAvailableSlots30m({ therapist, profile, dateStr }) {
  // Build all availability windows for that weekday
  const date = new Date(`${dateStr}T00:00:00.000Z`); // interpret as UTC date
  const dow = DAY_KEYS[date.getUTCDay()];
  const windows = (profile?.availability?.[dow] || []).slice();

  if (!windows.length) return [];

  // Load existing appts of the day (not cancelled)
  const dayStart = new Date(date);
  const dayEnd = new Date(date); dayEnd.setUTCHours(23,59,59,999);

  const appts = await Appointment.find({
    therapist: therapist._id,
    startTime: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ["pending", "confirmed", "completed"] },
  }).lean();

  // Build a set of conflicting half-hour spans
  const conflicts = appts.map(a => ({
    start: new Date(a.startTime),
    end: addMinutes(new Date(a.startTime), a.durationMin || 30),
  }));

  // For each window, step by 30 mins and check overlaps + end within window
  const slots = [];
  windows.forEach(w => {
    const [fh, fm] = w.from.split(":").map(Number);
    const [th, tm] = w.to.split(":").map(Number);

    let cur = new Date(date);
    cur.setUTCHours(fh, fm, 0, 0);
    const winEnd = new Date(date);
    winEnd.setUTCHours(th, tm, 0, 0);

    while (addMinutes(cur, 30) <= winEnd) {
      const s = new Date(cur);
      const e = addMinutes(s, 30);

      // overlap with existing?
      const hasConflict = conflicts.some(c => overlap(s, e, c.start, c.end));
      if (!hasConflict) {
        slots.push(s.toISOString());
      }
      cur = addMinutes(cur, 30);
    }
  });

  return slots;
}

/** Public: list discoverable therapists; show even without profile but only if accepting */
export async function listTherapists(_req, res) {
  const therapists = await User.find({
    role: "therapist",
    isActive: true,
    isApprovedTherapist: true,
  })
    .select("_id name email role isActive isApprovedTherapist")
    .lean();

  if (therapists.length === 0) return res.json({ items: [] });

  const ids = therapists.map((t) => t._id);
  const profiles = await TherapistProfile.find({ user: { $in: ids } })
    .select("user zoomUserId specialties bio availability isAccepting timezone")
    .lean();

  const byId = new Map(profiles.map((p) => [String(p.user), p]));
  const items = therapists.map((u) => {
    const p = byId.get(String(u._id));
    return {
      user: u,
      zoomUserId: p?.zoomUserId || null,
      specialties: p?.specialties || [],
      bio: p?.bio || "",
      availability: p?.availability || {},
      timezone: p?.timezone || "UTC",
      isAccepting: p?.isAccepting ?? true,
    };
  });

  res.json({ items: items.filter((x) => x.isAccepting) });
}

/** Therapist GET own profile */
export async function getMyTherapistProfile(req, res) {
  const therapistUserId = req.user.id;
  const doc = await TherapistProfile.findOne({ user: therapistUserId }).lean();
  res.json(doc || {});
}

/** Therapist creates/updates profile (zoom email, availability, timezone, accepting) */
export async function upsertTherapistProfile(req, res) {
  const therapistUserId = req.user.id;
  const body = req.body || {};
  const doc = await TherapistProfile.findOneAndUpdate(
    { user: therapistUserId },
    {
      $set: {
        zoomUserId: body.zoomUserId,
        timezone: body.timezone || "UTC",
        specialties: body.specialties || [],
        bio: body.bio || "",
        availability: body.availability || {},
        isAccepting: body.isAccepting !== false,
      },
    },
    { new: true, upsert: true }
  );
  res.json(doc);
}

/** Slots (UTC ISO strings) for a given date (YYYY-MM-DD) */
export async function getTherapistSlots(req, res) {
  const { id } = req.params;
  const { date } = req.query; // YYYY-MM-DD
  if (!date) return res.status(400).json({ message: "date (YYYY-MM-DD) required" });

  const therapist = await User.findById(id).lean();
  if (!therapist || therapist.role !== "therapist" || !therapist.isActive || !therapist.isApprovedTherapist) {
    return res.status(404).json({ message: "Therapist not found" });
  }

  const profile = await TherapistProfile.findOne({ user: therapist._id }).lean();
  if (!profile?.isAccepting) return res.json({ slots: [] });

  const slots = await computeAvailableSlots30m({ therapist, profile, dateStr: date });
  res.json({ slots }); // array of ISO start times (each = 30 min)
}

/** User books an appointment -> validates against slots & overlaps */
export async function bookAppointment(req, res) {
  const patientId = req.user.id;
  let { therapistId, startTime, durationMin = 30, note } = req.body || {};
  if (!therapistId || !startTime) {
    return res.status(400).json({ message: "therapistId and startTime required" });
  }

  // Force 30 min sessions
  durationMin = 30;

  const therapist = await User.findById(therapistId).lean();
  if (!therapist || therapist.role !== "therapist" || !therapist.isApprovedTherapist || !therapist.isActive) {
    return res.status(400).json({ message: "Therapist not available" });
  }

  const profile = await TherapistProfile.findOne({ user: therapistId }).lean();
  if (!profile?.isAccepting) {
    return res.status(400).json({ message: "Therapist not accepting appointments" });
  }

  // Availability check (UTC)
  if (!isWithinAvailabilityUTC(profile, startTime, durationMin)) {
    return res.status(400).json({ message: "Requested time is outside therapist availability" });
  }

  // Overlap check
  const start = new Date(startTime);
  const end = addMinutes(start, durationMin);
  const conflict = await Appointment.findOne({
    therapist: therapistId,
    status: { $in: ["pending", "confirmed", "completed"] },
    $expr: {
      $and: [
        { $lt: ["$startTime", end] },
        { $gt: [{ $add: ["$startTime", { $multiply: ["$durationMin", 60000] }] }, start] },
      ],
    },
  }).lean();
  if (conflict) {
    return res.status(409).json({ message: "This slot has just been booked. Pick another." });
  }

  // Create meeting or stub (your existing createZoomMeeting handles real/stub)
  const startISO = new Date(startTime).toISOString();
  const topic = `Therapy: ${therapist.name || "Therapist"} x ${patientId}`;

  const zoomHost =
    profile?.zoomUserId ||
    process.env.ZOOM_FALLBACK_HOST_EMAIL ||
    therapist.email ||
    null;

  const zoom = await createZoomMeeting({
    therapistZoomUserId: zoomHost,
    topic,
    start_time: startISO,
    duration: durationMin,
    timezone: "UTC",
  });

  const spaceKey = makeSpaceKey(therapistId, patientId);
  const appt = await Appointment.create({
    patient: patientId,
    therapist: therapistId,
    startTime: startISO,
    durationMin,
    status: "confirmed",
    spaceKey,
    notes: note || "",
    zoomMeetingId: String(zoom.id),
    zoomJoinUrl: zoom.join_url,
    zoomStartUrl: zoom.start_url,
    zoomPassword: zoom.password,
  });

  try {
    req.io?.to?.(spaceKey)?.emit?.("appointmentCreated", appt);
  } catch {}

  res.json(appt);
}

/** Each side lists their appointments */
export async function myAppointments(req, res) {
  const role = req.user.role;
  const me = req.user.id;
  const filter = role === "therapist" ? { therapist: me } : { patient: me };
  const items = await Appointment.find(filter)
    .sort({ startTime: -1 })
    .populate("patient", "name email")
    .populate("therapist", "name email");
  res.json({ items });
}

/** Fetch single appointment (for view summary) */
export async function getAppointment(req, res) {
  const { id } = req.params;
  const doc = await Appointment.findById(id)
    .populate("patient", "name email")
    .populate("therapist", "name email")
    .lean();
  if (!doc) return res.status(404).json({ message: "Not found" });

  const me = req.user.id;
  const isParty = String(doc.patient?._id || doc.patient) === me ||
                  String(doc.therapist?._id || doc.therapist) === me ||
                  req.user.role === "admin";
  if (!isParty) return res.status(403).json({ message: "Forbidden" });

  res.json(doc);
}

/** Cancel appointment: patient, therapist, or admin */
export async function cancelAppointment(req, res) {
  const { id } = req.params;
  const doc = await Appointment.findById(id);
  if (!doc) return res.status(404).json({ message: "Not found" });

  const me = req.user.id;
  const isParty = String(doc.patient) === me || String(doc.therapist) === me || req.user.role === "admin";
  if (!isParty) return res.status(403).json({ message: "Forbidden" });

  doc.status = "cancelled";
  await doc.save();
  res.json(doc);
}

/** Mark as completed WITH logs/prescription (therapist/admin only) */
export async function completeAppointment(req, res) {
  const { id } = req.params;
  const { logs, prescriptionText } = req.body || {};
  const doc = await Appointment.findById(id);
  if (!doc) return res.status(404).json({ message: "Not found" });

  const me = req.user.id;
  if (!(String(doc.therapist) === me || req.user.role === "admin")) {
    return res.status(403).json({ message: "Forbidden" });
  }

  doc.status = "completed";
  doc.meetingLogs = logs || "";
  doc.prescription = { text: prescriptionText || "" };
  await doc.save();
  res.json(doc);
}
