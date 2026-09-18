import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AnalysisProvider } from "@/hooks/use-analysis";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssistantLauncher } from "@/components/chat/assistant-launcher";
import { BRAND } from "@/lib/constants";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — Coastal Habitat Connectivity Intelligence`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.tagline,
  keywords: [
    "coastal conservation",
    "habitat connectivity",
    "remote sensing",
    "GIS",
    "mangrove",
    "Sentinel-2",
  ],
};

export const viewport: Viewport = {
  themeColor: "#050816",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Font variables belong on <html> so the `font-sans` base rule can resolve them.
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="antialiased scroll-slim">
        <AnalysisProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <AssistantLauncher />
          </TooltipProvider>
        </AnalysisProvider>
      </body>
    </html>
  );
}
