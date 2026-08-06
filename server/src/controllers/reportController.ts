// reportController.ts
import type { Request, Response, NextFunction } from "express";
import { User } from "../models/User.js";
import { sendWeeklyDigest } from "../services/reportService.js";
import { isMailConfigured } from "../utils/mailer.js";

interface AuthRequest extends Request {
  user?: { id: string };
}

/**
 * MANUAL "SEND TEST DIGEST NOW"
 * POST /api/reports/weekly/send-now
 * Lets a user trigger their own weekly digest on demand — useful to
 * confirm SMTP is configured correctly and see what the email looks like
 * without waiting for Monday.
 */
export const sendDigestNow = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const sent = await sendWeeklyDigest(user);

    if (!sent) {
      // sendWeeklyDigest -> sendMail collapses "not configured" and
      // "configured but the actual send failed" into the same boolean,
      // by design (so the scheduler can skip quietly when nothing's set
      // up yet). Check config directly here so the user sees the right
      // message instead of "not configured" when SMTP genuinely is set
      // but the send itself errored (bad creds, wrong port, host
      // unreachable, etc.) — check the server logs for the specific
      // nodemailer error in that case, logged by mailer.ts's sendMail.
      const error = isMailConfigured()
        ? "SMTP is configured but sending failed. Check the server logs for the specific error (auth, connection, or TLS/port issue)."
        : "Email is not configured on the server yet (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS), so nothing was sent.";
      return res.status(503).json({ success: false, error });
    }

    res.status(200).json({ success: true, message: `Digest sent to ${user.email}` });
  } catch (error) {
    next(error);
  }
};

/**
 * SET WEEKLY DIGEST PREFERENCE
 * PATCH /api/reports/weekly/preference
 * Body: { weeklyDigestEnabled: boolean }
 */
export const setDigestPreference = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { weeklyDigestEnabled } = req.body as { weeklyDigestEnabled: boolean };

    const user = await User.findByIdAndUpdate(userId, { weeklyDigestEnabled }, { new: true }).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.status(200).json({ success: true, data: { weeklyDigestEnabled: user.weeklyDigestEnabled } });
  } catch (error) {
    next(error);
  }
};
