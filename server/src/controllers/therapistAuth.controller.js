import jwt from "jsonwebtoken";
import User from "../models/User.js";

const sign = (user) =>
  jwt.sign(
    { id: user._id, role: "therapist" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

// SIGNUP
export async function therapistSignup(req, res, next) {
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const exists = await User.findOne({ email: email.toLowerCase() }).lean();
    if (exists)
      return res.status(409).json({ message: "Email already registered" });

    const therapist = await User.create({
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      password,
      role: "therapist",
      isActive: true,
      isVerified: true,
      isApprovedTherapist: false,
    });

    const token = sign(therapist);
    res.status(201).json({ token, user: therapist });
  } catch (err) {
    next(err);
  }
}

// LOGIN
export async function therapistLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({
      email: email.toLowerCase(),
      role: "therapist",
    }).select("+password");

    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await user.matchPassword(password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.isActive)
      return res.status(403).json({ message: "Account deactivated" });
    if (!user.isApprovedTherapist)
      return res.status(403).json({ message: "Awaiting admin approval" });

    const token = sign(user);
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
}
