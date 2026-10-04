"use client";

import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Styled replacement for a native <select>: a button plus a listbox popover.
 * Keyboard: ↑/↓ to move, Enter/Space to pick, Esc to close; click outside closes.
 */
export function SelectMenu({
  value, options, onChange, icon: Icon, label, className, menuClassName, align = "left",
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  icon?: ComponentType<{ className?: string }>;
  label: string; // accessible name
  className?: string;
  menuClassName?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const pick = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
  };
  const toggle = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen((o) => !o);
  };

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) return toggle();
            setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
          } else if ((e.key === "Enter" || e.key === " ") && open) {
            e.preventDefault();
            pick(active);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-xl border bg-white px-3 text-left text-[13px] font-medium text-foreground transition-[border-color,box-shadow]",
          open ? "border-[#15803d] shadow-[0_0_0_3px_rgba(21,128,61,0.12)]" : "border-black/[0.08] hover:border-black/[0.16]",
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-[#15803d]" />}
        <span className="min-w-0 flex-1 truncate">{current?.label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          ref={list}
          id={id}
          role="listbox"
          aria-label={label}
          className={cn(
            "absolute top-[calc(100%+6px)] z-[1250] max-h-72 min-w-full overflow-auto rounded-xl border border-black/[0.08] bg-white p-1 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] animate-in fade-in-0 zoom-in-95",
            align === "right" ? "right-0" : "left-0",
            menuClassName,
          )}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                data-i={i}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(i); }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px]",
                  i === active ? "bg-[#f0fdf4]" : "",
                  selected ? "font-semibold text-[#0f5132]" : "text-foreground",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-[11px] font-normal text-muted-foreground">{o.hint}</span>}
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-[#15803d]" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
