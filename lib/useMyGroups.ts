"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addToMyGroups,
  loadMyGroups,
  MY_GROUPS_STORAGE_KEY,
  removeFromMyGroups,
  type FollowedGroup,
} from "./myGroups";

export function useMyGroups() {
  const [groups, setGroups] = useState<FollowedGroup[]>([]);

  const refresh = useCallback(() => {
    setGroups(loadMyGroups());
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === MY_GROUPS_STORAGE_KEY || e.key === null) refresh();
    };
    const onCustom = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("agentis-mygroups-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("agentis-mygroups-changed", onCustom);
    };
  }, [refresh]);

  const follow = useCallback((slug: string, name: string) => {
    addToMyGroups(slug, name);
    refresh();
  }, [refresh]);

  const unfollow = useCallback((slug: string) => {
    removeFromMyGroups(slug);
    refresh();
  }, [refresh]);

  const following = useCallback(
    (slug: string) =>
      groups.some((g) => g.slug === slug.trim().toLowerCase()),
    [groups]
  );

  return { groups, follow, unfollow, following, refresh };
}
