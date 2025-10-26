// routes/auth.routes.js
import { Router } from "express";
import User from "../models/User.js";
import { signAuthToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/** REGISTER — POST /api/auth/register */
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(400).json({ message: "Email already registered" });

  const user = await User.create({
    name: name || email.split("@")[0],
    email: email.toLowerCase(),
    password,
    role: "user",
    isActive: true,
    isApprovedTherapist: false,
  });

  const token = signAuthToken(user);
  res.json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: "user",
      isActive: user.isActive,
    },
  });
});

/** LOGIN — POST /api/auth/login */
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const ok = await user.matchPassword(password);
  if (!ok) return res.status(400).json({ message: "Invalid credentials" });

  if (!user.role) user.role = "user"; // preserve your previous fallback

  const token = signAuthToken(user);
  res.json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: String(user.role).toLowerCase(),
      isActive: user.isActive,
    },
  });
});

/** Optional: general WHOAMI — GET /api/auth/whoami */
router.get("/whoami", requireAuth, async (req, res) => {
  const me = await User.findById(req.user.id)
    .select("_id name email role isActive isVerified createdAt updatedAt");
  if (!me) return res.status(404).json({ message: "User not found" });
  res.json({ user: me });
});

export default router;
