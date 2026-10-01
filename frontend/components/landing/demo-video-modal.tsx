"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Captions, CaptionsOff, ExternalLink, Loader2, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";

/**
 * "Watch Demo" — a two-minute narrated product story (problem → solution → status → roadmap) in a modal.
 * The video element only exists while the modal is open, so the landing page never downloads it up front.
 * Assets (see docs/DEMO_VIDEO.md): /videos/ecoconnectai-demo.{webm,mp4,en.vtt} and /images/ecoconnectai-demo-poster.webp.
 */
// Bump VERSION whenever the files are replaced, so browsers never mix a cached old file with the new one.
const VERSION = "3";
export const DEMO_VIDEO = {
  webm: `/videos/ecoconnectai-demo.webm?v=${VERSION}`,
  mp4: `/videos/ecoconnectai-demo.mp4?v=${VERSION}`,
  captions: `/videos/ecoconnectai-demo.en.vtt?v=${VERSION}`,
  poster: `/images/ecoconnectai-demo-poster.webp?v=${VERSION}`,
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

export function WatchDemoButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false); // the modal (and its video) is only created after the first click
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setUsed(true);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className={`group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] py-[9px] pl-[9px] pr-4 text-sm font-semibold text-white backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-[#00e599]/45 hover:bg-white/[0.11] hover:shadow-[0_0_28px_-6px_rgba(0,229,153,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e599]/70 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:scale-100 ${className}`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#02151d] shadow-md transition-all duration-300 group-hover:bg-[#00e599] group-hover:shadow-[0_0_18px_rgba(0,229,153,0.6)]">
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current transition-transform duration-300 group-hover:translate-x-[1.5px] motion-reduce:transition-none" />
        </span>
        <span>Watch Demo</span>
      </button>
      {used && <DemoVideoModal open={open} onClose={close} />}
    </>
  );
}

function DemoVideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = useReducedMotion();
  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // scroll lock, inert background, Escape, focus trap — only while open
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = { overflow: html.style.overflow, pad: html.style.paddingRight };
    const gutter = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    if (gutter > 0) html.style.paddingRight = `${gutter}px`;
    const portal = dialog.current?.closest("[data-demo-portal]");
    const inerted = [...document.body.children].filter((el) => el !== portal && !el.hasAttribute("inert"));
    inerted.forEach((el) => el.setAttribute("inert", ""));
    const t = window.setTimeout(() => closeBtn.current?.focus(), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab" && dialog.current) {
        const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      inerted.forEach((el) => el.removeAttribute("inert"));
      html.style.overflow = prev.overflow;
      html.style.paddingRight = prev.pad;
    };
  }, [open, onClose]);

  return createPortal(
    <div data-demo-portal>
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[1300] flex items-center justify-center bg-[#01060c]/75 p-3 backdrop-blur-md sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.28, ease: "easeOut" }}
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
          >
            <motion.div
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="demo-video-title"
              className="relative w-[min(1100px,100%,calc((100dvh-6.5rem)*16/9))] min-w-[min(320px,100%)] overflow-hidden rounded-2xl border border-white/12 bg-[#06111d]/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(0,229,153,0.06)]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
              transition={{ duration: reduce ? 0.12 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5">
                <h2 id="demo-video-title" className="truncate text-sm font-semibold text-white">
                  EcoConnectAI
                </h2>
                <button
                  ref={closeBtn}
                  type="button"
                  onClick={onClose}
                  aria-label="Close demo video"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e599]/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <DemoPlayer />

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
const CTRL =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e599]/70";

/**
 * Mounted only while the modal is open, so state starts fresh each time.
 * Custom controls (play · time · seek · volume · subtitles · fullscreen) so the subtitle toggle sits next to volume.
 * Subtitles are off by default and drawn by us from the caption track (mode "hidden": loaded, not drawn by the browser),
 * so they never collide with the control bar.
 * Errors are read natively: React re-dispatches a child <source>/<track> "error" to the <video> onError prop, which
 * would wrongly show the error screen when only the WebM attempt was interrupted and the MP4 fallback still works.
 * The player gives up only when every source has failed, after one automatic retry.
 */
function DemoPlayer() {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retries = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [subtitles, setSubtitles] = useState(false);
  const [cue, setCue] = useState("");
  const [full, setFull] = useState(false);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const lastSource = v.querySelector("source:last-of-type");
    const giveUp = () => {
      // keep the browser's reason visible for debugging (codec / network / decoder problems differ)
      console.warn("[demo video] playback failed", {
        attempt: retries.current,
        code: v.error?.code,
        message: v.error?.message,
        networkState: v.networkState,
        sources: [...v.querySelectorAll("source")].map((s) => (s as HTMLSourceElement).src),
      });
      if (retries.current < 1) {
        retries.current += 1;
        setAttempt((a) => a + 1); // remount the element with a fresh request
      } else setFailed(true);
    };
    const onVideoError = (e: Event) => e.target === v && v.error && v.error.code !== MediaError.MEDIA_ERR_ABORTED && giveUp();
    v.addEventListener("error", onVideoError);
    lastSource?.addEventListener("error", giveUp);
    // captions: keep the track "hidden" (loaded, never drawn by the browser); onTimeUpdate mirrors the active cue
    const track = v.textTracks[0];
    if (track) track.mode = "hidden";
    return () => {
      v.removeEventListener("error", onVideoError);
      lastSource?.removeEventListener("error", giveUp);
    };
  }, [attempt, failed]);

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.clearTimeout(idleTimer.current);
    };
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };
  // controls fade out after 2.5 s without pointer movement while playing
  const wake = () => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 2500);
  };
  const hideControls = playing && idle;
  const bust = attempt ? `&r=${attempt}` : "";

  if (failed)
    return (
      <div className="relative grid aspect-video w-full place-items-center bg-black p-6 text-center text-sm text-slate-300">
        <div className="space-y-3">
          <p>This browser could not play the video here.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                retries.current = 0;
                setFailed(false);
                setAttempt((a) => a + 1);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e599]/70"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Try again
            </button>
            <a
              href={DEMO_VIDEO.mp4}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00e599] px-4 py-1.5 text-[13px] font-bold text-[#02151d] transition-colors hover:bg-[#00c896] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e599]/70"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open video directly
            </a>
          </div>
        </div>
      </div>
    );

  return (
    <div
      ref={box}
      className={`group/player relative aspect-video w-full bg-black ${hideControls ? "cursor-none" : ""} ${full ? "!aspect-auto h-full" : ""}`}
      onPointerMove={wake}
      onPointerDown={wake}
      onKeyDown={(e) => {
        wake();
        if ((e.key === " " || e.key === "k") && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <video
        key={attempt}
        ref={video}
        className="absolute inset-0 h-full w-full"
        playsInline
        preload="metadata"
        poster={DEMO_VIDEO.poster}
        aria-label="EcoConnectAI product story, under three minutes, narrated"
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          wake();
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setTime(v.currentTime);
          const active = v.textTracks[0]?.activeCues?.[0] as VTTCue | undefined;
          setCue(active ? active.text : "");
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
      >
        <source src={DEMO_VIDEO.webm + bust} type="video/webm" />
        <source src={DEMO_VIDEO.mp4 + bust} type="video/mp4" />
        <track kind="captions" src={DEMO_VIDEO.captions} srcLang="en" label="English" />
      </video>

      {/* big play button before the first play */}
      {!started && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play video"
          className="absolute left-1/2 top-[70%] grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#00e599] text-[#02151d] shadow-[0_0_40px_rgba(0,229,153,0.45)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
        >
          <Play className="ml-1 h-7 w-7 fill-current" />
        </button>
      )}

      {buffering && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
          <Loader2 className="h-8 w-8 animate-spin text-white/80" />
        </div>
      )}

      {/* subtitles (only when switched on) */}
      {subtitles && cue && (
        <div
          className={`pointer-events-none absolute inset-x-0 flex justify-center px-6 transition-[bottom] duration-200 ${hideControls ? "bottom-5" : "bottom-[4.5rem]"}`}
          aria-live="polite"
        >
          <span className="max-w-[85%] rounded-md bg-black/70 px-3 py-1 text-center text-[clamp(13px,1.9vw,20px)] font-medium leading-snug text-white">
            {cue}
          </span>
        </div>
      )}

      {/* control bar */}
      {started && (
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-8 transition-opacity duration-300 sm:px-4 ${hideControls ? "pointer-events-none opacity-0" : "opacity-100"}`}
        >
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => {
              const v = video.current;
              if (v) v.currentTime = Number(e.target.value);
            }}
            aria-label="Seek"
            aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
            className="block h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-[#00e599] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00e599]"
            style={{ background: `linear-gradient(90deg, #00e599 ${duration ? (time / duration) * 100 : 0}%, rgba(255,255,255,0.25) 0)` }}
          />
          <div className="mt-1.5 flex items-center gap-1">
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className={CTRL}>
              {playing ? <Pause className="h-[18px] w-[18px] fill-current" /> : <Play className="ml-0.5 h-[18px] w-[18px] fill-current" />}
            </button>
            <span className="ml-1 text-[12.5px] tabular-nums text-white/85">
              {fmt(time)} / {fmt(duration)}
            </span>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  const v = video.current;
                  if (v) v.muted = !v.muted;
                }}
                aria-label={muted ? "Unmute" : "Mute"}
                className={CTRL}
              >
                {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
              </button>
              <button
                type="button"
                onClick={() => setSubtitles((s) => !s)}
                aria-pressed={subtitles}
                aria-label={subtitles ? "Hide subtitles" : "Show subtitles"}
                title={subtitles ? "Hide subtitles" : "Show subtitles"}
                className={`${CTRL} ${subtitles ? "!text-[#00e599]" : ""}`}
              >
                {subtitles ? <Captions className="h-[18px] w-[18px]" /> : <CaptionsOff className="h-[18px] w-[18px]" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else void box.current?.requestFullscreen?.().catch(() => {});
                }}
                aria-label={full ? "Exit full screen" : "Full screen"}
                className={CTRL}
              >
                {full ? <Minimize className="h-[18px] w-[18px]" /> : <Maximize className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
