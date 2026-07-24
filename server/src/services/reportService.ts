// reportService.ts
// Builds the weekly usage/cost/anomaly summary for a user, renders it as
// an HTML email body plus a PDF attachment, and sends it via mailer.ts.
// Used by both the Monday-morning scheduler (scheduler.ts) and the
// manual "send test digest now" endpoint (reportController.ts).

import PDFDocument from "pdfkit";
import { Types } from "mongoose";
import { Telemetry } from "../models/Telemetry.js";
import { Prediction } from "../models/Prediction.js";
import type { IUser } from "../types/User.d.js";
import { estimateEnergyChargeKES, resolveTariffBand } from "../config/tariff.js";
import { sendMail } from "../utils/mailer.js";
import { CATEGORY_LABELS } from "../utils/categoryLabels.js";
import logger from "../utils/logger.js";

export interface WeeklyReportData {
  weekStart: Date;
  weekEnd: Date;
  totalKWh: number;
  estimatedCostKES: number;
  tariffBand: string;
  categories: { category: string; kWh: number }[];
  anomaliesDetected: number;
  monthlyBudgetKES?: number;
  monthProjectedKES?: number;
}

async function buildWeeklyReportData(userId: string, monthlyBudgetKES?: number): Promise<WeeklyReportData> {
  const weekEnd = new Date();
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 7);

  const userObjectId = new Types.ObjectId(userId);

  const [categoryRows, anomaliesDetected] = await Promise.all([
    Telemetry.aggregate([
      { $match: { user: userObjectId, timestamp: { $gte: weekStart, $lte: weekEnd } } },
      {
        $lookup: {
          from: "devices",
          localField: "device",
          foreignField: "_id",
          as: "deviceInfo",
        },
      },
      { $unwind: "$deviceInfo" },
      { $group: { _id: "$deviceInfo.category", kWh: { $sum: "$kWh" } } },
      { $sort: { kWh: -1 } },
    ]),
    Prediction.countDocuments({
      user: userObjectId,
      type: "anomaly",
      timestamp: { $gte: weekStart, $lte: weekEnd },
    }),
  ]);

  const categories = categoryRows.map((row) => ({
    category: CATEGORY_LABELS[row._id as string] || row._id,
    kWh: row.kWh as number,
  }));

  const totalKWh = categories.reduce((sum, c) => sum + c.kWh, 0);
  const band = resolveTariffBand(totalKWh);
  const estimatedCostKES = estimateEnergyChargeKES(totalKWh);

  const data: WeeklyReportData = {
    weekStart,
    weekEnd,
    totalKWh,
    estimatedCostKES,
    tariffBand: band.label,
    categories,
    anomaliesDetected,
  };

  if (monthlyBudgetKES && monthlyBudgetKES > 0) {
    // Rough month-to-date projection for context in the digest — a
    // lighter-weight version of budgetService's forecast, since the
    // digest only needs the headline number, not the full breakdown.
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();

    const [monthResult] = await Telemetry.aggregate([
      { $match: { user: userObjectId, timestamp: { $gte: monthStart, $lte: now } } },
      { $group: { _id: null, totalKWh: { $sum: "$kWh" } } },
    ]);
    const monthToDateKWh = monthResult?.totalKWh || 0;
    const projectedMonthlyKWh = daysElapsed > 0 ? (monthToDateKWh / daysElapsed) * daysInMonth : 0;

    data.monthlyBudgetKES = monthlyBudgetKES;
    data.monthProjectedKES = estimateEnergyChargeKES(projectedMonthlyKWh);
  }

  return data;
}

