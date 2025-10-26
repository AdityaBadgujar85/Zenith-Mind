// utils/jwt.js
import jwt from "jsonwebtoken";

/** Sign a JWT using the user's actual role (do not force 'admin') */
export function signAuthToken(user) {
  return jwt.sign(
    { id: user._id, role: String(user.role || "user").toLowerCase() },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}
