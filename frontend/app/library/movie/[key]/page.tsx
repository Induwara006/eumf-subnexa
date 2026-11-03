// SUBNEXA_FILM_PAGE_V1
import { notFound } from "next/navigation";

import FilmDownloadPage from "@/components/FilmDownloadPage";
import { filmIdFromKey } from "@/lib/library-slug";

export const metadata = { title: "Sinhala subtitle download — SubNexa" };

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const id = filmIdFromKey(decodeURIComponent(key));
  if (!id) notFound();
  return <FilmDownloadPage id={id} />;
}
