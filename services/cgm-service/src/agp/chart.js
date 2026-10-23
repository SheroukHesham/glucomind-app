// @ts-nocheck
const { createCanvas } = require("@napi-rs/canvas");
const { formatDuration } = require("./metrics");

const SCALE = 2; // render at 2x for crisp images in Excel
const FONT = '"DejaVu Sans","Liberation Sans",Arial,Helvetica,sans-serif';

const C = {
  veryHigh: "#E8690B",
  veryHighLight: "#EE9B5C",
  high: "#F2A900",
  highLight: "#F5C86A",
  inRange: "#6F9320",
  inRangeLight: "#A8BF7B",
  low: "#D9341E",
  lowLight: "#E98F82",
  veryLow: "#8E1B10",
  text: "#333333",
  muted: "#666666",
  grid: "#C4C4C4",
  median: "#2B2B2B",
};

function makeCanvas(w, h) {
  const canvas = createCanvas(w * SCALE, h * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

const result = (canvas, width, height) => ({
  buffer: canvas.toBuffer("image/png"),
  width,
  height,
});

function spread(ys, minGap) {
  const out = [...ys];
  for (let i = 1; i < out.length; i++) {
    if (out[i] - out[i - 1] < minGap) out[i] = out[i - 1] + minGap;
  }
  return out;
}

function traceSmooth(ctx, pts, startWithMove) {
  if (!pts.length) return;
  if (startWithMove) ctx.moveTo(pts[0].x, pts[0].y);
  else ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6,
      p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6,
      p2.y - (p3.y - p1.y) / 6,
      p2.x,
      p2.y,
    );
  }
}

/* ------------------------------------------------------------------ */
/* 1. Time in ranges (stacked bar)                                    */
/* ------------------------------------------------------------------ */
function renderTimeInRanges(metrics, profile) {
  const W = 470,
    H = 385;
  const { canvas, ctx } = makeCanvas(W, H);

  const barX = 72,
    barW = 48,
    top = 20,
    barH = 300;
  const segs = [
    { key: "veryHigh", name: "Very high", color: C.veryHigh },
    { key: "high", name: "High", color: C.high },
    { key: "inRange", name: "In range", color: C.inRange },
    { key: "low", name: "Low", color: C.low },
    { key: "veryLow", name: "Very low", color: C.veryLow },
  ];

  let y = top;
  for (const s of segs) {
    s.h = (metrics.raw[s.key] / 100) * barH;
    s.y = y;
    s.center = y + s.h / 2;
    y += s.h;
    if (s.h > 0) {
      ctx.fillStyle = s.color;
      ctx.fillRect(barX, s.y, barW, s.h);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, s.y, barW, s.h);
    }
  }

  // boundary tick labels on the left
  const boundaries = [
    { v: profile.veryHigh, y: segs[1].y },
    { v: profile.high, y: segs[2].y },
    { v: profile.low, y: segs[3].y },
    { v: profile.veryLow, y: segs[4].y },
  ];
  const bYs = spread(
    boundaries.map((b) => b.y),
    14,
  );
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  boundaries.forEach((b, i) => ctx.fillText(String(b.v), barX - 8, bYs[i]));

  // segment labels on the right
  const labelYs = spread(
    segs.map((s) => s.center),
    30,
  );
  const pctX = barX + barW + 42;
  const nameX = pctX + 56;
  segs.forEach((s, i) => {
    ctx.strokeStyle = "#BBBBBB";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(barX + barW, s.center);
    ctx.lineTo(pctX - 8, labelYs[i]);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = C.text;
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(`${metrics.display[s.key]}%`, pctX, labelYs[i]);
    ctx.font = `14px ${FONT}`;
    ctx.fillText(s.name, nameX, labelYs[i] - (s.key === "veryLow" ? 7 : 0));
    if (s.key === "veryLow") {
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = C.muted;
      ctx.fillText(
        `(${formatDuration(metrics.minutesPerDay.veryLow)})`,
        nameX,
        labelYs[i] + 9,
      );
    }
  });

  // brackets (above / below range)
  const bracket = (yA, yB, label) => {
    const bx = 335;
    ctx.strokeStyle = "#888888";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 7, yA);
    ctx.lineTo(bx, yA);
    ctx.lineTo(bx, yB);
    ctx.lineTo(bx - 7, yB);
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.font = `bold 24px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(label, bx + 14, (yA + yB) / 2);
  };
  bracket(segs[0].y, segs[2].y, `${metrics.aboveDisplay}%`);
  bracket(segs[3].y, segs[4].y + segs[4].h + 1, `${metrics.belowDisplay}%`);

  // clinical note next to "In range"
  ctx.fillStyle = C.muted;
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = "left";
  const inY = labelYs[2];
  ctx.fillText("Each 5% increase is", 300, inY - 8);
  ctx.fillText("clinically beneficial", 300, inY + 9);

  return result(canvas, W, H);
}

/* ------------------------------------------------------------------ */
/* 2. AGP percentile chart                                            */
/* ------------------------------------------------------------------ */
function hourLabel(h) {
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${String(hh).padStart(2, "0")}:00 ${h < 12 || h === 24 ? "AM" : "PM"}`;
}

