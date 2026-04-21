const STORAGE_KEY = "agentis-device-id";
const SESSION_FALLBACK_KEY = "agentis-device-id-sess";

/** Stable for the tab session when sessionStorage is available. */
let memoryDeviceId: string | null = null;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `d-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Persistent random id for one-vote-per-device; safe to send on API requests.
 * If localStorage is blocked, uses sessionStorage or an in-memory id so GET/POST
 * use the same device id within the session (avoids wrong `myVote` from the API).
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = newId();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    try {
      let id = window.sessionStorage.getItem(SESSION_FALLBACK_KEY);
      if (!id) {
        id = newId();
        window.sessionStorage.setItem(SESSION_FALLBACK_KEY, id);
      }
      return id;
    } catch {
      if (!memoryDeviceId) {
        memoryDeviceId = newId();
      }
      return memoryDeviceId;
    }
  }
}
