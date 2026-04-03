"use client";

import { useMyGroups } from "../../lib/useMyGroups";

type Props = {
  slug: string;
  name: string;
  className?: string;
};

export function FollowGroupButton({ slug, name, className = "" }: Props) {
  const { following, follow, unfollow } = useMyGroups();
  const isOn = following(slug);

  return (
    <button
      type="button"
      onClick={() => (isOn ? unfollow(slug) : follow(slug, name))}
      className={
        className ||
        "rounded-md border px-3 py-1.5 text-sm font-medium transition " +
          (isOn
            ? "border-zinc-500 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
            : "border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800")
      }
    >
      {isOn ? "Saved to My groups" : "Save to My groups"}
    </button>
  );
}
