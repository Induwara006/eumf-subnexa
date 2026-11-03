import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import BackendWarmup from "@/components/BackendWarmup";

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
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${notoSinhala.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("subnexa-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <BackendWarmup />
        <Toaster theme="system" position="bottom-right" />
      </body>
    </html>
  );
}
