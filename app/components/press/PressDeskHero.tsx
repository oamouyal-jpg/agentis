"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  field: [
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&h=500&fit=crop&q=80&auto=format",
    "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=500&h=500&fit=crop&q=80&auto=format",
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=500&h=500&fit=crop&q=80&auto=format",
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

function dateLocaleFor(locale: AppLocale): string {
  if (locale === "he") return "he-IL";
  if (locale === "es") return "es";
  return "en-GB";
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

type Props = {
  openQuestionCount: number | null;
  wireQuestions: WireItem[];
  statsLoading: boolean;
  groupCount: number | null;
  groupsLoading: boolean;
};

export function PressDeskHero({
  openQuestionCount,
  wireQuestions,
  statsLoading,
  groupCount,
  groupsLoading,
}: Props) {
  const { locale, t } = useI18n();
  const [dateLine, setDateLine] = useState("");

  const hero = useMemo(() => heroForLocale(locale), [locale]);

  useEffect(() => {
    setDateLine(
      new Intl.DateTimeFormat(dateLocaleFor(locale), {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date())
    );
  }, [locale]);

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

  return (
    <div className="mb-16 border-b border-zinc-800 pb-16">
      <div className="mb-10 flex flex-col gap-2 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-2xl font-medium tracking-tight text-zinc-100 sm:text-3xl">
            {t("common.agentis")}
          </p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-500">
            {t("hero.mastheadSub")}
          </p>
        </div>
        <p className="font-mono text-xs text-zinc-600">{dateLine || "—"}</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-400/90">
            {t("hero.leadKicker")}
          </p>
          <h1 className="font-display mt-3 text-3xl font-medium leading-[1.12] tracking-tight text-zinc-50 sm:text-4xl lg:text-[2.35rem] lg:leading-[1.1]">
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
          <dl className="mt-10 grid grid-cols-2 gap-x-4 gap-y-6 border-t border-zinc-800 pt-8 md:grid-cols-3">
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
                {t("hero.statFormat")}
              </dt>
              <dd className="mt-1 text-sm text-zinc-400">
                {t("hero.statFormatValue")}
              </dd>
            </div>
          </dl>
        </div>

        <div className="relative lg:col-span-7">
          <div className="relative aspect-[16/10] overflow-hidden rounded-sm bg-zinc-900">
            <Image
              src={IMG.lead}
              alt={t("hero.leadImageAlt")}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 58vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/30 to-transparent" />
            <p className="absolute bottom-5 start-5 end-5 font-display text-lg font-medium italic leading-snug text-white sm:text-xl sm:leading-relaxed">
              {t("hero.leadCaption")}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-14">
        <div className="mb-6 flex items-baseline justify-between gap-4">
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

      <div className="mt-14 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h2 className="font-display text-lg font-medium text-zinc-100">
            {t("hero.fieldTitle")}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">{t("hero.fieldSub")}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {IMG.field.map((src, i) => (
              <div
                key={src}
                className="relative aspect-square overflow-hidden rounded-sm bg-zinc-900"
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 33vw, 18vw"
                />
                <span className="absolute bottom-1 end-1 rounded bg-zinc-950/80 px-1 font-mono text-[8px] text-zinc-500">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-zinc-900/30 p-6 lg:col-span-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
            {t("hero.editorialKicker")}
          </p>
          <p className="mt-2 text-xs text-zinc-500">{t("hero.editorialSub")}</p>
          <ol className="mt-5 space-y-4 border-t border-zinc-800 pt-5">
            {hero.prompts.map((p, i) => (
              <li
                key={`${locale}-${i}`}
                className="flex gap-3 text-sm leading-relaxed text-zinc-300"
              >
                <span className="font-display text-lg font-medium text-zinc-600">
                  {i + 1}.
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
