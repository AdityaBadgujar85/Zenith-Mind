// src/routes/therapist.auth.routes.js
import { Router } from "express";
import User from "../models/User.js";
import TherapistProfile from "../models/TherapistProfile.js";
import { signAuthToken } from "../utils/jwt.js";

const router = Router();

/* THERAPIST SIGNUP */
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: "Email already registered" });

  const t = await User.create({
    name,
    email,
    password,
    role: "therapist",
    isActive: true,             // allow login
    isApprovedTherapist: true,  // approve for testing; flip to false if you need admin approval
  });

  // Auto-create a profile with isAccepting = true so they are listed
  await TherapistProfile.findOneAndUpdate(
    { user: t._id },
    { $setOnInsert: { isAccepting: true } },
    { upsert: true }
  );

  const token = signAuthToken(t);
  res.json({
    token,
    user: {
      _id: t._id,
      name: t.name,
      email: t.email,
      role: "therapist",
      isActive: t.isActive,
      isApprovedTherapist: t.isApprovedTherapist,
    },
  });
});

/* THERAPIST LOGIN */
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email, role: "therapist" }).select("+password");
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  if (!(await user.matchPassword(password))) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  if (!user.isActive) return res.status(403).json({ message: "Account deactivated" });
  if (!user.isApprovedTherapist)
    return res.status(403).json({ message: "Awaiting admin approval" });

  const token = signAuthToken(user);
  res.json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: "therapist",
      isActive: user.isActive,
      isApprovedTherapist: user.isApprovedTherapist,
    },
  });
});

export default router;
