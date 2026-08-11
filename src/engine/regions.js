// World regions.
//
// Redis Realm is 12 themed regions (Memory Village, String Forest, ...). Each
// region is one Redis concept family with its own palette, bounds, and the
// commands it teaches. Phase 1 ships Memory Village as the live world; the
// catalog already describes the rest so later phases can unlock them without
// touching the engine.
//
// World units are abstract "meters" — the viewport scales them to pixels via
// the camera zoom.

export const REGIONS = [
  {
    id: 'memory-village',
    name: 'Memory Village',
    emoji: '🏠',
    palette: { ground: '#0d141f', grid: '#16233a', accent: '#22d3ee' },
    width: 2400,
    height: 1600,
    commands: ['SET', 'GET', 'INCR', 'EXPIRE', 'TTL', 'DEL'],
    // Where the player spawns in this region.
    spawn: { x: 1200, y: 800 },
    // Deterministic scatter seed for the decorative props.
    seed: 101,
  },
  {
    id: 'string-forest',
    name: 'String Forest',
    emoji: '🌲',
    palette: { ground: '#0c1a14', grid: '#13301f', accent: '#34d399' },
    width: 2400,
    height: 1600,
    commands: ['APPEND', 'STRLEN', 'GETRANGE', 'SETRANGE'],
    spawn: { x: 1200, y: 800 },
    seed: 202,
  },
  {
    id: 'list-harbor',
    name: 'List Harbor',
    emoji: '🚢',
    palette: { ground: '#0d1a1c', grid: '#123036', accent: '#34d399' },
    width: 2400,
    height: 1600,
    commands: ['LPUSH', 'RPUSH', 'LPOP', 'RPOP', 'LRANGE'],
    spawn: { x: 1200, y: 800 },
    seed: 303,
  },
  {
    id: 'set-caverns',
    name: 'Set Caverns',
    emoji: '💎',
    palette: { ground: '#120d1c', grid: '#24163a', accent: '#a78bfa' },
    width: 2400,
    height: 1600,
    commands: ['SADD', 'SREM', 'SISMEMBER', 'SINTER', 'SUNION'],
    spawn: { x: 1200, y: 800 },
    seed: 404,
  },
  {
    id: 'hash-city',
    name: 'Hash City',
    emoji: '🏙️',
    palette: { ground: '#17130d', grid: '#2b2313', accent: '#fbbf24' },
    width: 2400,
    height: 1600,
    commands: ['HSET', 'HGET', 'HINCRBY', 'HGETALL'],
    spawn: { x: 1200, y: 800 },
    seed: 505,
  },
]

export function getRegion(id) {
  return REGIONS.find((r) => r.id === id) || REGIONS[0]
}
