"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  Database,
  FileImage,
  Globe2,
  HardDrive,
  Layers,
  Satellite,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EASE } from "@/components/shared/motion";
import { useAnalysis } from "@/hooks/use-analysis";
import { getScenes } from "@/lib/data";
import { fmtDate } from "@/utils/format";
import { cn } from "@/lib/utils";

const FORMATS = [
  { ext: "GeoTIFF", detail: ".tif · .tiff", icon: Layers },
  { ext: "PNG", detail: "8/16-bit", icon: FileImage },
  { ext: "JPEG", detail: ".jpg · .jpeg", icon: FileImage },
  { ext: "Sentinel-2", detail: "SAFE archive", icon: Satellite },
  { ext: "Landsat", detail: "L2SP bundle", icon: Satellite },
];

interface StagedFile {
  name: string;
  sizeMb: number;
  progress: number;
  done: boolean;
}

export default function UploadPage() {
  const router = useRouter();
  const { sceneId, setSceneId } = useAnalysis();
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<StagedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scenes = getScenes();

  /** Simulate a chunked upload so the drop feels like it does real work. */
  const stageFiles = useCallback((incoming: File[]) => {
    const staged: StagedFile[] = incoming.slice(0, 4).map((f) => ({
      name: f.name,
      sizeMb: Math.max(1, Math.round(f.size / 1024 / 1024)),
      progress: 0,
      done: false,
    }));
    if (!staged.length) return;

    setFiles((prev) => [...prev, ...staged]);

    staged.forEach((s) => {
      let p = 0;
      const timer = window.setInterval(() => {
        p = Math.min(100, p + 6 + Math.random() * 16);
        setFiles((prev) =>
          prev.map((f) =>
            f.name === s.name ? { ...f, progress: p, done: p >= 100 } : f,
          ),
        );
        if (p >= 100) window.clearInterval(timer);
      }, 160);
    });
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    stageFiles(Array.from(e.dataTransfer.files));
  };

  const ready = files.length > 0 && files.every((f) => f.done);

  const startAnalysis = (id: string) => {
    setSceneId(id);
    router.push(`/analysis/running?scene=${id}`);
  };

  return (
    <AppShell
      title="New Analysis"
      subtitle="Upload a satellite scene or select a prepared coastal dataset"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {/* ---------------------------------------------------- upload */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300 sm:p-16",
              dragging
                ? "scale-[1.01] border-[#15803d] bg-[#15803d]/8"
                : "border-foreground/12 bg-card/60 hover:border-[#15803d]/40 hover:bg-[#15803d]/4",
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
            <AnimatePresence>
              {dragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0"
                >
                  <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-[#15803d]/25 to-transparent animate-scan" />
                </motion.div>
              )}
            </AnimatePresence>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".tif,.tiff,.png,.jpg,.jpeg,.zip,.SAFE"
              className="hidden"
              onChange={(e) => {
                stageFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />

            <div className="relative">
              <motion.div
                animate={dragging ? { y: -6, scale: 1.06 } : { y: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#15803d]/12 text-[#15803d]"
              >
                <CloudUpload className="h-8 w-8" strokeWidth={1.7} />
              </motion.div>

              <h2 className="mt-5 text-lg font-semibold tracking-tight sm:text-xl">
                {dragging ? "Release to stage scene" : "Drop a satellite scene here"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                Drag and drop a GeoTIFF, Sentinel-2 SAFE archive or Landsat bundle — or click to
                browse. Multispectral scenes give the best segmentation accuracy.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-2">
                {FORMATS.map((f) => (
                  <div
                    key={f.ext}
                    className="flex items-center gap-2 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2"
                  >
                    <f.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="text-left">
                      <div className="text-[11px] font-medium leading-none">{f.ext}</div>
                      <div className="mt-0.5 text-[9px] text-muted-foreground">{f.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* staged files */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
                  <div>
                    <CardTitle>Staged scenes</CardTitle>
                    <CardDescription>
                      {files.filter((f) => f.done).length} of {files.length} transferred
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      disabled={!ready}
                      onClick={() => startAnalysis(sceneId)}
                      className="bg-gradient-eco font-semibold text-[#ffffff]"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Run analysis
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {files.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center gap-3.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] p-3.5"
                    >
                      <div
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
                          f.done ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-[#1e5f8a]/12 text-[#1e5f8a]",
                        )}
                      >
                        {f.done ? (
                          <CheckCircle2 className="h-[18px] w-[18px]" />
                        ) : (
                          <HardDrive className="h-[18px] w-[18px]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-[13px] font-medium">{f.name}</span>
                          <span className="shrink-0 text-[11px] tabular text-muted-foreground">
                            {f.sizeMb} MB
                          </span>
                        </div>
                        <div className="mt-2">
                          <Progress
                            value={f.progress}
                            height={4}
                            striped={!f.done}
                            color={f.done ? "#22c55e" : undefined}
                          />
                        </div>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setFiles((p) => p.filter((x) => x.name !== f.name))}
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -------------------------------------------------- datasets */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-foreground/[0.08]" />
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              or choose a demo dataset
            </span>
            <div className="h-px flex-1 bg-foreground/[0.08]" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {scenes.map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: i * 0.07, ease: EASE }}
                onClick={() => startAnalysis(s.id)}
                className="group overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card/80 text-left backdrop-blur transition-all hover:-translate-y-1 hover:border-[#15803d]/30"
              >
                <div
                  className="relative h-28 overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${s.thumbnailGradient[0]}55, ${s.thumbnailGradient[1]}22)`,
                  }}
                >
                  <div className="absolute inset-0 bg-grid opacity-40" />
                  <Globe2
                    className="absolute -bottom-4 -right-4 h-24 w-24 opacity-15 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"
                    style={{ color: s.thumbnailGradient[0] }}
                  />
                  <div className="absolute left-3 top-3">
                    <Badge variant="secondary" className="backdrop-blur">
                      <Satellite className="h-3 w-3" />
                      {s.sensor.split(" ")[0]}
                    </Badge>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="truncate text-[14px] font-semibold tracking-tight">
                      {s.state}
                    </div>
                    <div className="truncate text-[10.5px] text-white/70">{s.region}</div>
                  </div>
                </div>

                <div className="p-4">
                  <p className="line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>

                  <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
                    {[
                      ["Area", `${s.areaKm2} km²`],
                      ["Res.", `${s.resolutionM} m`],
                      ["Cloud", `${s.cloudCover}%`],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] py-1.5">
                        <div className="text-[11px] font-semibold tabular">{v}</div>
                        <div className="text-[8.5px] uppercase tracking-wider text-muted-foreground">
                          {k}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-foreground/[0.08] pt-3">
                    <span className="text-[10px] text-muted-foreground">
                      {fmtDate(s.acquisitionDate)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-[#15803d] transition-transform group-hover:translate-x-0.5">
                      Analyse
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------ note */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1e5f8a]/12 text-[#1e5f8a]">
              <Database className="h-[18px] w-[18px]" />
            </div>
            <p className="flex-1 text-[12px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Prototype note.</span> Uploaded files
              are staged locally and never leave the browser. Analysis runs against prepared model
              output so the full pipeline can be demonstrated without a processing backend.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
