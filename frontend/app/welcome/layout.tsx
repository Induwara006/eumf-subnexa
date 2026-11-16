import type { Metadata } from "next";

// Same content as "/", so keep it out of search results and point Google to "/".
export const metadata: Metadata = {
  alternates: { canonical: "https://subnexa.lk/" },
  robots: { index: false, follow: true },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
