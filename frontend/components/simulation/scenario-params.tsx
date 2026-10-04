"use client";

import { Calendar, Circle, Gauge, MapPin, Network, Ruler, Sprout, Square, Trash2 } from "lucide-react";
import type { ComponentType } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { GLOSSARY } from "@/components/shared/term";

interface Chip { key: string; text: string; icon: ComponentType<{ className?: string }>; tip?: string }

const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : [String(v)]);
const num = (v: unknown) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : String(+v.toFixed(2))) : String(v));

/** Turns a scenario's raw parameter object into short, readable chips ("Candidate C12 · radius 5 km · 3 neighbours · IIC"). */
export function paramChips(p: Record<string, unknown>): Chip[] {
  const out: Chip[] = [];
  const seen = new Set<string>();
  const take = (k: string) => { seen.add(k); return p[k]; };
  if (p.candidate_ids != null) { const v = list(take("candidate_ids")); out.push({ key: "c", icon: Sprout, text: `${v.length > 1 ? "Candidates" : "Candidate"} ${v.join(", ")}` }); }
  if (p.patch_ids != null) { const v = list(take("patch_ids")); out.push({ key: "p", icon: Trash2, text: `${v.length > 1 ? "Patches" : "Patch"} ${v.join(", ")}` }); }
  if (p.polygon != null) { const v = take("polygon"); out.push({ key: "poly", icon: Square, text: `Drawn area${Array.isArray(v) ? ` · ${v.length} points` : ""}` }); }
  if (p.retain_fraction != null) out.push({ key: "rf", icon: Gauge, text: `Keep ${Math.round(100 * Number(take("retain_fraction")))} % of area` });
  if (p.lat != null && p.lon != null) out.push({ key: "ll", icon: MapPin, text: `At ${Number(take("lat")).toFixed(4)}, ${Number(take("lon")).toFixed(4)}` });
  if (p.area_ha != null) out.push({ key: "a", icon: Square, text: `${num(take("area_ha"))} ha` });
  if (p.other_run_id != null) out.push({ key: "run", icon: Calendar, text: `vs ${String(take("other_run_id"))}` });
  if (p.tau_km != null) {
    const ref = p.reference_tau_km != null ? num(take("reference_tau_km")) : null;
    out.push({ key: "t", icon: Circle, text: ref ? `Radius ${ref} → ${num(take("tau_km"))} km` : `Radius ${num(take("tau_km"))} km`, tip: GLOSSARY["τ"] });
  }
  if (p.taus_km != null) { out.push({ key: "ts", icon: Ruler, text: `Radii ${list(take("taus_km")).map((x) => num(Number(x))).join(" / ")} km`, tip: GLOSSARY["τ"] }); if (p.reference_tau_km != null) take("reference_tau_km"); }
  if (p.k != null) out.push({ key: "k", icon: Network, text: `${num(take("k"))} neighbours`, tip: "Each patch is linked to at most this many nearest patches within the radius." });
  if (p.ks != null) out.push({ key: "ks", icon: Network, text: `${list(take("ks")).join(" / ")} neighbours`, tip: "Each patch is linked to at most this many nearest patches within the radius." });
  if (p.metric != null) { const m = String(take("metric")).toUpperCase(); out.push({ key: "m", icon: Gauge, text: m, tip: GLOSSARY[m] }); }
  for (const [k, v] of Object.entries(p)) {
    if (seen.has(k) || v == null || typeof v === "object") continue;
    out.push({ key: k, icon: Gauge, text: `${k.replace(/_/g, " ")}: ${typeof v === "number" ? num(v) : String(v)}` });
  }
  return out;
}

export function ParamChips({ params }: { params: Record<string, unknown> }) {
  const chips = paramChips(params);
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => {
        const body = (
          <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.07] bg-[#f8fafc] px-2 py-[3px] text-[11.5px] font-medium text-[#334155]">
            <c.icon className="h-3 w-3 text-[#15803d]" />{c.text}
          </span>
        );
        return c.tip ? <Tooltip key={c.key} content={c.tip} side="bottom"><span tabIndex={0} className="cursor-help">{body}</span></Tooltip> : <span key={c.key}>{body}</span>;
      })}
    </div>
  );
}
