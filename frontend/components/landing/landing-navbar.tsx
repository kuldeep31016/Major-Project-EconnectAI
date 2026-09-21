"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Compass, Layers, Leaf, Menu, X } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "#insight", label: "The Insight" },
  { id: "#how-it-works", label: "How It Works" },
  { id: "#capabilities", label: "Capabilities" },
  { id: "#study-areas", label: "Study Areas" },
  { id: "#restoration", label: "Restoration" },
  { id: "#why-ecoconnect", label: "About" },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[1200] transition-all duration-300 ${
        scrolled
          ? "bg-[#040d18]/90 backdrop-blur-xl border-b border-white/10 shadow-xl py-2.5"
          : "bg-gradient-to-b from-black/70 via-black/30 to-transparent py-3.5"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo matching reference */}
        <Link href="#home" className="group flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#00e599] to-[#0d9488] text-[#041a12] shadow-md shadow-[#00e599]/20 transition-transform duration-300 group-hover:scale-105">
            <Leaf className="h-5 w-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-0.5 text-[20px] tracking-tight text-white leading-none font-black">
              <span>EcoConnect</span>
              <span className="text-[#00e599]">AI</span>
            </div>
          </div>
        </Link>

        {/* Center Desktop Navigation */}
        <nav className="hidden items-center gap-2 lg:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={item.id}
              className="px-3 py-1 text-[13px] font-medium text-slate-200 transition-all duration-200 hover:text-[#00e599] hover:underline underline-offset-4 decoration-[#00e599]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right Action CTA Button */}
        <div className="flex items-center gap-3">
          <Link
            href="/command"
            className="group relative inline-flex items-center gap-1.5 rounded-full bg-[#00e599] px-5 py-2.5 text-[13px] font-extrabold text-[#041a12] shadow-lg shadow-[#00e599]/25 transition-all duration-300 hover:bg-[#00c896] hover:shadow-[#00c896]/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Launch Command Center</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-white/5 text-slate-200 backdrop-blur-md transition-colors hover:bg-white/10 lg:hidden"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-b border-white/10 bg-[#050c18]/98 px-6 py-4 backdrop-blur-2xl lg:hidden animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={item.id}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium text-slate-200 hover:text-[#00c896] hover:bg-white/5"
              >
                <span>{item.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </a>
            ))}
            <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
              <Link
                href="/command"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#00c896] py-2 text-center text-[12.5px] font-bold text-[#04231b]"
              >
                <Compass className="h-3.5 w-3.5" /> Command
              </Link>
              <Link
                href="/analysis?scene=kerala-coast"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 py-2 text-center text-[12.5px] font-semibold text-white"
              >
                <Layers className="h-3.5 w-3.5" /> Live Map
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
