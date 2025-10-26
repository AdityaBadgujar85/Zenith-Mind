import express from "express";
import { submitScore, getLeaderboard, getMyHistory } from "../controllers/wordScramble.controller.js";
// import { requireAuth } from "../middleware/auth.js"; // enable if you want auth-only endpoints

const router = express.Router();

// Public
router.get("/leaderboard", getLeaderboard);

// Save a score (public by default; add requireAuth if you want)
router.post("/score", submitScore);

// Personal history (only useful if you wire requireAuth)
// router.get("/me/history", requireAuth, getMyHistory);
router.get("/me/history", getMyHistory);

export default router;
    