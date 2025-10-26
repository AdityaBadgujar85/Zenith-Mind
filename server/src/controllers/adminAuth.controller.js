import jwt from "jsonwebtoken";
import User from "../models/User.js";

const sign = (user) =>
  jwt.sign(
    { id: user._id, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

// SIGNUP
export async function adminSignup(req, res, next) {
  try {
    const { name, email, password, inviteCode } = req.body || {};
    const code = inviteCode || req.query.code || "";

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });
    if (code !== (process.env.ADMIN_INVITE_CODE || ""))
      return res.status(401).json({ message: "Invalid admin invite code" });

    const exists = await User.findOne({ email: email.toLowerCase() }).lean();
    if (exists)
      return res.status(409).json({ message: "Email already registered" });

    const admin = await User.create({
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      password,
      role: "admin",
      isActive: true,
      isVerified: true,
    });

    const token = sign(admin);
    res.status(201).json({ token, user: admin });
  } catch (err) {
    next(err);
  }
}

// LOGIN
export async function adminLogin(req, res, next) {
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

    const token = sign(user);
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
}
