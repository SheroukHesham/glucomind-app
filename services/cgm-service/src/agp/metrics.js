// @ts-nocheck
const { DateTime } = require("luxon");
const { TIMEZONE } = require("../../config");

/* Target profiles from the standardised CGM metrics guideline
   a = general T1/T2 population, b = older / high hypoglycaemia risk,
   c = pregnancy with type 1 diabetes */
const PROFILES = {
  general: {
    label: "General (type 1 / type 2)",
    veryLow: 54,
    low: 70,
    high: 180,
    veryHigh: 250,
    tirGoal: 70,
    tarGoal: 25,
    tar2Goal: 5,
    tbrGoal: 4,
    tbr2Goal: 1,
  },
  highRisk: {
    label: "Older / high hypoglycaemia risk",
    veryLow: 54,
    low: 70,
    high: 180,
    veryHigh: 250,
    tirGoal: 50,
    tarGoal: 50,
    tar2Goal: 10,
    tbrGoal: 1,
    tbr2Goal: 0,
  },
  pregnancy: {
    label: "Type 1 diabetes in pregnancy",
    veryLow: 54,
    low: 63,
    high: 140,
    veryHigh: 250,
    tirGoal: 70,
    tarGoal: 25,
    tar2Goal: null,
    tbrGoal: 4,
    tbr2Goal: 1,
  },
};

const GOALS = {
  gmi: 7,
  cv: 36,
  activePercent: 70,
  meanGlucose: Math.round((7 - 3.31) / 0.02392), // 154 mg/dL
};

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

function percentileSorted(sorted, p) {
  if (!sorted.length) return null;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function roundPercentagesTo100(values) {
  const floors = values.map(Math.floor);
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return floors;
  const remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder && k < order.length; k++) floors[order[k].i]++;
  return floors;
}

function formatDuration(minutes) {
  const total = Math.round(minutes);
  return `${Math.floor(total / 60)}h ${total % 60}min`;
}

function detectIntervalMinutes(readings) {
  if (readings.length < 2) return 5;
  const diffs = [];
  for (let i = 1; i < readings.length; i++) {
    const d = (readings[i].timestamp - readings[i - 1].timestamp) / 60000;
    if (d > 0 && d <= 30) diffs.push(d);
  }
  if (!diffs.length) return 5;
  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)];
  return Math.min(15, Math.max(1, median));
}

function computeMetrics(readings, start, endExclusive, profile) {
  const values = readings.map((r) => r.glucoseLevel);
  const n = values.length;

  const totalMinutes = endExclusive.diff(start, "minutes").minutes;
  const periodDays = Math.round(totalMinutes / 1440);
  const intervalMinutes = detectIntervalMinutes(readings);
  const activePercent = Math.min(
    100,
    ((n * intervalMinutes) / totalMinutes) * 100,
  );

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance =
    n > 1 ? values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const cv = (sd / mean) * 100;
  const gmi = 3.31 + 0.02392 * mean;

  const counts = { veryHigh: 0, high: 0, inRange: 0, low: 0, veryLow: 0 };
  for (const v of values) {
    if (v > profile.veryHigh) counts.veryHigh++;
    else if (v > profile.high) counts.high++;
    else if (v >= profile.low) counts.inRange++;
    else if (v >= profile.veryLow) counts.low++;
    else counts.veryLow++;
  }

  const keys = ["veryHigh", "high", "inRange", "low", "veryLow"];
  const raw = {};
  keys.forEach((k) => (raw[k] = (counts[k] / n) * 100));
  const rounded100 = roundPercentagesTo100(keys.map((k) => raw[k]));
  const display = {};
  keys.forEach((k, i) => (display[k] = rounded100[i]));

  const minutesPerDay = {};
  keys.forEach((k) => (minutesPerDay[k] = (raw[k] / 100) * 1440));

  const aboveTotal = raw.veryHigh + raw.high;
  const belowTotal = raw.low + raw.veryLow;

  return {
    periodDays,
    readingCount: n,
    intervalMinutes,
    activePercent,
    mean,
    sd,
    cv,
    gmi,
    raw,
    display,
    minutesPerDay,
    aboveTotal,
    belowTotal,
    aboveDisplay: display.veryHigh + display.high,
    belowDisplay: display.low + display.veryLow,
  };
}

