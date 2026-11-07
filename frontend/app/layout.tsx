import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, Inter_Tight } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import UserPresence from "@/components/UserPresence";
import BackendWarmup from "@/components/BackendWarmup";

const inter = Inter({
  variable: "--font-inter",
  display: "swap",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  display: "swap",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geist = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  src: [{ path: "./fonts/geist-latin.woff2", weight: "100 900", style: "normal" }],
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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${interTight.variable} ${geist.variable} ${notoSinhala.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("subnexa-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
        <link
          href="https://db.onlinewebfonts.com/c/31255a1d1395bb91aec77d16e2e26fdc?family=Rifton+Norm"
          rel="stylesheet"
        />
        <link
          href="https://db.onlinewebfonts.com/c/760c3a7c48d97f8fbc0019404a5923c3?family=ROUND+8+THREE"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <BackendWarmup />
        <UserPresence />
        <Toaster theme="system" position="bottom-right" />
      </body>
    </html>
  );
}
