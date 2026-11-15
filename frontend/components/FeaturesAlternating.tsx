import Reveal from "@/components/Reveal";
import { WobbleCard } from "@/components/ui/wobble-card";

type Feature = {
  title: string;
  description: string;
  points: string[];
  card: string;
};

const features: Feature[] = [
  {
    title: "Timing never moves",
    description:
      "Every timestamp is preserved byte for byte. Only the dialogue is rewritten, so your cues stay exactly where the player expects them.",
    points: [
      "Original cue in and out times are untouched",
      "Works with SRT, ASS and bilingual subtitle files",
      "No re-syncing after a translation run",
    ],
    card: "bg-sky-400",
  },
  {
    title: "Sinhala first",
    description:
      "Tuned prompts and a Sinhala-aware review panel produce natural dialogue, not a word-for-word pass from a generic translator.",
    points: [
      "Phrasing tuned for spoken Sinhala",
      "Source and target shown side by side",
      "Every line stays yours to edit",
    ],
    card: "bg-amber-400",
  },
  {
    title: "Glossary control",
    description:
      "Group rules for names, places and fandom terms keep long-running shows consistent across every episode and every translator.",
    points: [
      "Shared glossary groups across a whole series",
      "Per-line overrides when a term needs context",
      "Changes flow straight into the final export",
    ],
    card: "bg-emerald-400",
  },
];

function FeatureContent({
  feature,
  wide = false,
}: {
  feature: Feature;
  wide?: boolean;
}) {
  return (
    <div className="relative z-10 h-full">
      <h3
        className={`font-semibold tracking-[-0.02em] text-slate-950 ${
          wide ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
        }`}
      >
        {feature.title}
      </h3>
      <p
        className={`mt-3 text-pretty text-base leading-relaxed text-slate-900/80 md:text-lg ${
          wide ? "max-w-2xl" : ""
        }`}
      >
        {feature.description}
      </p>
      <ul
        className={`mt-6 border-t border-slate-950/15 pt-5 ${
          wide ? "grid gap-2 sm:grid-cols-3" : "space-y-2"
        }`}
      >
        {feature.points.map((point) => (
          <li
            key={point}
            className="text-base leading-relaxed text-slate-900/80 md:text-[17px]"
          >
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FeaturesAlternating() {
  return (
    <section
      id="sn-features"
      className="relative mx-auto w-full max-w-[1200px] scroll-mt-28 px-5 pb-24 sm:px-8"
    >
      <Reveal className="max-w-2xl">
        <h2 className="font-display text-balance text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
          Everything a subtitle actually needs.
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-[16px] leading-relaxed text-body">
          Powerful, focused tooling to help you translate, review and publish
          Sinhala subtitles without breaking the timing you already trust.
        </p>
      </Reveal>

      <Reveal delay={0.08} className="mt-12">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <WobbleCard
            containerClassName={`${features[0].card} col-span-1 min-h-[340px] lg:col-span-2`}
            className="px-6 py-10 sm:px-10"
          >
            <FeatureContent feature={features[0]} />
          </WobbleCard>
          <WobbleCard
            containerClassName={`${features[1].card} col-span-1 min-h-[340px]`}
            className="px-6 py-10 sm:px-10"
          >
            <FeatureContent feature={features[1]} />
          </WobbleCard>
          <WobbleCard
            containerClassName={`${features[2].card} col-span-1 min-h-[280px] lg:col-span-3`}
            className="px-6 py-10 sm:px-10"
          >
            <FeatureContent feature={features[2]} wide />
          </WobbleCard>
        </div>
      </Reveal>
    </section>
  );
}
