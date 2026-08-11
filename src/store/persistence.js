// Tiny localStorage wrapper for Redis Quest save data. Everything is stored
// under a `redis-quest:` prefix so unrelated keys never collide. All access is
// guarded so the app works in environments without localStorage (SSR, node
// tests) without crashing.

const PREFIX = 'redis-quest:'

function storage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Read + parse a saved value; returns `fallback` when missing/unreadable. */
export function load(key, fallback = null) {
  try {
    const raw = storage()?.getItem(PREFIX + key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** Serialize + store a value. Best-effort; never throws. */
export function save(key, value) {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* ignore — persistence is a convenience, not a requirement */
  }
}

/** Remove a saved value. Best-effort; never throws. */
export function remove(key) {
  try {
    storage()?.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}
