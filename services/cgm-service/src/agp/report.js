// @ts-nocheck

const ExcelJS = require("exceljs");
const { DateTime } = require("luxon");
const {
  TIMEZONE,
  AGP_MIN_DAYS,
  AGP_MAX_DAYS,
  AGP_MIN_ACTIVE_PERCENT,
} = require("../config");
const { getReadingsRange } = require("../db");
const {
  PROFILES,
  GOALS,
  round,
  computeMetrics,
  evaluateStandardMetrics,
  buildAgpCurve,
  buildDailySeries,
} = require("./metrics");
const {
  renderTimeInRanges,
  renderAgpChart,
  renderDailyProfiles,
} = require("./chart");
const { AppError } = require("../errors");

const FONT = "Arial";
const NAVY = "FF1F3F6B";
const BLUE = "FF2F6EBA";
const GRAY_BG = "FFF2F2F2";
const GRAY_TXT = "FF595959";
const LINE = "FFBFBFBF";
const ROW_PX = 20; // 15pt default row height

function sectionHeader(ws, row, from, to, text) {
  ws.mergeCells(`${from}${row}:${to}${row}`);
  const c = ws.getCell(`${from}${row}`);
  c.value = text;
  c.font = { name: FONT, size: 11, color: { argb: "FF404040" } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY_BG } };
  c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 22;
}

function infoLine(ws, row, from, to, text) {
  ws.mergeCells(`${from}${row}:${to}${row}`);
  ws.getCell(`${from}${row}`).value = {
    richText: [
      {
        text: "ⓘ  ",
        font: { name: FONT, size: 10, bold: true, color: { argb: BLUE } },
      },
      { text, font: { name: FONT, size: 10, color: { argb: "FF404040" } } },
    ],
  };
  ws.getCell(`${from}${row}`).alignment = { vertical: "middle", indent: 1 };
}

function addImage(wb, ws, img, colOffset, rowIndex, maxWidth) {
  const id = wb.addImage({ buffer: img.buffer, extension: "png" });
  const scale = maxWidth ? Math.min(1, maxWidth / img.width) : 1;
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  ws.addImage(id, {
    tl: { col: colOffset, row: rowIndex },
    ext: { width, height },
  });
  return Math.ceil(height / ROW_PX);
}

