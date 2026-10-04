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
  IoU: "Intersection over Union: of all pixels that the model or the reference map calls mangrove, the share both agree on. 1 is perfect overlap, 0 is none.",
  Dice: "Dice score (same as F1 for the habitat class): a balance of precision and recall; a little more forgiving than IoU.",
  precision: "Of the pixels the model called mangrove, the share the reference map also calls mangrove. Low precision means many false alarms.",
  recall: "Of the pixels the reference map calls mangrove, the share the model found. Low recall means much mangrove was missed.",
  "Cohen's kappa": "Agreement between the model and the reference map after removing the agreement expected by chance. 0 is chance level, 1 is perfect.",
  "overall accuracy": "Share of all pixels classified the same as the reference map. It looks high (often 99 %) because most pixels are not mangrove, so it says little here.",
  "link density": "How many links the network has compared with the most it could have between its patches. Higher means more connected.",
  "hub patch": "A patch with many links to other patches; it is a meeting point of the network.",
  "weak labels": "Reference labels taken from an existing map (Global Mangrove Watch), not from field surveys, so they contain their own errors.",
  "connection radius": "The longest gap (τ, in km) across which two patches are treated as linked. EcoConnectAI uses 5 km by default and also checks 3 and 8 km.",
  "minimum mapping unit": "The smallest patch kept on the map (2 ha by default); smaller pieces are dropped as noise.",
};

// Longest keys first so "cut vertex" wins over shorter matches; "comp." is the table abbreviation of components.
const MATCHERS: [RegExp, string][] = [
  [/cut vertex/i, "cut vertex"], [/criticality/i, "criticality"], [/\bcomp(onents?|\.)/i, "components"],
  [/\bECA\b/, "ECA"], [/\bIIC\b/, "IIC"], [/\bPC\b/, "PC"], [/τ/, "τ"], [/ρ/, "ρ"],
  [/\bIoU\b/i, "IoU"], [/\bDice\b/i, "Dice"], [/\bprecision\b/i, "precision"], [/\brecall\b/i, "recall"],
  [/kappa|\bκ\b/i, "Cohen's kappa"], [/link density/i, "link density"], [/\bhubs?\b/i, "hub patch"],
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
