"use client";

import { useCallback, useEffect, useState } from "react";
import { SITE_URL, canonicalPublicUrl } from "../../lib/siteUrl";

type Props = {
  /** Shared title (e.g. page title) */
  title?: string;
  /** Short line shown in the message */
  text: string;
  /** URL to share; defaults to current page in the browser */
  url?: string;
  className?: string;
};

/**
 * WhatsApp + Facebook web share; Instagram has no public share URL — we copy text + link for pasting in the app.
 */
export function SocialShareButtons({
  title = "Agentis",
  text,
  url,
  className = "",
}: Props) {
  const shareLabel = `Share: ${title}`;
  const [igCopied, setIgCopied] = useState(false);
  /**
   * Until mount, use SITE_URL only when `url` is omitted so SSR and the first client paint
   * match. After mount, use the real page URL (canonicalized) for correct deep links.
   */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const shareUrl = canonicalPublicUrl(
    url ?? (mounted ? window.location.href : SITE_URL)
  );

  const body = `${text}\n${shareUrl}`.trim();
  const waHref = `https://wa.me/?text=${encodeURIComponent(body)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  const copyForInstagram = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(body);
      setIgCopied(true);
      window.setTimeout(() => setIgCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [body]);

  const pill =
    "inline-flex items-center gap-1.5 rounded-full border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 sm:text-xs";

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      role="group"
      aria-label={shareLabel}
    >
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className={pill}
      >
        <span className="text-[13px]" aria-hidden>
          💬
        </span>
        WhatsApp
      </a>
      <a
        href={fbHref}
        target="_blank"
        rel="noopener noreferrer"
        className={pill}
      >
        <span className="text-[13px]" aria-hidden>
          f
        </span>
        Facebook
      </a>
      <button type="button" onClick={copyForInstagram} className={pill}>
        <span className="text-[13px]" aria-hidden>
          ◎
        </span>
        {igCopied ? "Copied for Instagram" : "Instagram"}
      </button>
      <span className="hidden text-[10px] text-zinc-600 sm:inline">
        (Instagram: paste in Stories or DM)
      </span>
    </div>
  );
}
