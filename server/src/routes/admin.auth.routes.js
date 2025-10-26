// routes/adminAuth.routes.js
import { Router } from "express";
import User from "../models/User.js";
import { signAuthToken } from "../utils/jwt.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

/** ADMIN SIGNUP (invite code respected) — POST /api/admin/auth/signup */
router.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password, inviteCode } = req.body || {};
    const code = inviteCode || req.query.code || "";

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    if (code !== (process.env.ADMIN_INVITE_CODE || ""))
      return res.status(401).json({ message: "Invalid admin invite code" });

    const exists = await User.findOne({ email: email.toLowerCase() }).lean();
    if (exists) return res.status(409).json({ message: "Email already registered" });

    const admin = await User.create({
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      password,
      role: "admin",
      isActive: true,
      isVerified: true,
    });

    const token = signAuthToken(admin);
    res.status(201).json({
      token,
      user: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: "admin",
        isActive: admin.isActive,
        isVerified: admin.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** ADMIN LOGIN — POST /api/admin/auth/login */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({
      email: email.toLowerCase(),
      role: "admin",
    }).select("+password");

    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await user.matchPassword(password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.isActive)
      return res.status(403).json({ message: "Account deactivated" });

    const token = signAuthToken(user);
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: "admin",
        isActive: user.isActive,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Optional but harmless: ADMIN WHOAMI — GET /api/admin/auth/whoami */
router.get("/whoami", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const me = await User.findById(req.user.id)
      .select("_id name email role isActive isVerified createdAt updatedAt");
    if (!me || me.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    res.json({ user: me });
  } catch (e) {
    next(e);
  }
});

export default router;
