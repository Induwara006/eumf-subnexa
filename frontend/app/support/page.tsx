import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import CommunityForm from "@/components/CommunityForm";
import { getFaqs, type Faq } from "@/lib/faq-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Support and FAQ | SubNexa",
  description:
    "Answers to common questions about SubNexa Sinhala subtitles, and a form to report a translation issue.",
  alternates: { canonical: "https://subnexa.lk/support" },
};

// Shown only when the database cannot be reached.
const DEFAULT_FAQS: Faq[] = [
  {
    id: "d1",
    question: "How do I translate a subtitle?",
    answer:
      "Sign in with Google to open your studio, upload an English SRT file (up to 2 MB), choose a Sinhala style, then click Translate. Keep the page open to follow progress.",
  },
  {
    id: "d2",
    question: "Are library downloads free?",
    answer: "Yes. Subtitles in the library are free to download and no sign-in is needed.",
  },
  {
    id: "d3",
    question: "Which file formats can I use?",
    answer: "Upload an English SRT file. You can download the Sinhala result as SRT or ASS.",
  },
  {
    id: "d4",
    question: "Are my translations made public?",
    answer:
      "Completed translations are added to the public library with your display name. Later editor changes are included in your download but do not update the library copy.",
  },
  {
    id: "d5",
    question: "What are the daily limits?",
    answer:
      "Daily limits are shared across your devices. If you reach your limit, your progress stays saved and the message shows when you can continue.",
  },
  {
    id: "d6",
    question: "Can I request a subtitle?",
    answer:
      "Yes, use Request a subtitle on the Library page. Requests are reviewed and delivery is not guaranteed.",
  },
];

export default async function SupportPage() {
  const loaded = await getFaqs();
  const faqs = loaded ?? DEFAULT_FAQS;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <div className="dark framer-landing relative isolate min-h-screen overflow-hidden bg-background text-ink">
      <Header overlay showThemeToggle={false} />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(232,232,238,0.12),transparent_70%)]" />

      <main className="relative mx-auto w-full max-w-[1200px] px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
        <Reveal className="max-w-3xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-content-tertiary">Support</p>
          <h1 className="mt-4 text-[clamp(2.4rem,5.5vw,4rem)] font-bold leading-[0.98] tracking-[-0.045em]">
            How can we help?
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-body">
            Find quick answers below, or report a translation issue and our team will review it.{" "}
            <Link href="/guide" className="underline underline-offset-4">
              Read the full guide
            </Link>
            .
          </p>
        </Reveal>

        {faqs.length > 0 && (
          <section id="faq" aria-label="Frequently asked questions" className="mt-12 max-w-3xl">
            <h2 className="text-xl font-semibold">Frequently asked questions</h2>
            <div className="mt-4 space-y-2">
              {faqs.map((f) => (
                <details
                  key={f.id}
                  className="group rounded-[5px] border border-border bg-[var(--next-gray-200)] px-4 py-3"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    <span>{f.question}</span>
                    <span aria-hidden className="text-content-tertiary transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-body">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section id="report" aria-label="Report a translation issue" className="mt-12 max-w-2xl">
          <CommunityForm kind="report" />
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
