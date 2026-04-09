"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useI18n } from "../../../lib/i18n/I18nProvider";
import type { AppLocale } from "../../../lib/i18n/config";
import { messagesByLocale } from "../../../lib/i18n/messages";

/** Editorial imagery — Unsplash (journalism / civic / city themes) */
const IMG = {
  lead: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1400&h=788&fit=crop&q=82&auto=format",
  wire: [
    "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&h=400&fit=crop&q=80&auto=format",
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&h=400&fit=crop&q=80&auto=format",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=400&fit=crop&q=80&auto=format",
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600&h=400&fit=crop&q=80&auto=format",
  ],
} as const;

type HeroCopy = {
  fallbackWire: { title: string; href: string }[];
  prompts: string[];
};

function heroForLocale(locale: AppLocale): HeroCopy {
  const h = messagesByLocale[locale].hero as unknown as HeroCopy;
  return h;
}

function WireThumb({ src }: { src: string }) {
  const unsplash = src.includes("images.unsplash.com");
  if (unsplash) {
    return (
      <Image
        src={src}
        alt=""
        fill
        className="object-cover opacity-90 transition group-hover:opacity-100"
        sizes="(max-width: 640px) 100vw, 25vw"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- user-supplied HTTPS URLs (any host)
    <img
      src={src}
      alt=""
      className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
    />
  );
}

type WireItem = { id: number; title: string; imageUrl?: string };

export type HeroTrendingHot = {
  question: {
    id: number;
    title: string;
    description?: string;
    imageUrl?: string;
  };
  metrics: {
    entriesInWindow: number;
    commentsInWindow: number;
  };
};

export type HeroTrendingEmerging = {
  question: { id: number; title: string };
  metrics: { risingFast?: boolean };
};

type Props = {
  openQuestionCount: number | null;
  wireQuestions: WireItem[];
  statsLoading: boolean;
  groupCount: number | null;
  groupsLoading: boolean;
  trendingHot: HeroTrendingHot | null;
  trendingEmerging: HeroTrendingEmerging[];
  trendingLoading: boolean;
};

function LeadHeroVisual({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  const unsplash = src.includes("images.unsplash.com");
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-sm bg-zinc-900">
      {unsplash ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 58vw"
          priority
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- question hero images (any HTTPS host)
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/30 to-transparent" />
      <p className="absolute bottom-5 start-5 end-5 font-display text-lg font-medium italic leading-snug text-white sm:text-xl sm:leading-relaxed">
        {caption}
      </p>
    </div>
  );
}

export function PressDeskHero({
  openQuestionCount,
  wireQuestions,
  statsLoading,
  groupCount,
  groupsLoading,
  trendingHot,
  trendingEmerging,
  trendingLoading,
}: Props) {
  const { locale, t } = useI18n();

  const hero = useMemo(() => heroForLocale(locale), [locale]);

  const wireItems =
    wireQuestions.length > 0
      ? wireQuestions.map((q, i) => ({
          key: `q-${q.id}`,
          title: q.title,
          href: `/s/open/questions/${q.id}`,
          image:
            q.imageUrl && q.imageUrl.startsWith("https://")
              ? q.imageUrl
              : IMG.wire[i % IMG.wire.length],
        }))
      : hero.fallbackWire.map((f, i) => ({
          key: `f-${i}`,
          title: f.title,
          href: f.href,
          image: IMG.wire[i % IMG.wire.length],
        }));

  const hot = trendingHot;
  const leadImgSrc =
    hot?.question.imageUrl?.startsWith("https://") && hot.question.imageUrl
      ? hot.question.imageUrl
      : IMG.lead;

  const imageCaption = hot
    ? `${hot.metrics.entriesInWindow} ${t("hero.voicesRecent")}`
    : t("hero.leadCaption");

  const emergingShow = trendingEmerging.slice(0, 3);

  return (
    <div className="mb-10 border-b border-zinc-800 pb-10 sm:mb-16 sm:pb-16">
      <div className="mb-6 border-b border-zinc-800 pb-4 sm:mb-10 sm:pb-6">
        <p className="font-display text-xl font-medium tracking-tight text-zinc-100 sm:text-3xl">
          {t("common.agentis")}
        </p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
          {t("hero.mastheadSub")}
        </p>
      </div>

      <div className="grid gap-6 sm:gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          {trendingLoading ? (
            <div className="space-y-4 animate-pulse" aria-busy="true">
              <div className="h-3 w-24 rounded bg-zinc-800" />
              <div className="h-10 w-full max-w-md rounded bg-zinc-800" />
              <div className="h-4 w-full rounded bg-zinc-800/80" />
              <div className="h-4 w-5/6 rounded bg-zinc-800/60" />
            </div>
          ) : hot ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-500/95">
                {t("hero.trendingKicker")}
              </p>
              <h1 className="font-display mt-3 text-2xl font-medium leading-[1.2] tracking-tight text-zinc-50 sm:text-3xl lg:text-[2rem] lg:leading-[1.15]">
                {hot.question.title}
              </h1>
              {hot.question.description ? (
                <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
                  {hot.question.description}
                </p>
              ) : null}
              <p className="mt-5 text-sm leading-relaxed text-zinc-300 sm:text-[15px]">
                {t("hero.inviteSubtitle")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/s/open/questions/${hot.question.id}`}
                  className="rounded-sm bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white"
                >
                  {t("hero.voteNow")}
                </Link>
                <Link
                  href="/s/open/submit"
                  className="rounded-sm border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
                >
                  {t("hero.fileConcern")}
                </Link>
                <Link
                  href="/s/open"
                  className="rounded-sm border border-dashed border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                >
                  {t("hero.openDesk")}
                </Link>
              </div>
              {emergingShow.length > 0 ? (
                <div className="mt-8 border-t border-zinc-800 pt-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {t("hero.emergingLabel")}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {emergingShow.map((e) => (
                      <li key={e.question.id}>
                        <Link
                          href={`/s/open/questions/${e.question.id}`}
                          className="group flex items-start gap-2 text-sm leading-snug text-zinc-300 transition hover:text-white"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600/90" />
                          <span className="group-hover:underline">{e.question.title}</span>
                          {e.metrics.risingFast ? (
                            <span className="ml-auto shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-400/90">
                              ↑
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {t("hero.leadKicker")}
              </p>
              <h1 className="font-display mt-3 text-2xl font-medium leading-[1.15] tracking-tight text-zinc-50 sm:text-4xl lg:text-[2.35rem] lg:leading-[1.1]">
                {t("hero.leadTitle")}
              </h1>
              <p className="mt-5 text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
                {t("hero.leadBody")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/s/open"
                  className="rounded-sm bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white"
                >
                  {t("hero.openDesk")}
                </Link>
                <Link
                  href="/s/open/submit"
                  className="rounded-sm border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
                >
                  {t("hero.fileConcern")}
                </Link>
              </div>
            </>
          )}
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-zinc-800 pt-6 sm:mt-10 sm:gap-y-6 sm:pt-8 md:grid-cols-3">
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {t("hero.statQuestions")}
              </dt>
              <dd className="font-display mt-1 text-2xl font-medium tabular-nums text-zinc-100">
                {statsLoading ? "—" : openQuestionCount ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {t("hero.statGroups")}
              </dt>
              <dd className="font-display mt-1 text-2xl font-medium tabular-nums text-zinc-100">
                {groupsLoading ? "—" : groupCount ?? "—"}
              </dd>
            </div>
            <div className="col-span-2 md:col-span-1">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {hot ? t("hero.statActivity") : t("hero.statFormat")}
              </dt>
              <dd className="mt-1 text-sm text-zinc-400">
                {hot ? (
                  <span className="font-display text-2xl font-medium tabular-nums text-zinc-100">
                    {hot.metrics.entriesInWindow}
                  </span>
                ) : (
                  t("hero.statFormatValue")
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="relative lg:col-span-7">
          <LeadHeroVisual
            src={leadImgSrc}
            alt={t("hero.leadImageAlt")}
            caption={imageCaption}
          />
        </div>
      </div>

      <div className="mt-8 sm:mt-14">
        <div className="mb-4 flex items-baseline justify-between gap-4 sm:mb-6">
          <h2 className="font-display text-xl font-medium text-zinc-100">
            {t("hero.wireTitle")}
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
            {wireQuestions.length > 0 ? t("hero.wireLive") : t("hero.wirePrompts")}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {wireItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="group overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/40 transition hover:border-zinc-600"
            >
              <div className="relative aspect-[3/2] bg-zinc-900">
                <WireThumb src={item.image} />
              </div>
              <p className="border-t border-zinc-800 p-3 font-display text-sm font-medium leading-snug text-zinc-200 group-hover:text-white">
                {item.title}
              </p>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
