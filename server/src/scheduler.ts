// scheduler.ts — runs the weekly email digest job.
// Fires every Monday at 07:00 Africa/Nairobi for every user who hasn't
// opted out (weeklyDigestEnabled: true, the default). Each user is sent
// independently with its own try/catch so one bad address or a transient
// SMTP hiccup doesn't stop the rest of the batch.

import cron from "node-cron";
import { User } from "./models/User.js";
import { sendWeeklyDigest } from "./services/reportService.js";
import logger from "./utils/logger.js";

export const startWeeklyDigestScheduler = (): void => {
  // Cron: minute hour day-of-month month day-of-week → 07:00 every Monday
  cron.schedule(
    "0 7 * * 1",
    async () => {
      logger.info("Running weekly digest job...");
      const users = await User.find({ weeklyDigestEnabled: true });

      let sentCount = 0;
      for (const user of users) {
        try {
          const sent = await sendWeeklyDigest(user);
          if (sent) sentCount++;
        } catch (error) {
          logger.error(`Weekly digest failed for ${user.email}: ${(error as Error).message}`);
        }
      }

      logger.info(`Weekly digest job complete: ${sentCount}/${users.length} sent.`);
    },
    { timezone: "Africa/Nairobi" }
  );

  logger.info("Weekly digest scheduler registered (Mondays 07:00 Africa/Nairobi).");
};
