"use client";

import { useEffect } from "react";
import { storeInviteFromUrl } from "../../../lib/spaceApi";

export function SpaceInviteCapture({ slug }: { slug: string }) {
  useEffect(() => {
    storeInviteFromUrl(slug);
  }, [slug]);
  return null;
}
