"use client";

import { AlertTriangle, Compass, FlaskConical, Rocket, Users } from "lucide-react";
import { int, num, useLandingStory } from "@/hooks/use-landing-story";

/**
 * Plain-language "why this exists" for anyone new to the project (officers, funders, the public).
 * The "today" card uses the live run; the rest states purpose and limits without technical terms.
 */
export function PurposeSection() {
  const s = useLandingStory();
  const f = s.focus;

  const cards = [
    {
      icon: AlertTriangle,
      tone: "text-amber-300",
      title: "The problem",
      body:
        "Mangroves shield the coast from storms, raise fish and store carbon. They are lost a few hectares at a time, and today's maps show where forest is, not which pieces keep the rest alive.",
    },
    {
      icon: Compass,
      tone: "text-[#00c896]",
      title: "What EcoConnectAI does",
      body:
        "It turns free satellite images into a map of forest patches and the links between them, then shows which patches matter most, what a road or port would break, and where restoration helps most.",
    },
    {
      icon: Users,
      tone: "text-sky-300",
      title: "Who it is for",
      body:
        "Forest department officers, coastal planners, conservation NGOs and researchers who must decide where to protect, where to restore and where to send field teams first.",
    },
    {
      icon: FlaskConical,
      tone: "text-[#00c896]",
      title: "Where it stands today",
      body: f
        ? `On the Kerala test area the model mapped ${int(s.nPatches)} patches (${num(s.habitatHa, 0)} ha). Patch ${f.patch_id} is only ${num(f.area_pct)}% of the forest, yet losing it would cut connectivity by ${num(f.delta_pct)}%. This is a research prototype: the map is checked against Global Mangrove Watch, not yet in the field.`
        : "A working research prototype on four Indian coastal test areas. The map is checked against Global Mangrove Watch, not yet in the field.",
    },
    {
      icon: Rocket,
      tone: "text-amber-300",
      title: "What support would unlock",
      body:
        "Field surveys with a forest department to confirm the maps, better training labels, a pilot with one agency, and extending the same method to more of India's coastline.",
    },
  ];

  return (
    <section id="purpose" className="relative bg-[#050c18] py-12 lg:py-16 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00c896]">In plain words</p>
        <h2 className="mt-2 max-w-3xl text-2xl sm:text-3xl font-extrabold tracking-tight">
          Protect the patches that hold the coast together, not just the biggest ones.
        </h2>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <c.icon className={`h-5 w-5 ${c.tone}`} />
              <h3 className="mt-2.5 text-[14px] font-bold">{c.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-300">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