function buildWorkbook({
  metrics,
  profile,
  profileKey,
  start,
  endExclusive,
  daysWithData,
  curve,
  daily,
  patientName,
  standardRows,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GlucoMind";
  wb.created = new Date();

  const ws = wb.addWorksheet("AGP Report", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 15 },
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  });
  for (let i = 1; i <= 10; i++) ws.getColumn(i).width = 13;

  const lastDay = endExclusive.minus({ days: 1 });
  const fmt = "ccc dd LLL yyyy";

  // title
  ws.mergeCells("A1:J1");
  ws.getCell("A1").value = "Ambulatory glucose profile (AGP) report";
  ws.getCell("A1").font = {
    name: FONT,
    size: 20,
    bold: true,
    color: { argb: NAVY },
  };
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value =
    `${start.toFormat(fmt)} - ${lastDay.toFormat(fmt)} (${metrics.periodDays} days)`;
  ws.getCell("A2").font = { name: FONT, size: 11, color: { argb: BLUE } };
  if (patientName) {
    ws.mergeCells("G2:J2");
    ws.getCell("G2").value = `Patient: ${patientName}`;
    ws.getCell("G2").font = { name: FONT, size: 11, color: { argb: GRAY_TXT } };
    ws.getCell("G2").alignment = { horizontal: "right" };
  }

  // warnings
  const warnings = [];
  if (metrics.activePercent < AGP_MIN_ACTIVE_PERCENT) {
    warnings.push(
      `Only ${round(metrics.activePercent)}% of sensor data was captured (minimum ${AGP_MIN_ACTIVE_PERCENT}% recommended for reliable analysis).`,
    );
  }
  ws.mergeCells("A3:J3");
  ws.getCell("A3").value = warnings.join(" ");
  ws.getCell("A3").font = {
    name: FONT,
    size: 10,
    bold: true,
    color: { argb: "FFC62828" },
  };
  ws.getCell("A3").alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(3).height = warnings.length ? 28 : 8;

  // time in ranges (left) + glucose metrics (right)
  sectionHeader(ws, 4, "A", "E", "Time in ranges");
  sectionHeader(ws, 4, "F", "J", "Glucose metrics");
  infoLine(ws, 5, "A", "E", "1% of time in ranges = about 15 min");

  const tirImg = renderTimeInRanges(metrics, profile);
  const tirRows = addImage(wb, ws, tirImg, 0.1, 5, 470);

  const put = (range, value, o = {}) => {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = value;
    cell.font = {
      name: FONT,
      size: o.size || 11,
      bold: !!o.bold,
      color: { argb: o.color || "FF262626" },
    };
    cell.alignment = {
      vertical: o.v || "middle",
      horizontal: o.h || "left",
      wrapText: !!o.wrap,
      indent: o.indent ?? 1,
    };
  };
  const topBorder = (row) => {
    for (const col of ["F", "G", "H", "I", "J"]) {
      ws.getCell(`${col}${row}`).border = {
        top: { style: "thin", color: { argb: LINE } },
      };
    }
  };

  put("F5:H5", "Time CGM active", { bold: true });
  put("I5:J5", `${round(metrics.activePercent)}%`);

  put("F6:H6", "Average glucose", { bold: true });
  put("F7:H7", `Goal: <${GOALS.meanGlucose} mg/dL`, {
    size: 10,
    color: GRAY_TXT,
  });
  put("I6:J7", `${Math.round(metrics.mean)} mg/dL`);

  put("F8:H8", "Glucose management indicator (GMI)", {
    bold: true,
    wrap: true,
  });
  put("F9:H9", `Goal: <${GOALS.gmi}%`, { size: 10, color: GRAY_TXT });
  put("I8:J9", `${round(metrics.gmi)}%`);

  put("F10:H10", "Glucose variability", { bold: true });
  put("F11:H11", "Defined as percent coefficient of variation", {
    size: 10,
    color: GRAY_TXT,
    wrap: true,
  });
  put("F12:H12", `Goal: <${GOALS.cv}%`, { size: 10, color: GRAY_TXT });
  put("I10:J12", `${round(metrics.cv)}%`);

  put("F13:J13", "Glucose ranges goals", { bold: true });
  put("F14:H14", `Target range ${profile.low}-${profile.high} mg/dL`, {
    size: 10,
    color: GRAY_TXT,
  });
  put("I14:J14", `>${profile.tirGoal}%`);
  put("F15:H15", `Above ${profile.high} mg/dL`, { size: 10, color: GRAY_TXT });
  put("I15:J15", `<${profile.tarGoal}%`);
  put("F16:H16", `Below ${profile.low} mg/dL`, { size: 10, color: GRAY_TXT });
  put("I16:J16", `<${profile.tbrGoal}%`);

  [5, 6, 8, 10, 13].forEach(topBorder);
  ws.getRow(8).height = 30;
  ws.getRow(11).height = 28;

  // AGP chart
  let row = Math.max(6 + tirRows, 17) + 1;
  sectionHeader(ws, row, "A", "J", "Ambulatory glucose profile (AGP)");
  row++;
  infoLine(
    ws,
    row,
    "A",
    "J",
    "AGP is a summary of glucose values from the report period, with median (50%) and other percentiles shown.",
  );
  row++;
  const agpImg = renderAgpChart(curve, profile);
  const agpRows = addImage(wb, ws, agpImg, 0.1, row - 1, 940);
  row += agpRows + 1;

  // daily profiles
  sectionHeader(ws, row, "A", "J", "Daily glucose profiles");
  row++;
  infoLine(
    ws,
    row,
    "A",
    "J",
    "Each daily profile represents a midnight-to-midnight period.",
  );
  row++;
  const dailyImg = renderDailyProfiles(daily, profile);
  const dailyRows = addImage(wb, ws, dailyImg, 0.1, row - 1, 940);
  row += dailyRows + 1;

  ws.mergeCells(`A${row}:J${row}`);
  ws.getCell(`A${row}`).value =
    `Target profile: ${profile.label}. Generated ${DateTime.now().setZone(TIMEZONE).toFormat("dd LLL yyyy HH:mm")} (${TIMEZONE}). ` +
    `GMI (%) = 3.31 + 0.02392 × mean glucose (mg/dL). CV (%) = SD / mean × 100.`;
  ws.getCell(`A${row}`).font = {
    name: FONT,
    size: 8,
    color: { argb: "FF7F7F7F" },
  };
  ws.getCell(`A${row}`).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(row).height = 24;

  /* ---------------- Metrics sheet ---------------- */
  const ms = wb.addWorksheet("Metrics", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 3 }],
  });
  ms.columns = [
    { key: "no", width: 6 },
    { key: "metric", width: 58 },
    { key: "value", width: 22 },
    { key: "target", width: 16 },
    { key: "perDay", width: 22 },
    { key: "status", width: 12 },
  ];
  ms.mergeCells("A1:F1");
  ms.getCell("A1").value = "Standardised CGM metrics for glucose control";
  ms.getCell("A1").font = {
    name: FONT,
    size: 14,
    bold: true,
    color: { argb: NAVY },
  };
  ms.mergeCells("A2:F2");
  ms.getCell("A2").value =
    `Profile: ${profile.label}  |  ${start.toFormat("dd LLL yyyy")} - ${lastDay.toFormat("dd LLL yyyy")}`;
  ms.getCell("A2").font = { name: FONT, size: 10, color: { argb: GRAY_TXT } };

  const head = ms.getRow(3);
  head.values = ["No.", "Metric", "Value", "Target", "Time per day", "Status"];
  head.eachCell((c) => {
    c.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  });
  head.height = 22;

  standardRows.forEach((r, i) => {
    const rr = ms.getRow(4 + i);
    rr.values = [
      r.no,
      r.metric,
      r.valueText,
      r.targetText,
      r.perDayText,
      r.status,
    ];
    rr.height = 20;
    rr.eachCell((c, col) => {
      c.font = { name: FONT, size: 10 };
      c.alignment = {
        vertical: "middle",
        horizontal: col === 1 ? "center" : "left",
        indent: col === 1 ? 0 : 1,
      };
      c.border = { bottom: { style: "thin", color: { argb: "FFE0E0E0" } } };
    });
    const s = rr.getCell(6);
    if (r.met === true) {
      s.font = {
        name: FONT,
        size: 10,
        bold: true,
        color: { argb: "FF2E7D32" },
      };
      s.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F5E9" },
      };
    }
    if (r.met === false) {
      s.font = {
        name: FONT,
        size: 10,
        bold: true,
        color: { argb: "FFC62828" },
      };
      s.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFDECEA" },
      };
    }
  });

  /* ---------------- AGP data sheet ---------------- */
  const ds = wb.addWorksheet("AGP Data", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ds.columns = [
    { header: "Time of day", key: "t", width: 14 },
    { header: "5th percentile (mg/dL)", key: "p5", width: 22 },
    { header: "25th percentile (mg/dL)", key: "p25", width: 22 },
    { header: "Median (mg/dL)", key: "p50", width: 16 },
    { header: "75th percentile (mg/dL)", key: "p75", width: 22 },
    { header: "95th percentile (mg/dL)", key: "p95", width: 22 },
  ];
  ds.getRow(1).eachCell((c) => {
    c.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
  curve.slice(0, -1).forEach((p) => {
    const hh = String(Math.floor(p.minute / 60)).padStart(2, "0");
    const mm = String(p.minute % 60).padStart(2, "0");
    const r = ds.addRow({
      t: `${hh}:${mm}`,
      p5: Math.round(p.p5),
      p25: Math.round(p.p25),
      p50: Math.round(p.p50),
      p75: Math.round(p.p75),
      p95: Math.round(p.p95),
    });
    r.eachCell((c) => {
      c.font = { name: FONT, size: 10 };
      c.alignment = { horizontal: "center" };
    });
  });

  return wb;
}

/**
 * Pure function: readings -> { buffer, filename, metrics }.
 */
async function buildReportFromReadings(readings, options = {}) {
  const profileKey = options.profile || "general";
  const profile = PROFILES[profileKey];
  if (!profile) {
    throw new AppError(
      `Unknown profile "${profileKey}". Use: ${Object.keys(PROFILES).join(", ")}`,
      "INVALID_PROFILE",
    );
  }

  const requestedDays = Math.floor(Number(options.days) || AGP_MIN_DAYS);
  const days = Math.min(AGP_MAX_DAYS, Math.max(AGP_MIN_DAYS, requestedDays));

  // period = `days` full midnight-to-midnight days, ending yesterday by default
  const endExclusive = options.endDate
    ? DateTime.fromJSDate(new Date(options.endDate), { zone: TIMEZONE })
        .startOf("day")
        .plus({ days: 1 })
    : DateTime.now().setZone(TIMEZONE).startOf("day");
  const start = endExclusive.minus({ days });

  const inPeriod = readings.filter(
    (r) =>
      r.timestamp >= start.toJSDate() && r.timestamp < endExclusive.toJSDate(),
  );

  const daily = buildDailySeries(inPeriod, start, days);
  const daysWithData = daily.filter((d) => d.points.length > 0).length;
  if (daysWithData < AGP_MIN_DAYS) {
    throw new AppError(
      `At least ${AGP_MIN_DAYS} days of CGM data are required to generate an AGP report (found ${daysWithData}).`,
      "INSUFFICIENT_DATA",
      { daysWithData, required: AGP_MIN_DAYS },
    );
  }

  const metrics = computeMetrics(inPeriod, start, endExclusive, profile);
  const curve = buildAgpCurve(inPeriod);
  const standardRows = evaluateStandardMetrics(metrics, profile, daysWithData);

  const wb = buildWorkbook({
    metrics,
    profile,
    profileKey,
    start,
    endExclusive,
    daysWithData,
    curve,
    daily,
    patientName: options.patientName,
    standardRows,
  });

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const filename = `AGP_Report_${start.toISODate()}_${endExclusive.minus({ days: 1 }).toISODate()}.xlsx`;
  return { buffer, filename, metrics, standardRows };
}

/**
 * Fetches readings (history + today) for a user and builds the report.
 * options: { days = 14 (14-90), endDate, profile = "general" | "highRisk" | "pregnancy", patientName }
 */
async function generateAgpReport(userId, options = {}) {
  const days = Math.min(
    AGP_MAX_DAYS,
    Math.max(AGP_MIN_DAYS, Math.floor(Number(options.days) || AGP_MIN_DAYS)),
  );
  const endExclusive = options.endDate
    ? DateTime.fromJSDate(new Date(options.endDate), { zone: TIMEZONE })
        .startOf("day")
        .plus({ days: 1 })
    : DateTime.now().setZone(TIMEZONE).startOf("day");
  const start = endExclusive.minus({ days });

  const readings = await getReadingsRange(
    userId,
    start.toJSDate(),
    endExclusive.toJSDate(),
  );
  return buildReportFromReadings(readings, options);
}

module.exports = { generateAgpReport, buildReportFromReadings };
