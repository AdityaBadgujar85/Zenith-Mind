// server/src/routes/users.routes.js
import express from "express";
import User from "../models/User.js";
import auth, { authorize } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/users/me
 * Return the authenticated user's public profile
 */
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select(
    "_id name username email role specialization isActive"
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    specialization: user.specialization || null,
    isActive: user.isActive,
  });
});

/**
 * PATCH /api/users/me
 * Update your own display fields
 */
router.patch("/me", auth, async (req, res) => {
  const allowed = ["name", "username", "specialization"];
  const updates = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

  if (updates.username) updates.username = String(updates.username).toLowerCase().trim();

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true,
  }).select("_id name username email role specialization isActive");

  res.json({
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    specialization: user.specialization || null,
    isActive: user.isActive,
  });
});

/**
 * GET /api/users/therapists
 * Public list of active therapists to book
 */
router.get("/therapists", async (_req, res) => {
  const therapists = await User.find({ role: "therapist", isActive: true }).select(
    "_id name username email specialization"
  );
  res.json(therapists);
});

/**
 * (Optional) GET /api/users/:id
 * Public profile (limited)
 */
router.get("/:id", async (req, res) => {
  const user = await User.findById(req.params.id).select(
    "_id name username role specialization"
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({
    id: user._id,
    name: user.name,
    username: user.username,
    role: user.role,
    specialization: user.specialization || null,
  });
});

/**
 * (Optional) Admin: list users
 * GET /api/users  (requires role=admin)
 */
router.get("/", auth, authorize("admin"), async (_req, res) => {
  const users = await User.find().select(
    "_id name username email role isActive createdAt"
  );
  res.json(users);
});

export default router;
