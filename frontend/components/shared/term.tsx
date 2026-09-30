"use client";

import { Tooltip } from "@/components/ui/tooltip";

/** Everyday-language meaning of the technical terms shown on metric labels. */
export const GLOSSARY: Record<string, string> = {
  IIC: "Integral Index of Connectivity: one number for how well the whole forest network hangs together, counting patch sizes and the links between them. Higher is better; compare it only between results with the same settings.",
  PC: "Probability of Connectivity: like IIC, but each link counts by how likely wildlife is to cross it, so short gaps matter more than long ones.",
  ECA: "Equivalent Connected Area: the size of one unbroken forest that would be as well connected as the whole network. The closer to the total mapped area, the better connected.",
  "τ": "Travel distance (km) that seeds, fish and birds are assumed to cover between patches. Results are checked across several values because the true distance varies by species.",
  "ρ": "Rank agreement (Spearman) with the reference setting: 1 means the patches are ranked in exactly the same order.",
  components: "Separate groups of patches with no link between them. More groups means a more broken-up coast.",
  "cut vertex": "A patch that on its own joins two groups of patches; losing it splits the network.",
  criticality: "How much connectivity would drop if this patch were lost, measured by removing it and recomputing exactly.",
};

// Longest keys first so "cut vertex" wins over shorter matches; "comp." is the table abbreviation of components.
const MATCHERS: [RegExp, string][] = [
  [/cut vertex/i, "cut vertex"], [/criticality/i, "criticality"], [/\bcomp(onents?|\.)/i, "components"],
  [/\bECA\b/, "ECA"], [/\bIIC\b/, "IIC"], [/\bPC\b/, "PC"], [/τ/, "τ"], [/ρ/, "ρ"],
];

export const termKey = (label: string) => MATCHERS.find(([re]) => re.test(label))?.[1];

/** Renders a label; if it contains a technical term, adds a dotted underline and a plain-language tooltip. */
export function Term({ children, side = "top" }: { children: string; side?: "top" | "bottom" | "left" | "right" }) {
  const key = termKey(children);
  if (!key) return <>{children}</>;
  return (
    <Tooltip content={GLOSSARY[key]} side={side}>
      <span tabIndex={0} className="cursor-help underline decoration-dotted decoration-current/50 underline-offset-2">{children}</span>
    </Tooltip>
  );
}
