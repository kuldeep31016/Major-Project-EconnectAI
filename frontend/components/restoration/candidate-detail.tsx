"use client";

import type { ComponentType } from "react";
import { CheckCircle2, CircleDashed, Link2, MapPin, Ruler, TriangleAlert } from "lucide-react";
import type { FeasibilityCandidate } from "@/lib/api";
import { Term } from "@/components/shared/term";
import { VERDICT, splitNote } from "@/components/restoration/verdict";

function Points({ title, icon: Icon, color, bg, items, empty }: { title: string; icon: ComponentType<{ className?: string }>; color: string; bg: string; items: string[]; empty?: string }) {
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-3.5">
      <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[#0f172a]">
        <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ background: bg, color }}><Icon className="h-3.5 w-3.5" /></span>{title}
        {items.length > 0 && <span className="ml-auto rounded-full bg-black/[0.04] px-1.5 text-[10.5px] font-semibold tabular text-[#64748b]">{items.length}</span>}
      </h3>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((w) => {
            const [main, note] = splitNote(w);
            return (
              <li key={w} className="flex gap-2 text-[12.5px] leading-snug text-[#1f2937]">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                <span><span>{main.charAt(0).toUpperCase() + main.slice(1)}</span>{note && <span className="block text-[11.5px] text-muted-foreground">{note}</span>}</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-[12.5px] text-muted-foreground">{empty}</p>}
    </section>
  );
}

/** Selected candidate: headline facts, then why / why not / not assessed as three short visual sections. */
export function CandidateDetail({ c, metric }: { c: FeasibilityCandidate; metric: string }) {
  const v = VERDICT[c.verdict];
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Candidate · rank #{c.rank}</div>
            <div className="text-[26px] font-black leading-tight tracking-tight text-[#0f172a]">{c.candidate_id}</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: v.bg, color: v.color, boxShadow: `inset 0 0 0 1px ${v.ring}` }}><v.icon className="h-3.5 w-3.5" />{v.label}</span>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-gradient-to-br from-[#ecfdf5] to-[#f0fdf4] px-3.5 py-3">
          <div className="text-[30px] font-black leading-none tracking-tight tabular text-[#15803d]">+{c.gain_pct.toFixed(c.gain_pct >= 10 ? 1 : 2)}%</div>
          <div className="text-[12px] leading-tight text-[#14532d]"><Term>{`connectivity (${metric.toUpperCase()})`}</Term><br /><span className="text-[11px] text-[#15803d]/80">simulated, if restored</span></div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: Ruler, v: `${c.area_ha.toFixed(1)} ha`, l: "size" },
            { icon: Link2, v: String(c.new_links), l: c.linked_patch_ids.length ? `links to ${c.linked_patch_ids.slice(0, 3).join(", ")}` : "new links" },
            { icon: MapPin, v: c.nearest_habitat_km != null ? `${c.nearest_habitat_km.toFixed(2)} km` : "—", l: "to nearest habitat" },
          ].map((x) => (
            <div key={x.l} className="rounded-xl bg-[#f8fafc] px-1.5 py-2">
              <x.icon className="mx-auto h-3.5 w-3.5 text-[#15803d]" />
              <div className="mt-1 text-[14px] font-bold tabular text-[#0f172a]">{x.v}</div>
              <div className="truncate text-[10.5px] text-muted-foreground" title={x.l}>{x.l}</div>
            </div>
          ))}
        </div>
      </div>
      <Points title="Why it helps" icon={CheckCircle2} color="#15803d" bg="#dcfce7" items={c.why} />
      <Points title="Why not / conditions" icon={TriangleAlert} color="#b45309" bg="#fef3c7" items={c.why_not} empty="No rule against it in the layers we have." />
      <Points title="Not assessed yet" icon={CircleDashed} color="#64748b" bg="#f1f5f9" items={c.not_assessed} empty="Nothing listed." />
    </div>
  );
}
