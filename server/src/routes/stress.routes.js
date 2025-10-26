import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { upsertDay, listRange, getDay, removeDay } from "../controllers/stress.controller.js";

const router = express.Router();

/** All Stress endpoints require a valid JWT; req.user is set by requireAuth */
router.use(requireAuth);

// POST /api/stress  {date, manual?, gf?}
router.post("/", upsertDay);

// GET /api/stress?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/", listRange);

// GET /api/stress/:date
router.get("/:date", getDay);

// DELETE /api/stress/:date
router.delete("/:date", removeDay);

export default router;
