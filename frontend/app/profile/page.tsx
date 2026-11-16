import type { Metadata } from "next";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import ProfilePanel from "@/components/ProfilePanel";

// Private page: keep it out of search results.
export const metadata: Metadata = {
  title: "Your profile | SubNexa",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <div className="dark framer-landing relative isolate min-h-screen overflow-hidden bg-background text-ink">
      <Header overlay showThemeToggle={false} />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(232,232,238,0.12),transparent_70%)]" />

      <main className="relative mx-auto w-full max-w-[1200px] px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
        <Reveal className="max-w-3xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-content-tertiary">Account</p>
          <h1 className="mt-4 text-[clamp(2.4rem,5.5vw,4rem)] font-bold leading-[0.98] tracking-[-0.045em]">
            Your profile
          </h1>
        </Reveal>

        <Reveal className="mt-12" delay={0.1}>
          <ProfilePanel />
        </Reveal>
      </main>

      <SiteFooter />
    </div>
  );
}
