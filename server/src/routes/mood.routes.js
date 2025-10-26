import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listMood,
  upsertMood,
  deleteMood,
  deleteAllMood,
  importMood,
} from "../controllers/moodController.js";

const router = Router();

// All mood endpoints are user-scoped via JWT
router.get("/", requireAuth, listMood);
router.post("/", requireAuth, upsertMood);
router.delete("/all", requireAuth, deleteAllMood);
router.post("/import", requireAuth, importMood);
router.delete("/:id", requireAuth, deleteMood);

export default router;
