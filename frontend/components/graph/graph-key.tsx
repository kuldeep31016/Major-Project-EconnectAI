"use client";

import type { ReactNode } from "react";

/** Compact visual key for the connectivity graph (replaces the long "Reading this graph" text). */
export function GraphKey({ tauKm, k }: { tauKm?: number; k?: number }) {
  const items: { glyph: ReactNode; label: string }[] = [
    {
      glyph: (
        <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden="true">
          <circle cx="9" cy="12" r="5" fill="#15803d" />
          <circle cx="27" cy="12" r="9" fill="#15803d" />
        </svg>
      ),
      label: "Bigger dot = bigger patch",
    },
    {
      glyph: (
        <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden="true">
          <circle cx="20" cy="12" r="10" fill="#15803d" />
          <text x="20" y="15.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">72</text>
        </svg>
      ),
      label: "Number = importance (0–100)",
    },
    {
      glyph: (
        <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden="true">
          <circle cx="20" cy="12" r="10.5" fill="none" stroke="#dc2626" strokeWidth="1.6" strokeDasharray="3 2.5" />
          <circle cx="20" cy="12" r="7.5" fill="#15803d" stroke="#ef4444" strokeWidth="2.5" />
        </svg>
      ),
      label: "Red halo = losing it splits the network",
    },
    {
      glyph: (
        <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden="true">
          <circle cx="20" cy="12" r="8" fill="#15803d" />
          <circle cx="27" cy="5.5" r="4.5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
        </svg>
      ),
      label: "Star = hub (most links)",
    },
    {
      glyph: (
        <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden="true">
          <line x1="3" y1="8" x2="37" y2="8" stroke="#1e5f8a" strokeWidth="4" strokeOpacity="0.8" />
          <line x1="3" y1="17" x2="37" y2="17" stroke="#1e5f8a" strokeWidth="1.5" strokeOpacity="0.6" />
        </svg>
      ),
      label: "Thicker line = stronger link",
    },
    {
      glyph: (
        <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden="true">
          <line x1="3" y1="12" x2="37" y2="12" stroke="#f59e0b" strokeWidth="3" strokeDasharray="5 4" />
        </svg>
      ),
      label: "Amber = only link holding two parts together",
    },
  ];
  return (
    <div>
      <ul className="grid grid-cols-1 gap-1.5 min-[400px]:grid-cols-2 lg:grid-cols-1">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2.5 rounded-xl bg-[#f8faf9] px-2.5 py-1.5 text-[11.5px] font-medium text-[#334155]">
            <span className="shrink-0">{it.glyph}</span>
            {it.label}
          </li>
        ))}
      </ul>
      <details className="group mt-2 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer list-none font-semibold text-[#15803d] hover:underline">How are links drawn?</summary>
        <p className="mt-1 leading-relaxed">
          Each patch links to its {k ?? "k"} nearest neighbours. Link strength w = √(qᵢqⱼ)·e^(−d/τ), with travel distance τ = {tauKm ?? "—"} km.
          Click a dot for its details.
        </p>
      </details>
    </div>
  );
}
