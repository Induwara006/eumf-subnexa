import type { ElementType } from "react";
import { Clock3, Languages, ListChecks } from "lucide-react";
import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from "@/components/ui/text-reveal-card";

function FeatureIcon({ icon: Icon }: { icon: ElementType }) {
  return (
    <span className="grid size-12 place-items-center rounded-[5px] bg-[var(--next-gray-100)] text-ink">
      <Icon className="size-6" strokeWidth={1.5} />
    </span>
  );
}

type Feature = {
  icon: ElementType;
  title: string;
  description: string;
  points: string[];
};

const features: Feature[] = [
  {
    icon: Clock3,
    title: "Timing never moves",
    description:
      "Every timestamp is preserved byte for byte. Only the dialogue is rewritten, so your cues stay exactly where the player expects them.",
    points: [
      "Original cue in and out times are untouched",
      "Works with SRT, ASS and bilingual subtitle files",
      "No re-syncing after a translation run",
    ],
  },
  {
    icon: Languages,
    title: "Sinhala first",
    description:
      "Tuned prompts and a Sinhala-aware review panel produce natural dialogue, not a word-for-word pass from a generic translator.",
    points: [
      "Phrasing tuned for spoken Sinhala",
      "Source and target shown side by side",
      "Every line stays yours to edit",
    ],
  },
  {
    icon: ListChecks,
    title: "Glossary control",
    description:
      "Group rules for names, places and fandom terms keep long-running shows consistent across every episode and every translator.",
    points: [
      "Shared glossary groups across a whole series",
      "Per-line overrides when a term needs context",
      "Changes flow straight into the final export",
    ],
  },
];

export default function FeaturesAlternating() {
  return (
    <section id="sn-features" className="relative mx-auto w-full max-w-[1200px] scroll-mt-28 px-5 pb-24 sm:px-8">
      <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-bold leading-[1.05]">
        Everything a subtitle actually needs.
      </h2>
      <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-body">
        Powerful, focused tooling to help you translate, review and publish Sinhala subtitles without breaking the timing you already trust.
      </p>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {features.map((feature) => (
          <TextRevealCard
            key={feature.title}
            text={feature.title}
            revealText={feature.description}
            className="w-full rounded-[5px] border border-border bg-[var(--next-gray-200)] p-6"
          >
            <div className="flex items-center gap-3">
              <FeatureIcon icon={feature.icon} />
              <TextRevealCardTitle className="text-ink">{feature.title}</TextRevealCardTitle>
            </div>
            <TextRevealCardDescription className="text-body">
              {feature.points.join(" · ")}
            </TextRevealCardDescription>
          </TextRevealCard>
        ))}
      </div>
    </section>
  );
}