function renderAgpChart(curve, profile) {
  const W = 940,
    H = 300;
  const { canvas, ctx } = makeCanvas(W, H);

  const L = 40,
    R = 62,
    T = 10,
    B = 32;
  const pw = W - L - R,
    ph = H - T - B;
  const yMin = 40,
    yMax = 350;
  const X = (m) => L + (m / 1440) * pw;
  const Y = (v) =>
    T + ((yMax - Math.min(yMax, Math.max(yMin, v))) / (yMax - yMin)) * ph;
  const series = (key) => curve.map((p) => ({ x: X(p.minute), y: Y(p[key]) }));

  const p5 = series("p5"),
    p25 = series("p25"),
    p50 = series("p50");
  const p75 = series("p75"),
    p95 = series("p95");

  const zones = [
    {
      from: yMax,
      to: profile.veryHigh,
      light: C.veryHighLight,
      dark: C.veryHigh,
    },
    {
      from: profile.veryHigh,
      to: profile.high,
      light: C.highLight,
      dark: C.high,
    },
    {
      from: profile.high,
      to: profile.low,
      light: C.inRangeLight,
      dark: C.inRange,
    },
    { from: profile.low, to: yMin, light: C.lowLight, dark: C.low },
  ];

  const fillBand = (upper, lower, color, y1, y2) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, y1, pw, y2 - y1);
    ctx.clip();
    ctx.beginPath();
    traceSmooth(ctx, upper, true);
    traceSmooth(ctx, [...lower].reverse(), false);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  for (const z of zones) {
    const y1 = Y(z.from),
      y2 = Y(z.to);
    fillBand(p95, p5, z.light, y1, y2);
    fillBand(p75, p25, z.dark, y1, y2);
  }

  // vertical grid (06:00, 12:00, 18:00)
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  [360, 720, 1080].forEach((m) => {
    ctx.beginPath();
    ctx.moveTo(X(m), T);
    ctx.lineTo(X(m), T + ph);
    ctx.stroke();
  });

  // target / threshold lines
  const hline = (v, color, w) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(L, Y(v));
    ctx.lineTo(L + pw, Y(v));
    ctx.stroke();
  };
  hline(profile.high, C.inRange, 1.5);
  hline(profile.low, C.inRange, 1.5);
  hline(profile.veryLow, "#999999", 0.75);

  // median
  ctx.save();
  ctx.beginPath();
  ctx.rect(L, T, pw, ph);
  ctx.clip();
  ctx.beginPath();
  traceSmooth(ctx, p50, true);
  ctx.strokeStyle = C.median;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();

  // frame
  ctx.strokeStyle = "#D0D0D0";
  ctx.lineWidth = 1;
  ctx.strokeRect(L, T, pw, ph);

  // y axis labels
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  [yMax, profile.veryHigh, profile.high, profile.low, profile.veryLow].forEach(
    (v) => ctx.fillText(String(v), L - 6, Y(v)),
  );

  // x axis labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let h = 0; h <= 24; h += 3) {
    ctx.fillText(hourLabel(h), X(h * 60), T + ph + 8);
  }

  // percentile labels on the right
  const last = curve.length - 1;
  const labels = [
    { t: "95%", y: Y(curve[last].p95) },
    { t: "75%", y: Y(curve[last].p75) },
    { t: "50%", y: Y(curve[last].p50), bold: true },
    { t: "25%", y: Y(curve[last].p25) },
    { t: "5%", y: Y(curve[last].p5) },
  ];
  const lys = spread(
    labels.map((l) => l.y),
    15,
  );
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  labels.forEach((l, i) => {
    ctx.font = `${l.bold ? "bold " : ""}12px ${FONT}`;
    ctx.fillStyle = l.bold ? C.text : C.muted;
    ctx.fillText(l.t, L + pw + 8, lys[i]);
  });

  return result(canvas, W, H);
}

