import { Router } from "express";
import * as authController from "./auth.controller";
import rateLimit from "express-rate-limit";

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", otpLimiter, authController.register);
router.post("/otp/request", otpLimiter, authController.requestOtp);
router.post("/otp/verify", otpLimiter, authController.verifyOtp);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

export default router;
