import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

const notoSinhala = localFont({
  variable: "--font-sinhala",
  display: "swap",
  src: [{ path: "./fonts/noto-sans-sinhala-sinhala-400-normal.woff2", weight: "400", style: "normal" }],
});

export const metadata: Metadata = {
  title: "SubNexa — English to Sinhala subtitle studio",
  description: "Translate SRT subtitles into natural Sinhala. Every timestamp stays untouched.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${notoSinhala.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