/* Standardised 10-metric assessment table */
function evaluateStandardMetrics(m, profile, daysWithData) {
  const perDay = (pct) => formatDuration((pct / 100) * 1440);
  const cmp = {
    lt: (v, g) => v < g,
    le: (v, g) => v <= g,
    gt: (v, g) => v > g,
    ge: (v, g) => v >= g,
  };
  const row = (no, metric, valueText, targetText, perDayText, met) => ({
    no,
    metric,
    valueText,
    targetText,
    perDayText,
    status: met === null ? "—" : met ? "Met" : "Not met",
    met,
  });

  const tar2 = profile.tar2Goal;

  return [
    row(
      1,
      "Number of days the sensor is active",
      `${daysWithData} of ${m.periodDays} days`,
      "≥ 14 days",
      "—",
      daysWithData >= 14,
    ),
    row(
      2,
      "% of sensor data captured",
      `${round(m.activePercent)}%`,
      "≥ 70%",
      "—",
      cmp.ge(m.activePercent, GOALS.activePercent),
    ),
    row(
      3,
      "Mean glucose concentration",
      `${Math.round(m.mean)} mg/dL`,
      "—",
      "—",
      null,
    ),
    row(
      4,
      "Glucose management indicator (GMI)",
      `${round(m.gmi)}%`,
      `< ${GOALS.gmi}%`,
      "—",
      cmp.lt(m.gmi, GOALS.gmi),
    ),
    row(
      5,
      "Glucose variability (CV)",
      `${round(m.cv)}%`,
      `≤ ${GOALS.cv}%`,
      "—",
      cmp.le(m.cv, GOALS.cv),
    ),
    row(
      6,
      `Time above range (TAR) level 2: > ${profile.veryHigh} mg/dL`,
      `${round(m.raw.veryHigh)}%`,
      tar2 === null ? "n/a" : `< ${tar2}%`,
      `${perDay(m.raw.veryHigh)} per day`,
      tar2 === null ? null : cmp.lt(m.raw.veryHigh, tar2),
    ),
    row(
      7,
      `Time above range (TAR) level 1: > ${profile.high} mg/dL`,
      `${round(m.aboveTotal)}%`,
      `< ${profile.tarGoal}%`,
      `${perDay(m.aboveTotal)} per day`,
      cmp.lt(m.aboveTotal, profile.tarGoal),
    ),
    row(
      8,
      `Time in range (TIR): ${profile.low}–${profile.high} mg/dL`,
      `${round(m.raw.inRange)}%`,
      `> ${profile.tirGoal}%`,
      `${perDay(m.raw.inRange)} per day`,
      cmp.gt(m.raw.inRange, profile.tirGoal),
    ),
    row(
      9,
      `Time below range (TBR) level 1: < ${profile.low} mg/dL`,
      `${round(m.belowTotal)}%`,
      `< ${profile.tbrGoal}%`,
      `${perDay(m.belowTotal)} per day`,
      cmp.lt(m.belowTotal, profile.tbrGoal),
    ),
    row(
      10,
      `Time below range (TBR) level 2: < ${profile.veryLow} mg/dL`,
      `${round(m.raw.veryLow)}%`,
      profile.tbr2Goal === 0 ? "0%" : `< ${profile.tbr2Goal}%`,
      `${perDay(m.raw.veryLow)} per day`,
      profile.tbr2Goal === 0
        ? m.raw.veryLow === 0
        : cmp.lt(m.raw.veryLow, profile.tbr2Goal),
    ),
  ];
}

/* Percentile curve (5/25/50/75/95) over the 24h clock, 15-min steps,
   each point computed from a +/-30 min sliding window across all days */
function buildAgpCurve(readings) {
  const byMinute = Array.from({ length: 1440 }, () => []);
  for (const r of readings) {
    const dt = DateTime.fromJSDate(r.timestamp, { zone: TIMEZONE });
    byMinute[dt.hour * 60 + dt.minute].push(r.glucoseLevel);
  }

  const STEP = 15;
  const HALF = 30;
  const pts = [];
  for (let c = 0; c < 1440; c += STEP) {
    const vals = [];
    for (let d = -HALF; d <= HALF; d++) {
      const bucket = byMinute[(((c + d) % 1440) + 1440) % 1440];
      for (let i = 0; i < bucket.length; i++) vals.push(bucket[i]);
    }
    vals.sort((a, b) => a - b);
    pts.push(
      vals.length
        ? {
            minute: c,
            p5: percentileSorted(vals, 5),
            p25: percentileSorted(vals, 25),
            p50: percentileSorted(vals, 50),
            p75: percentileSorted(vals, 75),
            p95: percentileSorted(vals, 95),
          }
        : { minute: c, p5: null, p25: null, p50: null, p75: null, p95: null },
    );
  }

  const firstValid = pts.find((p) => p.p50 !== null);
  if (!firstValid) return null;
  let last = firstValid;
  for (const p of pts) {
    if (p.p50 === null) Object.assign(p, { ...last, minute: p.minute });
    else last = p;
  }
  pts.push({ ...pts[0], minute: 1440 });
  return pts;
}

/* One entry per calendar day of the period, with minute-of-day points */
function buildDailySeries(readings, start, days) {
  const dates = Array.from({ length: days }, (_, i) => start.plus({ days: i }));
  const index = new Map(dates.map((d, i) => [d.toISODate(), i]));
  const series = dates.map((date) => ({ date, points: [] }));

  for (const r of readings) {
    const dt = DateTime.fromJSDate(r.timestamp, { zone: TIMEZONE });
    const i = index.get(dt.toISODate());
    if (i === undefined) continue;
    series[i].points.push({
      minute: dt.hour * 60 + dt.minute + dt.second / 60,
      value: r.glucoseLevel,
    });
  }
  return series;
}

module.exports = {
  PROFILES,
  GOALS,
  round,
  formatDuration,
  computeMetrics,
  evaluateStandardMetrics,
  buildAgpCurve,
  buildDailySeries,
};
