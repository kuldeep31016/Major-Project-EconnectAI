import { fmtIndex } from "@/utils/format";

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
/** 8.14e-6 → "8.14 × 10⁻⁶" (readable scientific notation). */
export function sci(v: number) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0 || Math.abs(v) >= 0.01) return fmtIndex(v);
  const [m, e] = v.toExponential(2).split("e");
  return `${m} × 10${e.replace("+", "").split("").map((c) => SUP[c] ?? c).join("")}`;
}