function renderDigestHTML(user: Pick<IUser, "username">, data: WeeklyReportData): string {
  const dateFmt = (d: Date) => d.toLocaleDateString("en-KE", { month: "short", day: "numeric" });

  const categoryRows = data.categories
    .map(
      (c) => `<tr>
        <td style="padding:6px 0;color:#183B27;">${c.category}</td>
        <td style="padding:6px 0;text-align:right;color:#183B27;">${c.kWh.toFixed(1)} kWh</td>
      </tr>`
    )
    .join("");

  const budgetLine = data.monthlyBudgetKES
    ? `<p style="color:#4A6858;font-size:14px;">
         This month is projected at <strong>KSh ${data.monthProjectedKES?.toFixed(0)}</strong>
         against your KSh ${data.monthlyBudgetKES.toFixed(0)} budget.
       </p>`
    : "";

  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="color:#0A5C36;margin-bottom:4px;">Your SEMP Weekly Digest</h2>
      <p style="color:#4A6858;font-size:13px;margin-top:0;">
        ${dateFmt(data.weekStart)} – ${dateFmt(data.weekEnd)}
      </p>
      <p style="color:#183B27;font-size:15px;">Hi ${user.username}, here's how your week looked:</p>

      <div style="background:#E4EDE7;border-radius:10px;padding:16px;margin:16px 0;">
        <div style="font-size:26px;font-weight:700;color:#0A5C36;">${data.totalKWh.toFixed(1)} kWh</div>
        <div style="color:#4A6858;font-size:13px;">
          ≈ KSh ${data.estimatedCostKES.toFixed(0)} at the ${data.tariffBand} tariff
        </div>
      </div>

      ${
        data.categories.length > 0
          ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">${categoryRows}</table>`
          : `<p style="color:#4A6858;font-size:14px;">No telemetry recorded this week.</p>`
      }

      ${budgetLine}

      <p style="color:#4A6858;font-size:14px;">
        ${
          data.anomaliesDetected > 0
            ? `${data.anomaliesDetected} anomal${data.anomaliesDetected === 1 ? "y was" : "ies were"} flagged this week — check your dashboard for details.`
            : `No anomalies flagged this week.`
        }
      </p>

      <p style="color:#8AA396;font-size:11px;margin-top:24px;">
        A detailed PDF summary is attached. You can turn off these emails anytime from your Profile page.
      </p>
    </div>
  `;
}

function generateDigestPDF(user: Pick<IUser, "username">, data: WeeklyReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const dateFmt = (d: Date) => d.toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });

    doc.fontSize(20).fillColor("#0A5C36").text("SEMP Weekly Digest", { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor("#4A6858").text(`${dateFmt(data.weekStart)} - ${dateFmt(data.weekEnd)}  |  ${user.username}`);
    doc.moveDown(1);

    doc.fontSize(28).fillColor("#0A5C36").text(`${data.totalKWh.toFixed(1)} kWh`);
    doc.fontSize(11).fillColor("#4A6858").text(`Estimated cost: KSh ${data.estimatedCostKES.toFixed(0)} (${data.tariffBand} tariff)`);
    doc.moveDown(1);

    if (data.categories.length > 0) {
      doc.fontSize(13).fillColor("#183B27").text("Usage by category");
      doc.moveDown(0.3);
      data.categories.forEach((c) => {
        doc.fontSize(11).fillColor("#183B27").text(`${c.category}: ${c.kWh.toFixed(1)} kWh`);
      });
      doc.moveDown(1);
    }

    if (data.monthlyBudgetKES) {
      doc
        .fontSize(11)
        .fillColor("#4A6858")
        .text(`This month is projected at KSh ${data.monthProjectedKES?.toFixed(0)} against a KSh ${data.monthlyBudgetKES.toFixed(0)} budget.`);
      doc.moveDown(1);
    }

    doc
      .fontSize(11)
      .fillColor("#4A6858")
      .text(
        data.anomaliesDetected > 0
          ? `${data.anomaliesDetected} anomaly/anomalies flagged this week.`
          : "No anomalies flagged this week."
      );

    doc.end();
  });
}

/**
 * Build, render, and send the weekly digest for a single user.
 * Returns false (without throwing) if mail isn't configured or the
 * user has no email/opted out — callers can decide whether that's
 * worth logging at their level (the scheduler logs a batch summary;
 * the manual "send now" endpoint surfaces it to the user directly).
 */
export const sendWeeklyDigest = async (user: IUser): Promise<boolean> => {
  const data = await buildWeeklyReportData(user._id.toString(), user.monthlyBudgetKES);
  const html = renderDigestHTML(user, data);
  const pdf = await generateDigestPDF(user, data);

  const sent = await sendMail({
    to: user.email,
    subject: `Your SEMP Weekly Digest — ${data.totalKWh.toFixed(1)} kWh this week`,
    html,
    attachments: [
      {
        filename: `semp-weekly-digest-${data.weekEnd.toISOString().slice(0, 10)}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  if (!sent) {
    logger.warn(`Weekly digest not sent for ${user.email} (mail not configured or send failed)`);
  }

  return sent;
};
