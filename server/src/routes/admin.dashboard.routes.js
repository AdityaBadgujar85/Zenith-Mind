// routes/adminDashboard.routes.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getAdminStats,
  listUsers,
  toggleUserField,
  approveTherapist,
  impersonateUser,
} from "../controllers/adminDashboard.controller.js";

const router = Router();

// All these endpoints require admin
router.get("/stats", requireAuth, requireRole("admin"), getAdminStats);
router.get("/users", requireAuth, requireRole("admin"), listUsers);
router.post("/users/:id/toggle", requireAuth, requireRole("admin"), toggleUserField);
router.post("/therapists/:id/approve", requireAuth, requireRole("admin"), approveTherapist);
router.post("/impersonate/:id", requireAuth, requireRole("admin"), impersonateUser);

export default router;
