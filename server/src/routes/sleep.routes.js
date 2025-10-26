// server/src/routes/sleep.routes.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createSleep,
  getAllSleep,
  deleteSleep,
  getWeeklyAverage,
  bulkUpsert,
} from "../controllers/sleepController.js";

const router = express.Router();

router.post("/", requireAuth, createSleep);
router.post("/bulk-upsert", requireAuth, bulkUpsert);

router.get("/", requireAuth, getAllSleep);
router.get("/weekly-average", requireAuth, getWeeklyAverage);

router.delete("/:id", requireAuth, deleteSleep);

export default router;
