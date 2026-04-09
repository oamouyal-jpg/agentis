"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type SpaceNavActive =
  | "group"
  | "submit"
  | "insights"
  | "question"
  | "admin"
  | "petitions";

type Props = {
  slug: string;
  spaceName?: string;
  active: SpaceNavActive;
  /** Language switcher, share row, My groups link, etc. */
  extras?: ReactNode;
  branding?: { logoUrl?: string; accentColor?: string };
};

/**
 * One consistent strip for every space route: home → group → primary actions.
 */
export function SpaceFlowNav({
  slug,
  spaceName,
  active,
  extras,
  branding,
}: Props) {
  const base = `/s/${encodeURIComponent(slug)}`;
  const label = spaceName?.trim() || slug;
  const questionsActive = active === "group" || active === "question";

  const pill = (isActive: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-[13px] ${
      isActive
        ? "bg-zinc-100 text-zinc-950"
        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
    }`;

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- org logos can be on any host (https only)
              <img
                src={branding.logoUrl}
                alt=""
                className="h-6 w-6 shrink-0 rounded border border-zinc-800 bg-zinc-950 object-contain"
              />
            ) : null}
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link
                href="/"
                className="font-display text-sm font-medium text-zinc-500 transition hover:text-zinc-300"
              >
                Agentis
              </Link>
              <span className="text-zinc-700">/</span>
              <Link
                href={base}
                className={`truncate font-display text-sm font-medium hover:text-white ${
                  branding?.accentColor ? "" : "text-zinc-100"
                }`}
                style={
                  branding?.accentColor
                    ? { color: branding.accentColor }
                    : undefined
                }
              >
                {label}
              </Link>
            </div>
          </div>
          {extras ? (
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              {extras}
            </div>
          ) : null}
        </div>
        <nav
          className="mt-3 flex flex-wrap gap-2"
          aria-label="Group sections"
        >
          <Link href={base} className={pill(questionsActive)}>
            Questions
          </Link>
          <Link href={`${base}/submit`} className={pill(active === "submit")}>
            Submit a concern
          </Link>
          <Link
            href={`${base}/insights`}
            className={pill(active === "insights")}
          >
            Results
          </Link>
          <Link
            href={`${base}/petitions`}
            className={pill(active === "petitions")}
          >
            Petitions
          </Link>
          <Link
            href={`${base}/admin`}
            className={`${pill(active === "admin")} border border-dashed border-zinc-700 bg-transparent`}
          >
            Host tools
          </Link>
        </nav>
      </div>
    </div>
  );
}
