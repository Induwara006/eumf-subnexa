import { notFound, permanentRedirect } from "next/navigation";
export default async function LegacySeasonPage({params}: {params: Promise<{key: string}>}) {
  const {key} = await params;
  if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(key)) notFound();
  permanentRedirect(`/library/tv-series/${key}`);
}
