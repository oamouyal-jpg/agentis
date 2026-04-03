export type SpaceVisibility = "public" | "members_only";

export type Space = {
  id: number;
  name: string;
  slug: string;
  description: string;
  visibility: SpaceVisibility;
  /** Present only for members_only; required to submit/vote via invite link */
  inviteSecret: string | null;
  /** Host-only secret for admin actions (not exposed via listSpaces / getSpace). */
  hostSecret: string;
  /** Optional branding for org-style presentation. */
  branding?: {
    /** HTTPS URL to a logo image. */
    logoUrl?: string;
    /** CSS color (hex/rgb/hsl) used as accent. */
    accentColor?: string;
  };
};

export type CreateSpaceInput = {
  name: string;
  slug: string;
  description?: string;
  visibility: SpaceVisibility;
};
