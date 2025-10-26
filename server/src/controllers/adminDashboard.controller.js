// controllers/adminDashboard.controller.js
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

const toInt = (x, d = 25) => {
  const n = parseInt(x, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : d;
};

export async function getAdminStats(_req, res) {
  try {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalUsers, active24h, therapists, pendingTherapistApprovals] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ updatedAt: { $gte: since24h } }),
      User.countDocuments({ role: "therapist" }),
      User.countDocuments({ role: "therapist", isApprovedTherapist: false }),
    ]);

    res.json({
      totalUsers,
      active24h,
      therapists,
      pendingTherapistApprovals,
      sessionsToday: 0,
      avgSessionLen: 0,
      ticketsOpen: 0,
      ticketsSLA: 0,
      flags: [
        { key: "sleep_v2", on: true },
        { key: "cbt_stream", on: false },
        { key: "therapist_bookings", on: true },
      ],
    });
  } catch (e) {
    console.error("[getAdminStats] error:", e);
    res.status(500).json({ message: "Failed to load stats" });
  }
}

export async function listUsers(req, res) {
  try {
    const limit = toInt(req.query.limit, 25);
    const role = (req.query.role || "").trim();
    const q = (req.query.q || "").trim();

    const filter = {};
    if (role && ["user", "therapist", "admin"].includes(role)) filter.role = role;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        ...(mongoose.isValidObjectId(q) ? [{ _id: new mongoose.Types.ObjectId(q) }] : []),
      ];
    }

    const items = await User.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("_id name email role isVerified isActive isApprovedTherapist createdAt updatedAt");

    res.json({ items });
  } catch (e) {
    console.error("[listUsers] error:", e);
    res.status(500).json({ message: "Failed to load users" });
  }
}

export async function toggleUserField(req, res) {
  try {
    const { id } = req.params;
    const { field } = req.body;
    const allowed = new Set(["isActive", "isVerified", "isApprovedTherapist"]);
    if (!allowed.has(field)) return res.status(400).json({ message: "Invalid field to toggle" });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user[field] = !user[field];
    await user.save();
    res.json(user);
  } catch (e) {
    console.error("[toggleUserField] error:", e);
    res.status(500).json({ message: "Failed to toggle field" });
  }
}

export async function approveTherapist(req, res) {
  try {
    const { id } = req.params;
    const doc = await User.findByIdAndUpdate(
      id,
      { $set: { isApprovedTherapist: true, isActive: true } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: "User not found" });
    res.json(doc);
  } catch (e) {
    console.error("[approveTherapist] error:", e);
    res.status(500).json({ message: "Failed to approve therapist" });
  }
}

export async function impersonateUser(req, res) {
  try {
    const { id } = req.params;
    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: "User not found" });

    const token = jwt.sign(
      { id: target._id, role: target.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: target });
  } catch (e) {
    console.error("[impersonateUser] error:", e);
    res.status(500).json({ message: "Failed to impersonate" });
  }
}
