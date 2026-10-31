import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryBrowser } from "@/components/SubtitleLibrary";
export const metadata = {title: "Season subtitles — SubNexa", description: "Browse Sinhala subtitles by episode."};
export default async function SeasonPage({params}: {params: Promise<{key: string}>}) {
  const {key} = await params;
  if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(key)) notFound();
  return <div className="min-h-screen bg-[#141414] text-white">
    <header className="border-b border-white/10 px-4 py-5 sm:px-8"><div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
      <Link href="/" className="text-2xl font-bold text-primary">SubNexa</Link>
      <Link href="/library" className="text-sm text-white/70 hover:text-white">← All subtitles</Link>
    </div></header>
    <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-8"><LibraryBrowser key={key} api="" seasonKey={key} /></main>
  </div>;
}
