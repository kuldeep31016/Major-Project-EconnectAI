"use client";

import { MousePointerClick, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectMenu } from "@/components/ui/select-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { GLOSSARY } from "@/components/shared/term";
import { CandidatePicker } from "@/components/simulation/candidate-picker";
import { GROUPS, kindInfo } from "@/components/simulation/scenario-kinds";
import type { ScenarioSetupState } from "@/components/simulation/use-scenario-setup";
import type { RestorationAction } from "@/types";
import { cn } from "@/lib/utils";

function Picked({ ids, empty, onClear }: { ids: string[]; empty: string; onClear: () => void }) {
  if (!ids.length) return <div className="flex items-center gap-2 rounded-xl border border-dashed border-black/15 bg-white px-3 py-2.5 text-[12px] text-muted-foreground"><MousePointerClick className="h-4 w-4 text-[#15803d]" />{empty}</div>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ids.map((id) => <span key={id} className="rounded-lg bg-[#fee2e2] px-2 py-1 text-[12px] font-bold text-[#b91c1c]">{id}</span>)}
      <button className="ml-1 text-[11.5px] font-semibold text-[#0f5132] underline-offset-2 hover:underline" onClick={onClear}>Clear</button>
    </div>
  );
}

const input = "w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#15803d] focus:ring-2 focus:ring-[#15803d]/15";

/** "Set it up": the chosen scenario in one sentence plus the inputs it needs (shared by Scenario Lab and Interactive Map). */
export function ScenarioSetup({ s, actions, className }: { s: ScenarioSetupState; actions: RestorationAction[]; className?: string }) {
  const { kind } = s;
  const info = kindInfo(kind)!;
  const group = GROUPS.find((g) => g.id === info.group)!;
  return (
    <div className={className}>
      <div className="space-y-3 rounded-2xl border border-black/[0.06] bg-white p-3">
        <div className="flex items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${group.tone}14`, color: group.tone }}><info.icon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold leading-snug text-[#0f172a]">{info.desc}</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">{info.todo}</div>
          </div>
        </div>

        {s.picksPatches && <Picked ids={s.removedPatchIds} empty="Click patches on the map" onClear={s.clearPicked} />}
        {kind === "reduce_area" && (
          <label className="block text-[12px] font-medium text-[#334155]">
            <span className="flex justify-between"><span>Area kept</span><b className="tabular text-[#0f172a]">{s.retainPct}%</b></span>
            <input type="range" min={5} max={95} step={5} value={s.retainPct} onChange={(e) => s.setRetainPct(Number(e.target.value))} className="mt-1 w-full accent-[#15803d]" />
          </label>
        )}
        {kind === "remove_polygon" && (
          <div className="space-y-2">
            <Button size="sm" variant={s.drawing ? "default" : "outline"} className="w-full" onClick={() => s.setDrawing((d) => !d)}>
              <Pencil className="h-3.5 w-3.5" /> {s.drawing ? "Done drawing" : s.polygon.length ? "Add more points" : "Draw on the map"}
            </Button>
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span><b className="text-[#0f172a]">{s.polygon.length}</b> point{s.polygon.length === 1 ? "" : "s"}{s.polygon.length > 0 && s.polygon.length < 3 ? " · need 3" : ""}</span>
              {s.polygon.length > 0 && <button onClick={s.clearPolygon} className="font-semibold text-[#0f5132] hover:underline">Clear</button>}
            </div>
          </div>
        )}
        {kind === "add_patch" && (
          <div className="space-y-2">
            <Button size="sm" variant={s.drawing ? "default" : "outline"} className="w-full" onClick={() => s.setDrawing((d) => !d)}>
              <Pencil className="h-3.5 w-3.5" /> {s.drawing ? "Click the map to place it" : s.point ? "Move the patch" : "Place on the map"}
            </Button>
            <div className="text-[12px] text-muted-foreground">{s.point ? `At ${s.point[0].toFixed(4)}, ${s.point[1].toFixed(4)}` : "No location yet"}</div>
            <label className="flex items-center gap-2 text-[12px] font-medium text-[#334155]">Size
              <input type="number" min={0.1} max={10000} step={0.5} value={s.areaHa} onChange={(e) => s.setAreaHa(Number(e.target.value))} className={cn(input, "w-24")} /> ha</label>
            <div className="text-[11px] text-muted-foreground">Made up by you — not detected habitat.</div>
          </div>
        )}
        {kind === "radius" && (
          <label className="block text-[12px] font-medium text-[#334155]">
            <span className="flex justify-between">
              <Tooltip content={GLOSSARY["τ"]}><span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-2">Travel distance</span></Tooltip>
              <b className="tabular text-[#0f172a]">{s.tauKm} km</b>
            </span>
            <input type="range" min={1} max={15} step={0.5} value={s.tauKm} onChange={(e) => s.setTauKm(Number(e.target.value))} className="mt-1 w-full accent-[#1e5f8a]" />
          </label>
        )}
        {kind === "sensitivity" && (
          <div className="grid grid-cols-2 gap-2 text-[12px] font-medium text-[#334155]">
            <label className="block">Distances (km)<input value={s.taus} onChange={(e) => s.setTaus(e.target.value)} className={cn(input, "mt-1")} /></label>
            <label className="block">Neighbours<input value={s.ks} onChange={(e) => s.setKs(e.target.value)} className={cn(input, "mt-1")} /></label>
          </div>
        )}
        {kind === "compare_periods" && (
          s.otherRuns.length
            ? <SelectMenu label="Compare with run" value={s.otherRun} onChange={s.setOtherRun} options={[{ value: "", label: "Choose a run…" }, ...s.otherRuns.map((r) => ({ value: r.runId, label: r.sceneYear ? String(r.sceneYear) : r.runId, hint: r.runId }))]} menuClassName="w-[260px]" />
            : <div className="text-[12px] text-muted-foreground">No other run for this landscape yet.</div>
        )}
      </div>
      {(kind === "restore" || kind === "restore_multi") && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.08em] text-[#475569]"><span>Candidates · best first</span>{s.cands.length > 0 && <span className="normal-case tracking-normal text-[#15803d]">{s.cands.length} picked</span>}</div>
          <CandidatePicker actions={actions} selected={s.cands} multi={s.multi} onToggle={s.pickCandidate} />
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Candidates are model output — field check first.</p>
        </div>
      )}
    </div>
  );
}
