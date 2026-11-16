import type { Metadata } from "next";
import { DM_Mono, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { ContentProvider } from "@/components/ContentProvider";
import { FlowProvider } from "@/components/FlowProvider";
import { KioskMode } from "@/components/KioskMode";
import { getSiteContent } from "@/lib/api/content";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your U Score™ — Experiment U™",
  description:
    "Five measurements. Five minutes. One number that marks where your experiment begins.",
};

// Self-hosted at build time: no render-blocking request to Google Fonts on page load. The variables
// feed --serif, --sans and --mono in globals.css. Newsreader's two variable files are ~270 KB, so
// they aren't preloaded: on mobile that would crowd out the page's own CSS and JS, and `swap` shows
// the Georgia fallback until they arrive.
const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  preload: false,
  variable: "--font-newsreader",
});
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-jakarta" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--font-dm-mono" });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const content = await getSiteContent();
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <ContentProvider content={content}>
          <FlowProvider>
            <KioskMode />
            {children}
          </FlowProvider>
        </ContentProvider>
      </body>
    </html>
  );
}
