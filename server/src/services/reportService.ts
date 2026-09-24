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

export interface MonthlyStatementData {
  periodStart: Date;
  periodEnd: Date;
  categories: { category: string; kWh: number; costKES: number }[];
  totalKWh: number;
  totalCostKES: number;
  tariffBand: string;
  tariffRateKESPerKWh: number;
  monthlyBudgetKES?: number;
  percentOfBudget?: number;
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

/**
 * Month-to-date itemized statement — reads more like an actual utility
 * bill than the weekly summary: a billing period, a per-category cost
 * breakdown (not just kWh), and the tariff rate actually applied.
 * Kenya Power's bands apply one rate to a household's *entire* monthly
 * usage rather than stepping per unit, so the same resolved band's rate
 * is used to cost out every category rather than resolving a separate
 * band per category.
 */
async function buildMonthlyStatementData(userId: string, monthlyBudgetKES?: number): Promise<MonthlyStatementData> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const userObjectId = new Types.ObjectId(userId);

  const categoryRows = await Telemetry.aggregate([
    { $match: { user: userObjectId, timestamp: { $gte: periodStart, $lte: now } } },
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
  ]);

  const totalKWh = categoryRows.reduce((sum, r) => sum + (r.kWh as number), 0);
  const band = resolveTariffBand(totalKWh);

  const categories = categoryRows.map((row) => {
    const kWh = row.kWh as number;
    return {
      category: CATEGORY_LABELS[row._id as string] || row._id,
      kWh,
      costKES: kWh * band.rateKESPerKWh,
    };
  });

  const statement: MonthlyStatementData = {
    periodStart,
    periodEnd: now,
    categories,
    totalKWh,
    totalCostKES: totalKWh * band.rateKESPerKWh,
    tariffBand: band.label,
    tariffRateKESPerKWh: band.rateKESPerKWh,
  };

  if (monthlyBudgetKES && monthlyBudgetKES > 0) {
    statement.monthlyBudgetKES = monthlyBudgetKES;
    statement.percentOfBudget = (statement.totalCostKES / monthlyBudgetKES) * 100;
  }

  return statement;
}

function renderDigestHTML(user: Pick<IUser, "username">, data: WeeklyReportData, statement: MonthlyStatementData): string {
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

  const statementRows = statement.categories
    .map(
      (c) => `<tr>
        <td style="padding:6px 0;color:#183B27;">${c.category}</td>
        <td style="padding:6px 0;text-align:right;color:#183B27;">${c.kWh.toFixed(1)} kWh</td>
        <td style="padding:6px 0;text-align:right;color:#183B27;">KSh ${c.costKES.toFixed(0)}</td>
      </tr>`
    )
    .join("");

  const statementBudgetLine =
    statement.monthlyBudgetKES && statement.percentOfBudget !== undefined
      ? `<div style="color:#4A6858;font-size:13px;margin-top:8px;">
           ${statement.percentOfBudget.toFixed(0)}% of your KSh ${statement.monthlyBudgetKES.toFixed(0)} monthly budget used so far.
         </div>`
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

      <hr style="border:none;border-top:1px solid #D9E5DC;margin:24px 0;" />

      <h3 style="color:#0A5C36;margin-bottom:2px;font-size:16px;">Month-to-Date Statement</h3>
      <p style="color:#4A6858;font-size:13px;margin-top:0;">
        ${dateFmt(statement.periodStart)} – ${dateFmt(statement.periodEnd)}
      </p>

      ${
        statement.categories.length > 0
          ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">
               <tr style="border-bottom:1px solid #D9E5DC;">
                 <td style="padding:6px 0;color:#4A6858;font-size:12px;">CATEGORY</td>
                 <td style="padding:6px 0;text-align:right;color:#4A6858;font-size:12px;">USAGE</td>
                 <td style="padding:6px 0;text-align:right;color:#4A6858;font-size:12px;">COST</td>
               </tr>
               ${statementRows}
             </table>`
          : `<p style="color:#4A6858;font-size:14px;">No telemetry recorded this month yet.</p>`
      }

      <div style="display:flex;justify-content:space-between;border-top:2px solid #0A5C36;margin-top:8px;padding-top:8px;font-weight:700;color:#0A5C36;">
        <span>Total (${statement.tariffBand} tariff, KSh ${statement.tariffRateKESPerKWh.toFixed(2)}/kWh)</span>
        <span>KSh ${statement.totalCostKES.toFixed(0)}</span>
      </div>
      ${statementBudgetLine}

      <p style="color:#8AA396;font-size:11px;margin-top:24px;">
        A detailed PDF summary is attached. You can turn off these emails anytime from your Settings page.
      </p>
    </div>
  `;
}

function generateDigestPDF(user: Pick<IUser, "username">, data: WeeklyReportData, statement: MonthlyStatementData): Promise<Buffer> {
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

    // ── Month-to-Date Statement ──────────────────────────────────
    doc.moveDown(1.2);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#D9E5DC")
      .stroke();
    doc.moveDown(0.8);

    doc.fontSize(16).fillColor("#0A5C36").text("Month-to-Date Statement");
    doc.fontSize(10).fillColor("#4A6858").text(`${dateFmt(statement.periodStart)} - ${dateFmt(statement.periodEnd)}`);
    doc.moveDown(0.8);

    if (statement.categories.length > 0) {
      const colX = { category: 50, usage: 320, cost: 430 };
      doc.fontSize(9).fillColor("#4A6858");
      doc.text("CATEGORY", colX.category, doc.y, { continued: false });
      doc.text("USAGE", colX.usage, doc.y - 11, { width: 100, align: "right" });
      doc.text("COST", colX.cost, doc.y - 11, { width: 100, align: "right" });
      doc.moveDown(0.4);

      statement.categories.forEach((c) => {
        const rowY = doc.y;
        doc.fontSize(11).fillColor("#183B27");
        doc.text(c.category, colX.category, rowY, { width: 260 });
        doc.text(`${c.kWh.toFixed(1)} kWh`, colX.usage, rowY, { width: 100, align: "right" });
        doc.text(`KSh ${c.costKES.toFixed(0)}`, colX.cost, rowY, { width: 100, align: "right" });
        doc.moveDown(0.5);
      });
    } else {
      doc.fontSize(11).fillColor("#4A6858").text("No telemetry recorded this month yet.", 50, doc.y, { width: 495 });
    }

    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#0A5C36")
      .lineWidth(1.5)
      .stroke();
    doc.moveDown(0.4);

    doc
      .fontSize(12)
      .fillColor("#0A5C36")
      .text(`Total (${statement.tariffBand} tariff, KSh ${statement.tariffRateKESPerKWh.toFixed(2)}/kWh): KSh ${statement.totalCostKES.toFixed(0)}`, 50, doc.y, { width: 495 });

    if (statement.monthlyBudgetKES && statement.percentOfBudget !== undefined) {
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .fillColor("#4A6858")
        .text(`${statement.percentOfBudget.toFixed(0)}% of your KSh ${statement.monthlyBudgetKES.toFixed(0)} monthly budget used so far.`, 50, doc.y, { width: 495 });
    }

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
  const statement = await buildMonthlyStatementData(user._id.toString(), user.monthlyBudgetKES);
  const html = renderDigestHTML(user, data, statement);
  const pdf = await generateDigestPDF(user, data, statement);

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
