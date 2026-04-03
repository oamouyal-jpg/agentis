export const MY_GROUPS_STORAGE_KEY = "agentis.myGroups.v1";

export type FollowedGroup = {
  slug: string;
  name: string;
  addedAt: number;
};

function safeParse(raw: string | null): FollowedGroup[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (x): x is FollowedGroup =>
          x !== null &&
          typeof x === "object" &&
          typeof (x as FollowedGroup).slug === "string" &&
          (x as FollowedGroup).slug.length > 0
      )
      .map((x) => ({
        slug: String(x.slug).trim().toLowerCase(),
        name:
          typeof x.name === "string" && x.name.trim()
            ? x.name.trim()
            : String(x.slug),
        addedAt:
          typeof x.addedAt === "number" && Number.isFinite(x.addedAt)
            ? x.addedAt
            : Date.now(),
      }));
  } catch {
    return [];
  }
}

export function loadMyGroups(): FollowedGroup[] {
  if (typeof window === "undefined") return [];
  const list = safeParse(localStorage.getItem(MY_GROUPS_STORAGE_KEY));
  return [...list].sort((a, b) => b.addedAt - a.addedAt);
}

function persist(list: FollowedGroup[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MY_GROUPS_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("agentis-mygroups-changed"));
}

export function addToMyGroups(slug: string, name: string): void {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return;
  const display = name.trim() || normalized;
  const existing = loadMyGroups().filter((g) => g.slug !== normalized);
  existing.push({
    slug: normalized,
    name: display,
    addedAt: Date.now(),
  });
  persist(existing);
}

export function removeFromMyGroups(slug: string): void {
  const normalized = slug.trim().toLowerCase();
  persist(loadMyGroups().filter((g) => g.slug !== normalized));
}

export function isInMyGroups(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  return loadMyGroups().some((g) => g.slug === normalized);
}
