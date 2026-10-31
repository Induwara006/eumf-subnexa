import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import BackendWarmup from "@/components/BackendWarmup";

const monaSans = localFont({
  variable: "--font-mona-sans",
  display: "swap",
  weight: "200 900",
  src: "./fonts/mona-sans-variable.woff2",
});

const bricolage = localFont({
  variable: "--font-bricolage",
  display: "swap",
  weight: "200 800",
  src: "./fonts/bricolage-grotesque-latin.woff2",
});

const geist = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
  src: "./fonts/geist-latin.woff2",
});

const notoSinhala = localFont({
  variable: "--font-sinhala",
  display: "swap",
  src: [{ path: "./fonts/noto-sans-sinhala-sinhala-400-normal.woff2", weight: "400", style: "normal" }],
});

export const metadata: Metadata = {
  title: "SubNexa — Every story, in Sinhala",
  description: "Translate SRT subtitles into natural Sinhala. Every timestamp stays untouched.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${monaSans.variable} ${bricolage.variable} ${geist.variable} ${notoSinhala.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[#141414]">
        <TooltipProvider>{children}</TooltipProvider>
        <BackendWarmup />
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
