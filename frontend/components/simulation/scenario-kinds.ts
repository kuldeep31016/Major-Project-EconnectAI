import type { ComponentType } from "react";
import { CalendarRange, Circle, Eraser, Grid3x3, Layers, MapPinPlus, Minimize2, PenTool, Ruler, Sprout, Trees } from "lucide-react";

export type Kind =
  | "remove_patches" | "remove_polygon" | "restore" | "restore_multi" | "reduce_area" | "add_patch"
  | "radius" | "sensitivity" | "tau" | "threshold" | "compare_periods";

export type KindGroup = "lose" | "gain" | "test";

export interface KindInfo {
  id: Kind;
  letter: string;
  short: string;
  /** One plain sentence: what this scenario does. */
  desc: string;
  /** What the user has to do before running it. */
  todo: string;
  group: KindGroup;
  icon: ComponentType<{ className?: string }>;
}

export const KINDS: KindInfo[] = [
  { id: "remove_patches", letter: "A", short: "Remove patch", desc: "What if a forest patch is lost?", todo: "Click one or more patches on the map.", group: "lose", icon: Eraser },
  { id: "remove_polygon", letter: "B", short: "Clear an area", desc: "What if everything inside an area is lost?", todo: "Draw the area on the map (3+ points).", group: "lose", icon: PenTool },
  { id: "reduce_area", letter: "E", short: "Shrink patch", desc: "What if a patch only partly degrades?", todo: "Click patches on the map, then set how much is kept.", group: "lose", icon: Minimize2 },
  { id: "restore", letter: "C", short: "Restore site", desc: "What if one candidate site is restored?", todo: "Pick one candidate below.", group: "gain", icon: Sprout },
  { id: "restore_multi", letter: "D", short: "Restore several", desc: "What if several candidate sites are restored together?", todo: "Pick two or more candidates below.", group: "gain", icon: Trees },
  { id: "add_patch", letter: "F", short: "Add a patch", desc: "What if new habitat appeared at a spot you choose?", todo: "Place the patch on the map and set its size.", group: "gain", icon: MapPinPlus },
  { id: "radius", letter: "G", short: "Travel distance", desc: "Rebuild the network with another travel distance.", todo: "Set the distance with the slider.", group: "test", icon: Circle },
  { id: "sensitivity", letter: "H", short: "Stability grid", desc: "Does the patch ranking hold across settings?", todo: "Optional: edit the distances and neighbour counts.", group: "test", icon: Grid3x3 },
  { id: "tau", letter: "I", short: "3 / 5 / 8 km", desc: "Compare the network at three travel distances.", todo: "Nothing to set — just run it.", group: "test", icon: Ruler },
  { id: "threshold", letter: "J", short: "Thresholds", desc: "Re-draw patches at other probability cut-offs.", todo: "Nothing to set — just run it.", group: "test", icon: Layers },
  { id: "compare_periods", letter: "K", short: "Two dates", desc: "Compare this run with another observation date.", todo: "Choose the other run below.", group: "test", icon: CalendarRange },
];

export const GROUPS: { id: KindGroup; label: string; tone: string }[] = [
  { id: "lose", label: "Lose habitat", tone: "#dc2626" },
  { id: "gain", label: "Add habitat", tone: "#15803d" },
  { id: "test", label: "Test the assumptions", tone: "#1e5f8a" },
];

export const kindInfo = (id: string) => KINDS.find((k) => k.id === id);
export const isKind = (v: string | null): v is Kind => !!v && KINDS.some((k) => k.id === v);
