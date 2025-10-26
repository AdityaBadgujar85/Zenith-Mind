import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getCatalog,
  upsertDay,
  getDay,
  listRange,
  removeDay,
} from "../controllers/nutrition.controller.js";

const router = express.Router();

// Catalog (normalized food list). You may keep this public or protected.
router.get("/catalog", getCatalog);

// All log routes are protected
router.use(requireAuth);

// POST /api/nutrition    { date, items?, recipe? }  -> upsert/replace
router.post("/", upsertDay);

// GET /api/nutrition?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/", listRange);

// GET /api/nutrition/:date
router.get("/:date", getDay);

// DELETE /api/nutrition/:date
router.delete("/:date", removeDay);

export default router;
