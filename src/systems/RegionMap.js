// RegionMap — maps Redis command groups/commands to the themed world regions
// from the master spec, and tracks which regions a player has discovered so REX
// can evolve. Regions are the "situation" buckets the hint system keys on, so
// this module doubles as the authoritative region catalog.
//
// Regions are a Phase 3 scaffold: the world itself (viewport, movement) lands
// in later phases, but REX, tutorials and the encyclopedia all speak region
// language today, so every future region just adds one entry here + dialogue.

// REX visual stages (master spec §2 — personality & visual evolution):
//   1 Memory Village   simple floating cube, warm amber glow
//   2 String Forest    geometric sphere with rotating rings
//   3 List Harbor      complex polyhedron, trail particles
//   4 Set Caverns+     crystalline fractal, subtle animation
//   5 Hash City+       humanoid silhouette, expressive face panels
export const REGIONS = [
  {
    id: 'memory-village',
    name: 'Memory Village',
    emoji: '🏠',
    accent: '#fbbf24',
    group: 'strings',
    stage: 1,
    tagline: 'Strings, TTL & keys',
    commandLine: 'SET / GET / INCR / EXPIRE',
    boss: 'neon-serpent',
    concept: 'string',
  },
  {
    id: 'string-forest',
    name: 'String Forest',
    emoji: '🌲',
    accent: '#34d399',
    group: 'strings',
    stage: 2,
    tagline: 'String operations',
    commandLine: 'APPEND / STRLEN / GETSET',
    boss: null,
    concept: 'string',
  },
  {
    id: 'list-harbor',
    name: 'List Harbor',
    emoji: '🚢',
    accent: '#34d399',
    group: 'lists',
    stage: 3,
    tagline: 'Queues & stacks',
    commandLine: 'LPUSH / RPOP / LRANGE',
    boss: null,
    concept: 'list',
  },
  {
    id: 'set-caverns',
    name: 'Set Caverns',
    emoji: '💎',
    accent: '#a78bfa',
    group: 'sets',
    stage: 4,
    tagline: 'Unique collections',
    commandLine: 'SADD / SINTER / SDIFF',
    boss: null,
    concept: 'set',
  },
  {
    id: 'hash-city',
    name: 'Hash City',
    emoji: '🏙️',
    accent: '#fbbf24',
    group: 'hashes',
    stage: 5,
    tagline: 'Object profiles',
    commandLine: 'HSET / HGET / HINCRBY',
    boss: null,
    concept: 'hash',
  },
  {
    id: 'leaderboard-arena',
    name: 'Leaderboard Arena',
    emoji: '🏆',
    accent: '#fb7185',
    group: 'zsets',
    stage: 5,
    tagline: 'Sorted sets',
    commandLine: 'ZADD / ZINCRBY / ZRANGE',
    boss: null,
    concept: 'zset',
  },
  {
    id: 'performance-lab',
    name: 'Performance Lab',
    emoji: '⚡',
    accent: '#fbbf24',
    group: 'transactions',
    stage: 3,
    tagline: 'Atomic batches',
    commandLine: 'MULTI / EXEC / WATCH',
    boss: null,
    concept: 'transaction',
  },
  {
    id: 'script-temple',
    name: 'Script Temple',
    emoji: '🔮',
    accent: '#fb7185',
    group: 'scripting',
    stage: 4,
    tagline: 'Lua scripting',
    commandLine: 'EVAL / EVALSHA',
    boss: null,
    concept: 'scripting',
  },
  {
    id: 'redis-core',
    name: 'Redis Core',
    emoji: '👑',
    accent: '#22d3ee',
    group: 'server',
    stage: 5,
    tagline: 'Server & admin',
    commandLine: 'INFO / DBSIZE / FLUSHDB',
    boss: null,
    concept: 'server',
  },
]

export const DEFAULT_REGION_ID = 'memory-village'

const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]))

// String commands split between Memory Village (basics) and String Forest
// (operations) — the only group that needs per-command disambiguation.
const STRING_SPLIT = {
  // village: the classic store/recall/increment family + TTL + key plumbing
  SET: 'memory-village', GET: 'memory-village', MSET: 'memory-village',
  MGET: 'memory-village', SETEX: 'memory-village', PSETEX: 'memory-village',
  INCR: 'memory-village', DECR: 'memory-village', INCRBY: 'memory-village',
  DECRBY: 'memory-village', GETSET: 'memory-village',
  // forest: operations on existing strings
  APPEND: 'string-forest', STRLEN: 'string-forest',
}

// Command groups that belong to a specific region regardless of command.
const GROUP_REGION = {
  lists: 'list-harbor',
  sets: 'set-caverns',
  hashes: 'hash-city',
  zsets: 'leaderboard-arena',
  transactions: 'performance-lab',
  scripting: 'script-temple',
  server: 'redis-core',
}

// Key/expiry plumbing commands all live in Memory Village.
const KEYS_REGION = 'memory-village'

const OTHER_KEYS = new Set([
  'DEL', 'EXISTS', 'EXPIRE', 'PEXPIRE', 'TTL', 'PTTL', 'PERSIST',
  'KEYS', 'TYPE', 'RANDOMKEY', 'RENAME', 'RENAMENX',
])

export function getRegion(id) {
  return REGION_BY_ID[id] || null
}

// Which region "owns" a given command? Falls back to the group, then the
// default region. Used for region:entered events and contextual hints.
export function regionForCommand(command) {
  const canon = String(command || '').toUpperCase()
  if (STRING_SPLIT[canon]) return STRING_SPLIT[canon]
  if (OTHER_KEYS.has(canon)) return KEYS_REGION
  const fn = registryLookup(canon)
  if (fn && GROUP_REGION[fn.group]) return GROUP_REGION[fn.group]
  return DEFAULT_REGION_ID
}

// Circular-import guard: RegionMap must not import the engine registry at
// module scope (registry imports command modules, not systems), but we still
// want group metadata. We lazily read the registry only if it is available.
let registryRef = null
export function bindCommandRegistry(registry) {
  registryRef = registry
}

function registryLookup(canon) {
  return registryRef ? registryRef.get(canon) : null
}

// Ordered list of region ids for the tutorial "roadmap" (village first).
export function regionRoadmap() {
  return REGIONS.map((r) => r.id)
}

// REX stage derived from the most advanced region the player has reached.
export function rexStageFor(visitedRegionIds) {
  let stage = 1
  for (const id of visitedRegionIds) {
    const r = getRegion(id)
    if (r && r.stage > stage) stage = r.stage
  }
  return stage
}

// A short "world line" describing the region for the encyclopedia / HUD.
export function regionSummary(regionId) {
  const r = getRegion(regionId)
  return r ? `${r.emoji} ${r.name} — ${r.tagline}` : ''
}
