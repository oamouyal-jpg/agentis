"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { useMyGroups } from "../../lib/useMyGroups";
import { API_BASE } from "../../lib/apiBase";

export default function MyGroupsPage() {
  const { t } = useI18n();
  const { groups, unfollow } = useMyGroups();
  const [brandingBySlug, setBrandingBySlug] = useState<
    Record<string, { logoUrl?: string; accentColor?: string }>
  >({});

  const slugsKey = useMemo(() => groups.map((g) => g.slug).join("|"), [groups]);

  useEffect(() => {
    let cancelled = false;
    async function loadBranding() {
      try {
        const next: Record<string, { logoUrl?: string; accentColor?: string }> = {};
        await Promise.all(
          groups.map(async (g) => {
            try {
              const res = await fetch(
                `${API_BASE}/spaces/${encodeURIComponent(g.slug)}`,
                { cache: "no-store" }
              );
              if (!res.ok) return;
              const data = (await res.json()) as {
                branding?: { logoUrl?: string; accentColor?: string };
              };
              if (data.branding && typeof data.branding === "object") {
                next[g.slug] = {
                  logoUrl:
                    typeof data.branding.logoUrl === "string"
                      ? data.branding.logoUrl
                      : undefined,
                  accentColor:
                    typeof data.branding.accentColor === "string"
                      ? data.branding.accentColor
                      : undefined,
                };
              }
            } catch {
              /* ignore per-space */
            }
          })
        );
        if (!cancelled) setBrandingBySlug(next);
      } catch {
        /* ignore */
      }
    }
    if (groups.length > 0) loadBranding();
    return () => {
      cancelled = true;
    };
  }, [slugsKey]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="font-display text-base font-medium tracking-tight text-zinc-100"
          >
            {t("common.agentis")}
          </Link>
          <nav className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:gap-x-3 sm:text-xs">
            <Link href="/" className="font-medium text-zinc-400 transition hover:text-zinc-100">Home</Link>
            <span className="font-medium text-zinc-200">{t("home.myGroupsTitle")}</span>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
        <div className="mb-8 border-b border-zinc-800 pb-8">
          <h1 className="font-display text-2xl font-medium tracking-tight text-zinc-50 sm:text-3xl">
            {t("home.myGroupsTitle")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            {t("home.myGroupsBody")}
          </p>
        </div>

        {groups.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-800 bg-zinc-950/50 px-5 py-10 text-center text-sm text-zinc-500">
            {t("home.myGroupsEmpty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {groups.map((g) => (
              <li
                key={g.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/50 px-4 py-3"
              >
                <Link
                  href={`/s/${encodeURIComponent(g.slug)}`}
                  className="min-w-0 flex-1 text-sm font-medium text-zinc-100 hover:text-white"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {brandingBySlug[g.slug]?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- org logos can be on any host (https only)
                      <img
                        src={brandingBySlug[g.slug].logoUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-md border border-zinc-800 bg-zinc-950 object-contain p-1"
                      />
                    ) : (
                      <span className="h-10 w-10 shrink-0 rounded-md border border-zinc-800 bg-zinc-950" />
                    )}
                    <span className="min-w-0">
                      <span
                        className="block truncate"
                        style={
                          brandingBySlug[g.slug]?.accentColor
                            ? { color: brandingBySlug[g.slug].accentColor }
                            : undefined
                        }
                      >
                        {g.name}
                      </span>
                      <span className="mt-1 block font-mono text-[11px] font-normal text-zinc-600">
                        {g.slug}
                      </span>
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => unfollow(g.slug)}
                  className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-300"
                >
                  {t("home.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

