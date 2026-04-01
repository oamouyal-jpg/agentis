export type SpaceVisibility = "public" | "members_only";

export type Space = {
  id: number;
  name: string;
  slug: string;
  description: string;
  visibility: SpaceVisibility;
  /** Present only for members_only; required to submit/vote via invite link */
  inviteSecret: string | null;
};

export type CreateSpaceInput = {
  name: string;
  slug: string;
  description?: string;
  visibility: SpaceVisibility;
};
