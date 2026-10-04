import type { ComponentType } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import type { FeasibilityCandidate } from "@/lib/api";

export type Verdict = FeasibilityCandidate["verdict"];

export const VERDICT: Record<Verdict, { label: string; short: string; color: string; bg: string; ring: string; icon: ComponentType<{ className?: string }> }> = {
  recommended: { label: "Recommended", short: "Recommended", color: "#15803d", bg: "#dcfce7", ring: "#86efac", icon: CheckCircle2 },
  conditional: { label: "Conditional", short: "Conditional", color: "#b45309", bg: "#fef3c7", ring: "#fcd34d", icon: AlertTriangle },
  field_check: { label: "Uncertain habitat — field check", short: "Field check", color: "#92400e", bg: "#ffedd5", ring: "#fdba74", icon: HelpCircle },
  not_recommended: { label: "Not recommended", short: "Not recommended", color: "#b91c1c", bg: "#fee2e2", ring: "#fca5a5", icon: XCircle },
};

/** Map marker colour per verdict. */
export const markerColor = (v: Verdict) => (v === "recommended" ? "#16a34a" : v === "not_recommended" ? "#dc2626" : "#f59e0b");

/** "main text (detail)" → ["main text", "detail"] so long rule outputs read as a headline plus a muted note. Text is kept verbatim. */
export function splitNote(s: string): [string, string | null] {
  const m = s.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return m && m[1] ? [m[1], m[2]] : [s, null];
}
