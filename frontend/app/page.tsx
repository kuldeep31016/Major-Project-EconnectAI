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
import { PurposeSection } from "@/components/landing/purpose-section";
import { LandingStoryProvider } from "@/hooks/use-landing-story";

export default function LandingPage() {
  return (
    <LandingStoryProvider>
    <div id="home" className="min-h-screen bg-[#050c18] text-[#f8fafc] antialiased selection:bg-[#00c896]/30 selection:text-white">
      {/* 1. Fixed / Sticky Premium Navbar */}
      <LandingNavbar />

      {/* 2. Hero Section matching reference screenshot: 3D Floating Command Center, Video Atmosphere & Highlights Strip */}
      <HeroSection />

      {/* Honesty strip: every figure below comes from a stored development run */}
      <div className="border-y border-amber-400/20 bg-amber-400/[0.06] px-6 py-2.5 text-center text-[12px] text-amber-100/90">
        Research prototype. Figures on this page come from a stored Kerala development run (U-Net EfficientNet-B0,
        Sentinel-1, scored against Global Mangrove Watch reference labels). Scenarios are simulations, and nothing
        here has been validated in the field.
      </div>

      {/* Plain-language purpose: problem, what it does, who it is for, where it stands, what support unlocks */}
      <PurposeSection />

      {/* 3. The Core Insight Section: "Knowing where habitat exists is only the beginning" */}
      <CoreInsightSection />

      {/* 4. "From Satellite to Decision" 8-Stage Animated Pipeline Flow */}
      <PipelineFlowSection />

      {/* 5. Six Core Product Capabilities with Mini UI Previews */}
      <CapabilitiesSection />

      {/* 6. Live Interactive Command Center & Patch Removal Simulation Showcase */}
      <LiveProductSection />

      {/* 7. Four Iconic Coastal Demonstration Landscapes (Vembanad, Sundarbans, Mannar, Bhitarkanika) */}
      <StudyAreasSection />

      {/* 8. Targeted Restoration Section with Satellite Overlay & Opportunity Card */}
      <RestorationSection />

      {/* 9. Why EcoConnectAI: Decision-Support Philosophy & 6 Capability Pillars */}
      <WhyEcoConnectSection />

      {/* 10. Responsible AI, Provenance & Audit Readiness */}
      <ResponsibleAISection />

      {/* 11. Final High-Impact Call to Action */}
      <CTASection />

      {/* 12. Enterprise / Government Conservation Intelligence Footer */}
      <LandingFooter />
    </div>
    </LandingStoryProvider>
  );
}
