// mailer.ts — outbound email (weekly digests, and any future
// transactional email) via Resend's HTTP API.
//
// This replaces an earlier SMTP-based implementation (nodemailer).
// SMTP was the likely cause of the weekly digest silently failing to
// deliver in production: Render (like many PaaS hosts) blocks or
// restricts outbound traffic on the SMTP ports (25/465/587), and its
// containers are frequently IPv6-only or IPv6-preferred, which several
// SMTP providers don't handle cleanly. An HTTP API call over 443 sidesteps
// both problems entirely — it's indistinguishable from any other outbound
// API request the server already makes (e.g. to MongoDB Atlas).
//
// Configured entirely via env vars so no credentials live in source:
//
//   RESEND_API_KEY, EMAIL_FROM
//
// If these aren't set (e.g. a fresh dev checkout with no mail account
// wired up yet), sendMail() logs a warning and resolves without
// throwing — the rest of the app (scheduler, manual "send test digest"
// button) keeps working, it just won't actually deliver mail until
// email is configured.

import logger from "./logger.js";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface DigestAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

let warnedOnce = false;

function isConfigured(): boolean {
  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    if (!warnedOnce) {
      logger.warn(
        "Email not configured (RESEND_API_KEY/EMAIL_FROM missing) — " +
          "weekly digests will be skipped until these are set in .env. " +
          "Sign up at https://resend.com for a free API key."
      );
      warnedOnce = true;
    }
    return false;
  }
  return true;
}

export const sendMail = async (params: {
  to: string;
  subject: string;
  html: string;
  attachments?: DigestAttachment[];
}): Promise<boolean> => {
  if (!isConfigured()) return false;

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString("base64"),
        })),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.error(`Failed to send email to ${params.to}: HTTP ${response.status} ${errorBody}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${params.to}: ${(error as Error).message}`);
    return false;
  }
};
