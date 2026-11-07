import type { Metadata } from "next";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import SlideTextButton from "@/components/ui/slide-text-button";

export const metadata: Metadata = {
  title: "Guide — SubNexa",
  description: "How to translate an English subtitle file into Sinhala with SubNexa.",
};

const steps = [
  "Sign in with Google to open your studio.",
  "Upload an English SRT file (up to 2 MB).",
  "Choose an available AI model and a Sinhala style: natural, casual or formal.",
  "Choose SRT or ASS. Glossary buttons are optional: click to add a group, click again to turn it off. You can edit or delete individual rules.",
  "Click Translate. Keep the page open to follow progress. You can pause and resume the same file with the same settings.",
  "Review the Sinhala text and use Edit Sinhala to fix a line. Download your file, or choose Sinhala + English SRT for both languages.",
];

export default function GuidePage() {
  return (
    <div className="dark framer-landing relative isolate min-h-screen overflow-hidden bg-background text-ink">
      <Header overlay showThemeToggle={false} />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(232,232,238,0.12),transparent_70%)]" />

      <main className="relative mx-auto w-full max-w-[1200px] px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
        <Reveal className="max-w-3xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-content-tertiary">Guide</p>
          <h1 className="mt-4 text-[clamp(2.6rem,6vw,4.5rem)] font-bold leading-[0.96] tracking-[-0.045em]">
            How to use SubNexa
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-body">
            Translate an English subtitle file into Sinhala without losing the timing you already trust.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {steps.map((step, index) => (
            <Reveal key={step} delay={index * 0.06}>
              <div className="h-full rounded-[5px] border border-border bg-[var(--next-gray-200)] p-6">
                <span className="font-mono text-[12px] text-content-tertiary">Step {String(index + 1).padStart(2, "0")}</span>
                <p className="mt-3 text-[16px] leading-relaxed text-body">{step}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-[5px] border border-border bg-[var(--next-gray-200)] p-6">
              <h2 className="text-xl font-semibold">Library copies</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-body">
                Completed translations are added to the public library with your display name. Later editor changes are included in your download, but do not update that library copy.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="h-full rounded-[5px] border border-border bg-[var(--next-gray-200)] p-6">
              <h2 className="text-xl font-semibold">Daily limits</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-body">
                Daily limits are shared across your devices. If you reach your limit, your progress stays saved and the message shows when you can continue. Use Request a subtitle or Report a translation issue to send feedback. Requests are not a promise of delivery.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-12">
          <div className="rounded-[5px] border border-border bg-[var(--next-gray-200)] p-6 sm:p-10">
            <h2 className="max-w-2xl text-[clamp(1.8rem,3.5vw,2.6rem)] font-bold leading-[1.05]">
              Ready to translate your first subtitle?
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-body">
              Sign in with Google, upload an English SRT, and review every line before you download.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <SlideTextButton text="Back home" hoverText="Return" href="/" />
              <SlideTextButton text="Browse the library" hoverText="See titles" href="/library" variant="ghost" />
            </div>
          </div>
        </Reveal>
      </main>

      <SiteFooter />
    </div>
  );
}
