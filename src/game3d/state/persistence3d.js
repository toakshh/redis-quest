// 3D save-data wrapper (Law L7) — delegates to the existing localStorage
// wrapper but prefixes every key with '3d:', so the underlying store keeps
// them at 'redis-quest:3d:<key>' and they can never collide with a 2D save.
// clearAll3d touches localStorage directly (permitted here: this file lives
// in state/, not sim/, so Law L2 does not apply) so a full 3D reset never
// has to enumerate every known key by name.

import { load, save, remove } from '../../store/persistence.js'

export const NS = '3d:'

export function load3d(key, fallback = null) {
  return load(NS + key, fallback)
}

export function save3d(key, value) {
  save(NS + key, value)
}

export function remove3d(key) {
  remove(NS + key)
}

export function clearAll3d() {
  try {
    const storage = globalThis.localStorage
    if (!storage) return
    const fullPrefix = 'redis-quest:' + NS
    const toRemove = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key && key.startsWith(fullPrefix)) toRemove.push(key)
    }
    for (const key of toRemove) storage.removeItem(key)
  } catch {
    /* ignore — persistence is a convenience, not a requirement */
  }
}
