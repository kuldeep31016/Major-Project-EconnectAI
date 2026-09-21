import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AnalysisProvider } from "@/hooks/use-analysis";
import { AuthProvider } from "@/hooks/use-auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssistantLauncher } from "@/components/chat/assistant-launcher";
import { BRAND } from "@/lib/constants";

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
  themeColor: "#0f5132",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className="antialiased scroll-slim font-sans">
        <AuthProvider>
          <AnalysisProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <AssistantLauncher />
            </TooltipProvider>
          </AnalysisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
