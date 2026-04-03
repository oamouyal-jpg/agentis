import type { Metadata } from "next";
import type { ReactNode } from "react";
import { API_BASE } from "../../../lib/apiBase";
import { SITE_URL } from "../../../lib/siteUrl";
import { SpaceInviteCapture } from "./SpaceInviteCapture";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(
      `${API_BASE}/spaces/${encodeURIComponent(slug)}`,
      { next: { revalidate: 120 } }
    );
    if (!res.ok) {
      return { title: slug };
    }
    const space = (await res.json()) as {
      name?: string;
      description?: string;
      branding?: { logoUrl?: string };
    };
    const title = space.name || slug;
    const description =
      space.description?.trim() || "Civic questions and votes on Agentis.";
    const url = `${SITE_URL}/s/${encodeURIComponent(slug)}`;
    const images = space.branding?.logoUrl
      ? [{ url: space.branding.logoUrl }]
      : undefined;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: "Agentis",
        type: "website",
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
    return { title: slug };
  }
}

export default async function SpaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <SpaceInviteCapture slug={slug} />
      {children}
    </>
  );
}
