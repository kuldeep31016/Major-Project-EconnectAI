import { AlertTriangle, CircleHelp, Eye, Leaf, Network, Radar, Satellite, Sprout, TrendingDown, type LucideIcon } from "lucide-react";
import type { AlertItem } from "@/lib/api";

export type Severity = AlertItem["severity"];

/** Severity colours: solid (text/dot), soft background, and border. */
export const SEVERITY: Record<Severity, { label: string; solid: string; soft: string; ring: string }> = {
  critical: { label: "Critical", solid: "#b91c1c", soft: "#fef2f2", ring: "#fecaca" },
  high: { label: "High", solid: "#c2410c", soft: "#fff7ed", ring: "#fed7aa" },
  medium: { label: "Medium", solid: "#b45309", soft: "#fffbeb", ring: "#fde68a" },
  low: { label: "Low", solid: "#15803d", soft: "#f0fdf4", ring: "#bbf7d0" },
};
export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];
export const sev = (s: string) => SEVERITY[(s as Severity)] ?? SEVERITY.medium;

export const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]" },
  ACKNOWLEDGED: { label: "Acknowledged", cls: "bg-[#eff6ff] text-[#1e5f8a] ring-[#bfdbfe]" },
  ASSIGNED: { label: "Assigned", cls: "bg-[#f5f3ff] text-[#6d28d9] ring-[#ddd6fe]" },
  RESOLVED: { label: "Resolved", cls: "bg-[#f0fdf4] text-[#15803d] ring-[#bbf7d0]" },
  DISMISSED: { label: "Dismissed", cls: "bg-[#f1f5f9] text-[#64748b] ring-[#e2e8f0]" },
};
export const status = (s: string) => STATUS[s] ?? { label: s.toLowerCase(), cls: "bg-[#f1f5f9] text-[#64748b] ring-[#e2e8f0]" };

/** Plain-language label, icon and one-line meaning for each rule. */
export const TYPE_META: Record<string, { label: string; icon: LucideIcon; meaning: string }> = {
  critical_patch: { label: "Key patch", icon: Network, meaning: "Losing this patch would noticeably weaken how well the forest network hangs together." },
  restoration_opportunity: { label: "Restoration opportunity", icon: Sprout, meaning: "Re-planting this gap would link patches and raise connectivity, according to the model." },
  uncertain_habitat: { label: "Uncertain habitat", icon: CircleHelp, meaning: "The model is unsure here: it may be mangrove the map missed. Check on the ground first." },
  low_confidence: { label: "Low map confidence", icon: Eye, meaning: "The map is not confident this patch is habitat. Confirm it in the field before relying on it." },
  habitat_change: { label: "Habitat change", icon: Leaf, meaning: "Predicted habitat area changed between two analysis runs of the same model." },
  connectivity_degradation: { label: "Connectivity change", icon: TrendingDown, meaning: "Network connectivity changed between two analysis runs of the same model." },
  new_observation: { label: "New satellite pass", icon: Satellite, meaning: "Sentinel-1 imaged this area again; automatic monitoring found the new pass in the catalogue." },
  satellite_update: { label: "Satellite analysis ready", icon: Radar, meaning: "An automatic analysis of the latest passes finished. Differences from the previous one are model-output differences, not verified change." },
  pending_verification: { label: "Awaiting verification", icon: AlertTriangle, meaning: "AI detections are waiting for a field check and are not confirmed observations yet." },
};
export const humanise = (k: string) => k.replace(/_/g, " ").replace(/\bpct\b/i, "%").replace(/\bha\b/, "(ha)").replace(/^./, (c) => c.toUpperCase());
export const typeMeta = (t: string) => TYPE_META[t] ?? { label: humanise(t), icon: AlertTriangle, meaning: "Rule-based alert raised from the stored analysis results." };

// ---------- number formatting (display only; never changes the stored values) ----------
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function fmt(v: number, digits = 1) {
  return v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: Math.abs(v) >= 1000 ? 0 : digits });
}
export const fmtHa = (v: number) => `${fmt(v, v >= 1000 ? 0 : 1)} ha`;
export const fmtPct = (v: number, digits = 1, signed = false) => `${signed && v > 0 ? "+" : ""}${fmt(v, digits)} %`;

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
/** 0.0429 -> "4.29 × 10⁻²" (connectivity indices are tiny numbers). */
export function sci(v: number, digits = 2) {
  if (v === 0) return "0";
  const [m, e] = v.toExponential(digits).split("e");
  const exp = Number(e);
  if (exp >= -1 && exp <= 3) return fmt(v, Math.max(digits, 3));
  return `${m} × 10${String(exp).split("").map((c) => SUP[c] ?? c).join("")}`;
}

export const timeAgo = (iso: string) => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
};