/* ------------------------------------------------------------------ */
/* 3. Daily glucose profiles                                          */
/* ------------------------------------------------------------------ */
function renderDailyProfiles(series, profile) {
  const W = 940,
    COLS = 7,
    left = 42,
    right = 4;
  const cellW = (W - left - right) / COLS;
  const headerH = 20,
    plotH = 64,
    labelH = 16,
    rowGap = 8;
  const rowH = headerH + plotH + labelH + rowGap;
  const rows = Math.ceil(series.length / COLS);
  const H = rows * rowH + 4;
  const { canvas, ctx } = makeCanvas(W, H);

  const dMin = 40,
    dMax = 320;

  for (let r = 0; r < rows; r++) {
    const y0 = 2 + r * rowH;
    const plotTop = y0 + headerH;
    const plotBottom = plotTop + plotH;
    const Y = (v) =>
      plotTop +
      ((dMax - Math.min(dMax, Math.max(dMin, v))) / (dMax - dMin)) * plotH;
    const yHigh = Y(profile.high),
      yLow = Y(profile.low);

    // y axis labels
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillStyle = C.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(profile.high), left - 5, yHigh);
    ctx.fillText(String(profile.low), left - 5, yLow);
    ctx.save();
    ctx.translate(7, plotTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `10px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("mg/dL", 0, 0);
    ctx.restore();

    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      if (idx >= series.length) break;
      const day = series[idx];
      const x0 = left + c * cellW;
      const x1 = x0 + cellW;
      const X = (m) => x0 + (m / 1440) * cellW;
      const weekend = day.date.weekday >= 6;

      // header
      ctx.fillStyle = weekend ? "#E6EEF7" : "#F4F4F4";
      ctx.fillRect(x0, y0, cellW, headerH);
      ctx.fillStyle = C.text;
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(day.date.toFormat("cccc"), x0 + cellW / 2, y0 + headerH / 2);

      // plot background and target band
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x0, plotTop, cellW, plotH);
      ctx.fillStyle = "#E4E4E4";
      ctx.fillRect(x0, yHigh, cellW, yLow - yHigh);

      // line + colour fills
      const pts = day.points;
      if (pts.length) {
        const segments = [];
        let cur = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
          if (pts[i].minute - pts[i - 1].minute > 30) {
            segments.push(cur);
            cur = [];
          }
          cur.push(pts[i]);
        }
        segments.push(cur);

        for (const seg of segments) {
          const xy = seg.map((p) => ({ x: X(p.minute), y: Y(p.value) }));
          const fillArea = (baseY, clipY1, clipY2, color) => {
            if (xy.length < 2) return;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x0, clipY1, cellW, clipY2 - clipY1);
            ctx.clip();
            ctx.beginPath();
            ctx.moveTo(xy[0].x, baseY);
            xy.forEach((p) => ctx.lineTo(p.x, p.y));
            ctx.lineTo(xy[xy.length - 1].x, baseY);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
          };
          fillArea(yHigh, plotTop, yHigh, C.high);
          fillArea(yLow, yLow, plotBottom, C.low);

          ctx.beginPath();
          xy.forEach((p, i) =>
            i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
          );
          ctx.strokeStyle = "#1E1E1E";
          ctx.lineWidth = 1;
          ctx.lineJoin = "round";
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = C.muted;
        ctx.font = `11px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText("No data", x0 + cellW / 2, plotTop + plotH / 2);
      }

      // threshold lines
      ctx.strokeStyle = "#555555";
      ctx.lineWidth = 0.8;
      [yHigh, yLow].forEach((yy) => {
        ctx.beginPath();
        ctx.moveTo(x0, yy);
        ctx.lineTo(x1, yy);
        ctx.stroke();
      });

      // cell border
      ctx.strokeStyle = "#D8D8D8";
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, cellW, headerH + plotH);

      // date number badge
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x0 + 1, plotTop + 1, 22, 15);
      ctx.fillStyle = C.text;
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(day.date.toFormat("dd"), x0 + 4, plotTop + 9);

      // noon label
      ctx.fillStyle = C.muted;
      ctx.font = `bold 10px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText("12:00 PM", X(720), plotBottom + 10);
    }
  }

  return result(canvas, W, H);
}

module.exports = { renderTimeInRanges, renderAgpChart, renderDailyProfiles };
