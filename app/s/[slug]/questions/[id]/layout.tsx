import type { Metadata } from "next";
import type { ReactNode } from "react";
import { API_BASE } from "../../../../../lib/apiBase";
import { SITE_URL } from "../../../../../lib/siteUrl";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const qid = Number(id);
  if (!Number.isFinite(qid)) {
    return { title: "Question" };
  }
  try {
    const res = await fetch(
      `${API_BASE}/spaces/${encodeURIComponent(slug)}/questions`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) {
      return { title: `Question · ${slug}` };
    }
    const questions = (await res.json()) as Array<{
      id: number;
      title: string;
      description: string;
      imageUrl?: string;
    }>;
    const q = questions.find((x) => x.id === qid);
    if (!q) {
      return { title: `Question · ${slug}` };
    }
    const title = q.title;
    const description =
      q.description.length > 160
        ? `${q.description.slice(0, 157)}…`
        : q.description;
    const url = `${SITE_URL}/s/${encodeURIComponent(slug)}/questions/${encodeURIComponent(id)}`;
    const images = q.imageUrl ? [{ url: q.imageUrl }] : undefined;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: "Agentis",
        type: "article",
        images,
      },
      twitter: {
        card: images ? "summary_large_image" : "summary",
        title,
        description,
        images: images?.map((i) => i.url),
      },
    };
  } catch {
    return { title: `Question · ${slug}` };
  }
}

export default function SpaceQuestionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
