// middleware/auth.js
import jwt from "jsonwebtoken";

/** Extract bearer token from Authorization header, cookie 'token', or x-access-token */
function getToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  if (req.cookies?.token) return req.cookies.token;
  if (req.headers["x-access-token"]) return String(req.headers["x-access-token"]);
  return null;
}

const normRole = (r) => String(r || "user").toLowerCase();

/** Safely pick a uid from common JWT claim names */
function pickUserId(decoded) {
  // Common places people put user ids in JWTs:
  //  - id (your current usage)
  //  - _id (Mongo)
  //  - sub (JWT standard subject)
  //  - userId (some SDKs)
  return (
    decoded?.id ||
    decoded?._id ||
    decoded?.sub ||
    decoded?.userId ||
    null
  );
}

/** Require a valid JWT; attaches a *normalized* req.user with both id and _id set */
export function requireAuth(req, res, next) {
  if (req.method === "OPTIONS") return next();

  const token = getToken(req);
  if (!token) return res.status(401).json({ ok: false, message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { clockTolerance: 5 });

    const uid = String(pickUserId(decoded) || "");
    if (!uid) {
      return res.status(401).json({ ok: false, message: "Token missing user id (id/_id/sub/userId)" });
    }

    const role =
      normRole(decoded?.role) ||
      normRole(Array.isArray(decoded?.roles) ? decoded.roles[0] : decoded?.roles) ||
      "user";

    req.user = {
      id: uid,          // always present
      _id: uid,         // convenience for Mongo code paths
      role,
      email: decoded?.email || null,
      imp: !!decoded?.imp,
      jti: decoded?.jti || null,
      iat: decoded?.iat,
      exp: decoded?.exp,
      raw: decoded,     // optional: helpful during debugging
    };

    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid or expired token" });
  }
}

/** Gate by role(s). If none passed, any authenticated user is allowed. */
export function requireRole(...roles) {
  const want = roles.map(normRole);
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ ok: false, message: "Unauthenticated" });
    if (want.length && !want.includes(role)) {
      return res.status(403).json({
        ok: false,
        message: "Forbidden: insufficient role",
        yourRole: role,
        needOneOf: want,
      });
    }
    next();
  };
}

/** Allow if the path param/user matches OR caller has one of the roles */
export function requireSelfOrRole(paramKey = "id", ...roles) {
  const want = roles.map(normRole);
  return (req, res, next) => {
    const caller = req.user?.id;
    const role = req.user?.role;
    const target = String(req.params?.[paramKey] || req.body?.[paramKey] || "");
    if (!caller) return res.status(401).json({ ok: false, message: "Unauthenticated" });
    if (target && caller === target) return next();
    if (want.length > 0 && want.includes(role)) return next();
    return res.status(403).json({
      ok: false,
      message: "Forbidden: need self or elevated role",
      yourRole: role,
      target,
      needOneOf: want,
    });
  };
}

/** Helper if you want a single source of truth elsewhere */
export function getReqUserId(req) {
  return req?.user?._id || req?.user?.id || null;
}

export default requireAuth;
