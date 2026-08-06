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
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import dns from "node:dns";
import logger from "./logger.js";

// Render's outbound network can't route the IPv6 address Node resolves
// first for hosts like smtp.gmail.com (ENETUNREACH), even though IPv4
// to the same host works fine. nodemailer doesn't expose a typed way to
// force IPv4 per-connection, so set it at the Node DNS-resolver level
// instead — affects this process's lookups generally, which is fine
// here since nothing in this app depends on IPv6 connectivity.
dns.setDefaultResultOrder("ipv4first");

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

  const options: SMTPTransport.Options = {
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  };
  transporter = nodemailer.createTransport(options);

  return transporter;
}

export function isMailConfigured(): boolean {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
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
