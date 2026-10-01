"use client";

import { LandingNavbar } from "@/components/landing/landing-navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { CoreInsightSection } from "@/components/landing/core-insight-section";
import { PipelineFlowSection } from "@/components/landing/pipeline-flow-section";
import { CapabilitiesSection } from "@/components/landing/capabilities-section";
import { LiveProductSection } from "@/components/landing/live-product-section";
import { StudyAreasSection } from "@/components/landing/study-areas-section";
import { RestorationSection } from "@/components/landing/restoration-section";
import { WhyEcoConnectSection } from "@/components/landing/why-ecoconnect-section";
import { ResponsibleAISection } from "@/components/landing/responsible-ai-section";
import { CTASection } from "@/components/landing/cta-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingStoryProvider } from "@/hooks/use-landing-story";
import { Reveal, ScrollBlurProvider } from "@/components/landing/scroll-reveal";

export default function LandingPage() {
  return (
    <LandingStoryProvider>
    <ScrollBlurProvider>
    <div id="home" className="min-h-screen bg-[#050c18] text-[#f8fafc] antialiased selection:bg-[#00c896]/30 selection:text-white">
      {/* 1. Fixed / Sticky Premium Navbar */}
      <LandingNavbar />

      {/* 2. Hero Section matching reference screenshot: 3D Floating Command Center, Video Atmosphere & Highlights Strip */}
      <HeroSection />

      {/* 3. The Core Insight Section: "Knowing where habitat exists is only the beginning" */}
      <Reveal><CoreInsightSection /></Reveal>

      {/* 4. "From Satellite to Decision" 8-Stage Animated Pipeline Flow */}
      <Reveal><PipelineFlowSection /></Reveal>

      {/* 5. Six Core Product Capabilities with Mini UI Previews */}
      <Reveal><CapabilitiesSection /></Reveal>

      {/* 6. Live Interactive Command Center & Patch Removal Simulation Showcase */}
      <Reveal><LiveProductSection /></Reveal>

      {/* 7. Four Iconic Coastal Demonstration Landscapes (Vembanad, Sundarbans, Mannar, Bhitarkanika) */}
      <Reveal><StudyAreasSection /></Reveal>

      {/* 8. Targeted Restoration Section with Satellite Overlay & Opportunity Card */}
      <Reveal><RestorationSection /></Reveal>

      {/* 9. Why EcoConnectAI: Decision-Support Philosophy & 6 Capability Pillars */}
      <Reveal><WhyEcoConnectSection /></Reveal>

      {/* 10. Responsible AI, Provenance & Audit Readiness */}
      <Reveal><ResponsibleAISection /></Reveal>

      {/* 11. Final High-Impact Call to Action */}
      <Reveal><CTASection /></Reveal>

      {/* 12. Enterprise / Government Conservation Intelligence Footer */}
      <LandingFooter />
    </div>
    </ScrollBlurProvider>
    </LandingStoryProvider>
  );
}
