// server/src/routes/activity.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  whoAmI,
  syncActivity,
  getSummary,
  getRewards,
} from "../controllers/activity.controller.js";

const router = Router();

/** All /api/activity/* endpoints require auth */
router.use(requireAuth);

/** Simple check to see the authenticated user payload */
router.get("/me", whoAmI);

/** Upsert daily snapshots (steps/minutes) for the user */
router.post("/sync", syncActivity);

/** Get daily rows for the last N days (default 30), ascending by dateKey */
router.get("/summary", getSummary);

/** Compute streak/points/progress for challenge window (default 30) */
router.get("/rewards", getRewards);

export default router;
