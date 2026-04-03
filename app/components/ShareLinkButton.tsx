"use client";

import { useCallback, useState } from "react";

type Props = {
  url: string;
  label?: string;
  className?: string;
};

export function ShareLinkButton({
  url,
  label = "Copy link",
  className = "",
}: Props) {
  const [done, setDone] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      /* ignore */
    }
  }, [url]);

  const onShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url, title: document.title });
        return;
      } catch {
        /* fall through */
      }
    }
    await onCopy();
  }, [url, onCopy]);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        onClick={onCopy}
        className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
      >
        {done ? "Copied" : label}
      </button>
      {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
        <button
          type="button"
          onClick={onShare}
          className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
        >
          Share…
        </button>
      ) : null}
    </div>
  );
}
