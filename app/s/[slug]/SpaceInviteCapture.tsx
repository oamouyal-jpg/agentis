"use client";

import { useEffect } from "react";
import { storeHostFromUrl, storeInviteFromUrl } from "../../../lib/spaceApi";

export function SpaceInviteCapture({ slug }: { slug: string }) {
  useEffect(() => {
    storeInviteFromUrl(slug);
    storeHostFromUrl(slug);
  }, [slug]);
  return null;
}
