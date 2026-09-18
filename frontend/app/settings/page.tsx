"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Globe,
  Image as ImageIcon,
  Map as MapIcon,
  Monitor,
  Moon,
  Palette,
  Ruler,
  Save,
  Sun,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { EASE } from "@/components/shared/motion";
import { BASEMAPS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light" | "system";
type Units = "metric" | "imperial";

const EXPORTS = [
  { id: "pdf", label: "PDF report", detail: "Full scientific assessment", icon: FileText },
  { id: "geojson", label: "GeoJSON", detail: "Habitat patches + graph", icon: FileJson },
  { id: "csv", label: "CSV", detail: "Patch attribute table", icon: FileSpreadsheet },
  { id: "png", label: "PNG map", detail: "Rendered map composite", icon: ImageIcon },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>("light");
  const [basemap, setBasemap] = useState<string>("satellite");
  const [units, setUnits] = useState<Units>("metric");
  const [coordFormat, setCoordFormat] = useState<"dms" | "decimal">("dms");
  const [selectedExports, setSelectedExports] = useState<string[]>(["pdf", "geojson"]);
  const [labelDensity, setLabelDensity] = useState(60);
  const [saved, setSaved] = useState(false);

  const [prefs, setPrefs] = useState({
    animations: true,
    highContrast: false,
    autoRun: true,
    showConfidence: true,
    notifications: true,
  });

  // Theme is applied by toggling the `light` class the design system defines.
  useEffect(() => {
    const root = document.documentElement;
    const prefersLight =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
        : theme === "light";
    root.classList.toggle("light", prefersLight);
  }, [theme]);

  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const toggleExport = (id: string) =>
    setSelectedExports((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <AppShell
      title="Settings"
      subtitle="Appearance, map defaults, units and export preferences"
      actions={
        <Button
          size="sm"
          onClick={save}
          className={cn(
            "font-semibold transition-colors",
            saved ? "bg-[#22c55e] text-[#ffffff]" : "bg-gradient-eco text-[#ffffff]",
          )}
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save changes
            </>
          )}
        </Button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-5">
        {/* ------------------------------------------------ appearance */}
        <Section
          index={0}
          icon={Palette}
          title="Appearance"
          description="EcoConnectAI is designed dark-first; light mode is provided for printed briefings."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { id: "dark" as Theme, label: "Dark", icon: Moon, hint: "Default" },
              { id: "light" as Theme, label: "Light", icon: Sun, hint: "For print" },
              { id: "system" as Theme, label: "System", icon: Monitor, hint: "Match OS" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                  theme === t.id
                    ? "border-[#15803d]/40 bg-[#15803d]/10"
                    : "border-foreground/[0.08] bg-foreground/[0.03] hover:bg-foreground/[0.08]",
                )}
              >
                <div
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    theme === t.id ? "bg-[#15803d]/18 text-[#15803d]" : "bg-foreground/[0.06] text-muted-foreground",
                  )}
                >
                  <t.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium">{t.label}</div>
                  <div className="text-[10px] text-muted-foreground">{t.hint}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <Toggle
              label="Interface animations"
              hint="Motion communicates state changes — disable for reduced-motion preference"
              checked={prefs.animations}
              onChange={(v) => setPrefs({ ...prefs, animations: v })}
            />
            <Toggle
              label="High contrast mode"
              hint="Increases border and text contrast for projection"
              checked={prefs.highContrast}
              onChange={(v) => setPrefs({ ...prefs, highContrast: v })}
            />
          </div>
        </Section>

        {/* ------------------------------------------------- map style */}
        <Section
          index={1}
          icon={MapIcon}
          title="Map defaults"
          description="Applied whenever a new analysis opens."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBasemap(b.id)}
                className={cn(
                  "overflow-hidden rounded-xl border text-left transition-all",
                  basemap === b.id
                    ? "border-[#15803d]/40 ring-2 ring-[#15803d]/20"
                    : "border-foreground/[0.08] hover:border-foreground/20",
                )}
              >
                <div
                  className="relative h-16"
                  style={{
                    background:
                      b.id === "satellite"
                        ? "linear-gradient(135deg, #1e3a2f, #0f2027)"
                        : b.id === "terrain"
                          ? "linear-gradient(135deg, #3f3a2a, #1f2417)"
                          : b.id === "dark"
                            ? "linear-gradient(135deg, #1a1f2e, #0b1120)"
                            : "linear-gradient(135deg, #23384a, #101c26)",
                  }}
                >
                  <div className="absolute inset-0 bg-grid opacity-40" />
                  {basemap === b.id && (
                    <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#15803d]">
                      <Check className="h-3 w-3 text-[#ffffff]" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="bg-foreground/[0.03] px-3 py-2 text-[11.5px] font-medium">{b.label}</div>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11.5px] font-medium">Label density</span>
              <span className="text-[11px] font-bold tabular text-[#15803d]">{labelDensity}%</span>
            </div>
            <Slider
              value={labelDensity}
              onValueChange={setLabelDensity}
              aria-label="Label density"
            />
          </div>

          <div className="mt-4 space-y-3">
            <Toggle
              label="Show model confidence"
              hint="Displays per-output confidence values across map and panels"
              checked={prefs.showConfidence}
              onChange={(v) => setPrefs({ ...prefs, showConfidence: v })}
            />
            <Toggle
              label="Auto-run analysis on upload"
              hint="Starts the pipeline as soon as a scene finishes transferring"
              checked={prefs.autoRun}
              onChange={(v) => setPrefs({ ...prefs, autoRun: v })}
            />
          </div>
        </Section>

        {/* ----------------------------------------------------- units */}
        <Section
          index={2}
          icon={Ruler}
          title="Units & coordinates"
          description="Affects every readout, chart axis and exported table."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Measurement system
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "metric" as Units, label: "Metric", hint: "ha · km · m" },
                  { id: "imperial" as Units, label: "Imperial", hint: "ac · mi · ft" },
                ].map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setUnits(u.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      units === u.id
                        ? "border-[#15803d]/40 bg-[#15803d]/10"
                        : "border-foreground/[0.08] bg-foreground/[0.03] hover:bg-foreground/[0.08]",
                    )}
                  >
                    <div className="text-[12.5px] font-medium">{u.label}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{u.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Coordinate format
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "dms" as const, label: "DMS", hint: `9° 52' 41.3" N` },
                  { id: "decimal" as const, label: "Decimal", hint: "9.87814° N" },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCoordFormat(c.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      coordFormat === c.id
                        ? "border-[#15803d]/40 bg-[#15803d]/10"
                        : "border-foreground/[0.08] bg-foreground/[0.03] hover:bg-foreground/[0.08]",
                    )}
                  >
                    <div className="text-[12.5px] font-medium">{c.label}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {c.hint}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 py-3">
            <Globe className="h-4 w-4 shrink-0 text-[#1e5f8a]" />
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-medium">Projection</div>
              <div className="text-[10px] text-muted-foreground">
                Analysis runs in the scene&apos;s native UTM zone; display is WGS 84 (EPSG:4326)
              </div>
            </div>
            <Badge variant="sky">EPSG:4326</Badge>
          </div>
        </Section>

        {/* --------------------------------------------------- exports */}
        <Section
          index={3}
          icon={Download}
          title="Export options"
          description="Formats included when exporting an analysis."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {EXPORTS.map((e) => {
              const on = selectedExports.includes(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => toggleExport(e.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                    on
                      ? "border-[#15803d]/40 bg-[#15803d]/10"
                      : "border-foreground/[0.08] bg-foreground/[0.03] hover:bg-foreground/[0.08]",
                  )}
                >
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                      on ? "bg-[#15803d]/18 text-[#15803d]" : "bg-foreground/[0.06] text-muted-foreground",
                    )}
                  >
                    <e.icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium">{e.label}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{e.detail}</div>
                  </div>
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
                      on ? "border-[#15803d] bg-[#15803d]" : "border-foreground/20",
                    )}
                  >
                    {on && <Check className="h-3 w-3 text-[#ffffff]" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Toggle
              label="Email notification on completion"
              hint="Sends a summary when a long-running analysis finishes"
              checked={prefs.notifications}
              onChange={(v) => setPrefs({ ...prefs, notifications: v })}
            />
          </div>
        </Section>

        {/* ------------------------------------------------------ about */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[13px] font-semibold">EcoConnectAI</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Backend version and model registry are reported by the API (/api/health, /api/models) — see Data &amp; Models.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">All systems operational</Badge>
              <Badge variant="secondary">Build 2026.08.08</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* sub-components                                                      */
/* ------------------------------------------------------------------ */

function Section({
  icon: Icon,
  title,
  description,
  children,
  index = 0,
}: {
  icon: typeof Palette;
  title: string;
  description: string;
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: EASE }}
    >
      <Card>
        <CardHeader className="flex-row items-start gap-3 pb-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#15803d]/12 text-[#15803d]">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 py-3">
      <span className="min-w-0">
        <span className="block text-[12px] font-medium">{label}</span>
        <span className="block text-[10.5px] leading-snug text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}
