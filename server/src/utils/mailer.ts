// mailer.ts — nodemailer transporter for outbound email (weekly digests,
// and any future transactional email). Configured entirely via env vars
// so no SMTP credentials live in source:
//
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// If these aren't set (e.g. a fresh dev checkout with no mail account
// wired up yet), sendMail() logs a warning and resolves without
// throwing — the rest of the app (scheduler, manual "send test digest"
// button) keeps working, it just won't actually deliver mail until SMTP
// is configured.

import nodemailer, { type Transporter } from "nodemailer";
import logger from "./logger.js";

export interface DigestAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

let transporter: Transporter | null = null;
let warnedOnce = false;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    if (!warnedOnce) {
      logger.warn(
        "Email not configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS missing) — " +
          "weekly digests will be skipped until these are set in .env."
      );
      warnedOnce = true;
    }
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

export const sendMail = async (params: {
  to: string;
  subject: string;
  html: string;
  attachments?: DigestAttachment[];
}): Promise<boolean> => {
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    });
    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${params.to}: ${(error as Error).message}`);
    return false;
  }
};
