import express from "express";
import { submitScore, getLeaderboard } from "../controllers/quickMath.controller.js";
// import { requireAuth } from "../middleware/auth.js"; // optional

const router = express.Router();

router.get("/leaderboard", getLeaderboard);
// router.post("/score", requireAuth, submitScore); // if you want only signed-in
router.post("/score", submitScore);

export default router;
