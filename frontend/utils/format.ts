/** Display formatting helpers shared across dashboards, charts and reports. */

export const fmtNumber = (n: number, digits = 0) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtArea = (ha: number) =>
  ha >= 10000 ? `${fmtNumber(ha / 1000, 1)}k ha` : `${fmtNumber(ha, ha < 100 ? 1 : 0)} ha`;

export const fmtPct = (v: number, digits = 0) => `${fmtNumber(v, digits)}%`;

/** 0–1 → percentage string. */
export const fmtRatio = (v: number, digits = 0) => `${fmtNumber(v * 100, digits)}%`;

export const fmtDelta = (v: number, digits = 1) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtNumber(Math.abs(v), digits)}`;

/** Indian currency in lakh/crore, the units conservation budgets actually use. */
export function fmtCurrency(lakh: number) {
  if (lakh >= 100) {
    const cr = lakh / 100;
    return `₹${fmtNumber(cr, cr < 10 ? 2 : 1)} Cr`;
  }
  return `₹${fmtNumber(lakh, lakh < 10 ? 1 : 0)} L`;
}

export function fmtCoord(lat: number, lng: number, digits = 5) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(digits)}° ${ns}, ${Math.abs(lng).toFixed(digits)}° ${ew}`;
}

/** Decimal degrees → degrees/minutes/seconds, for the GIS coordinate readout. */
export function toDMS(value: number, axis: "lat" | "lng") {
  const dir = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = ((mFloat - m) * 60).toFixed(1);
  return `${d}° ${String(m).padStart(2, "0")}' ${s.padStart(4, "0")}" ${dir}`;
}

export function fmtDate(iso: string, withTime = false) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (!withTime) return date;
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time}`;
}

/** The prototype froze "now" so its mock timestamps read consistently; real runs use the real clock. */
export const DEMO_NOW = new Date("2026-08-08T12:00:00Z");

export function relativeTime(iso: string, now?: Date) {
  const t = new Date(iso).getTime();
  const ref = now ?? (t > DEMO_NOW.getTime() ? new Date() : DEMO_NOW);
  const diff = Math.max(0, ref.getTime() - t);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return `${Math.round(months / 12)} yr ago`;
}

export const fmtDuration = (sec: number) =>
  sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`;

/** Blend green → yellow → orange → red for a 0–1 sensitivity value. */
export function sensitivityColor(v: number) {
  const stops: [number, [number, number, number]][] = [
    [0, [34, 197, 94]],
    [0.4, [245, 158, 11]],
    [0.7, [249, 115, 22]],
    [1, [239, 68, 68]],
  ];
  const t = Math.min(1, Math.max(0, v));
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    if (t >= p0 && t <= p1) {
      const f = (t - p0) / (p1 - p0 || 1);
      const c = c0.map((v0, k) => Math.round(v0 + (c1[k] - v0) * f));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return "rgb(239, 68, 68)";
}

export const scoreGradeColor = (score: number) =>
  score >= 80 ? "#22c55e" : score >= 70 ? "#15803d" : score >= 60 ? "#f59e0b" : "#ef4444";

/** Connectivity indices (IIC, PC) are dimensionless fractions that can be ~1e-5 on real landscapes. */
export function fmtIndex(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  return Math.abs(v) >= 0.01 ? v.toFixed(3) : v.toExponential(2);
}
