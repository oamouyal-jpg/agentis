"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || dismissed) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    setDismissed(true);
  };

  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 safe-bottom">
      <div className="mx-auto max-w-lg p-4">
        <div className="flex items-center gap-4 rounded-xl border border-zinc-700/60 bg-zinc-900/95 px-5 py-4 shadow-2xl backdrop-blur">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xl font-bold text-zinc-100">
            A
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">
              Add Agentis to your home screen
            </p>
            {isIOS ? (
              <p className="mt-0.5 text-xs text-zinc-400">
                Tap{" "}
                <span className="inline-block translate-y-[1px]">
                  &#x1F4E4;
                </span>{" "}
                then &quot;Add to Home Screen&quot;
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-zinc-400">
                Get the full-screen app experience
              </p>
            )}
          </div>
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="shrink-0 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white"
            >
              Install
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 p-1 text-zinc-500 hover:text-zinc-300"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
