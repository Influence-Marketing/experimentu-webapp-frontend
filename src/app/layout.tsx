import type { Metadata } from "next";
import { FlowProvider } from "@/components/FlowProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your U Score™ — Experiment U™",
  description:
    "Five measurements. Five minutes. One number that marks where your experiment begins.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Plus+Jakarta+Sans:wght@300..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <FlowProvider>{children}</FlowProvider>
      </body>
    </html>
  );
}
