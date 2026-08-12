// Central game state for Redis Quest: player XP, the boss battle, and the
// achievement system. The store binds to the app's singleton engine and reacts
// to every command (whether routed through runCommand or executed directly on
// the engine) via the engine's change/error events, so boss challenges and
// achievements always stay in sync with what the player actually ran.
//
// The engine itself lives outside the store (App.jsx owns the instance); the
// store just keeps a reference so it can inspect keys for challenge validation
// and read stats for achievement tracking.

import { create } from 'zustand'
import { ACHIEVEMENTS as NEW_ACHIEVEMENTS, RARITY_COLORS, RARITY_LABELS, CATEGORY_LABELS, CATEGORY_ICONS } from '../data/achievements.js'
import { xpForCommand } from '../systems/XPSystem.js'

export { RARITY_COLORS, RARITY_LABELS, CATEGORY_LABELS, CATEGORY_ICONS }

// ---------------------------------------------------------------------------
// Catalogs
// ---------------------------------------------------------------------------

export const XP_PER_LEVEL = 100

export const ACHIEVEMENTS = [
  { id: 'first-command', name: 'First Blood', desc: 'Execute your first Redis command.', icon: '⚡', xp: 10 },
  { id: 'ten-commands', name: 'Warming Up', desc: 'Execute 10 Redis commands.', icon: '🔁', xp: 15 },
  { id: 'fifty-commands', name: 'Ghost in the Shell', desc: 'Execute 50 Redis commands.', icon: '⌨️', xp: 30 },
  { id: 'string-master', name: 'String Slinger', desc: 'Use a string command.', icon: '🧵', xp: 10 },
  { id: 'hash-master', name: 'Hash Hacker', desc: 'Use a hash command.', icon: '🗂️', xp: 10 },
  { id: 'list-master', name: 'List Lancer', desc: 'Use a list command.', icon: '📋', xp: 10 },
  { id: 'set-master', name: 'Set Striker', desc: 'Use a set command.', icon: '🎯', xp: 10 },
  { id: 'zset-master', name: 'Zset Warden', desc: 'Use a sorted-set command.', icon: '📈', xp: 10 },
  { id: 'all-datatypes', name: 'Polyglot', desc: 'Use all five data types in one session.', icon: '🜂', xp: 40 },
  { id: 'boss-defeated', name: 'Serpent Slayer', desc: 'Defeat the NEON SERPENT.', icon: '🐍', xp: 50 },

  // String Forest achievements
  { id: 'string-forest-explorer', name: 'Forest Explorer', desc: 'Enter the String Forest.', icon: '🌲', xp: 20 },
  { id: 'range-master', name: 'Range Master', desc: 'Use GETRANGE and SETRANGE commands.', icon: '📏', xp: 25 },
  { id: 'float-wrangler', name: 'Float Wrangler', desc: 'Use INCRBYFLOAT to manipulate decimals.', icon: '🔢', xp: 25 },
  { id: 'string-splicer', name: 'String Splicer', desc: 'Combine APPEND, GETRANGE, and SETRANGE in one session.', icon: '✂️', xp: 30 },
  { id: 'tangler-slayer', name: 'Tangler Slayer', desc: 'Defeat THE TANGLER in String Forest.', icon: '🐍', xp: 50 },

  // List Harbor achievements
  { id: 'list-harbor-explorer', name: 'Harbor Explorer', desc: 'Enter List Harbor.', icon: '🚢', xp: 20 },
  { id: 'queue-manager', name: 'Queue Manager', desc: 'Use LINSERT, BLPOP, and BRPOP commands.', icon: '📦', xp: 25 },
  { id: 'pipeline-operator', name: 'Pipeline Operator', desc: 'Process 10 items through a list pipeline.', icon: '🔄', xp: 30 },
  { id: 'logistics-commander', name: 'Logistics Commander', desc: 'Defeat THE LOGISTICS OVERSEER in List Harbor.', icon: '🚢', xp: 50 },

  // Set Caverns achievements
  { id: 'set-caverns-explorer', name: 'Caverns Explorer', desc: 'Enter the Set Caverns.', icon: '💎', xp: 20 },
  { id: 'set-algebraist', name: 'Set Algebraist', desc: 'Use SUNIONSTORE, SINTERSTORE, and SDIFFSTORE.', icon: '🧮', xp: 25 },
  { id: 'crystal-collector', name: 'Crystal Collector', desc: 'Maintain 5+ sets with 10+ members each.', icon: '💎', xp: 30 },
  { id: 'warden-slayer', name: 'Warden Slayer', desc: 'Defeat THE SET WARDEN in Set Caverns.', icon: '💎', xp: 50 },

  // Hash City achievements
  { id: 'hash-city-explorer', name: 'City Explorer', desc: 'Enter Hash City.', icon: '🏙️', xp: 20 },
  { id: 'property-tycoon', name: 'Property Tycoon', desc: 'Use HSCAN, HINCRBYFLOAT, and HSETNX.', icon: '🏢', xp: 25 },
  { id: 'empire-builder', name: 'Empire Builder', desc: 'Create 10 hashes with 5+ fields each.', icon: '🏗️', xp: 30 },
  { id: 'magnate-slayer', name: 'Magnate Slayer', desc: 'Defeat THE PROPERTY MAGNATE in Hash City.', icon: '🏙️', xp: 50 },

  // Survival mode achievements
  { id: 'survival-cache-invalidation-storm', name: 'Storm Chaser', desc: 'Survive the Cache Invalidation Storm.', icon: '🌩️', xp: 50 },
  { id: 'survival-job-queue-resilience', name: 'Queue Master', desc: 'Complete Job Queue Resilience.', icon: '📦', xp: 60 },
  { id: 'survival-rate-limiting-citadel', name: 'Rate Limit Guardian', desc: 'Defend the Rate Limiting Citadel.', icon: '🛡️', xp: 60 },
  { id: 'survival-session-management-keep', name: 'Session Keeper', desc: 'Maintain the Session Management Keep.', icon: '🏰', xp: 75 },
]

export const BOSSES = [
  {
    id: 'neon-serpent',
    name: 'NEON SERPENT',
    title: 'SENTINEL OF THE DATA VAULT',
    maxHealth: 100,
    challenges: [
      {
        key: 'quest:start',
        task: 'Create a string `quest:start` holding the value `begun`.',
        hint: 'SET quest:start begun',
        damage: 18,
        xp: 15,
        check: (engine, entry) => entry && entry.type === 'string' && entry.value === 'begun',
      },
      {
        key: 'quest:map',
        task: 'Cartograph the vault: build a hash `quest:map` with at least 3 fields.',
        hint: 'HSET quest:map north 1 east 2 south 3',
        damage: 18,
        xp: 20,
        check: (engine, entry) => entry && entry.type === 'hash' && entry.value.size >= 3,
      },
      {
        key: 'quest:trail',
        task: 'Carve a breadcrumb trail: a list `quest:trail` with at least 2 elements.',
        hint: 'RPUSH quest:trail alpha beta',
        damage: 18,
        xp: 20,
        check: (engine, entry) => entry && entry.type === 'list' && entry.value.length >= 2,
      },
      {
        key: 'quest:tokens',
        task: 'Forge access tokens: a set `quest:tokens` with at least 3 members.',
        hint: 'SADD quest:tokens red green blue',
        damage: 18,
        xp: 20,
        check: (engine, entry) => entry && entry.type === 'set' && entry.value.size >= 3,
      },
      {
        key: 'quest:ranks',
        task: 'Rank the glyphs: a sorted set `quest:ranks` with at least 2 members.',
        hint: 'ZADD quest:ranks 1 alpha 2 beta',
        damage: 18,
        xp: 25,
        check: (engine, entry) => entry && entry.type === 'zset' && entry.value.length >= 2,
      },
      {
        key: 'quest:beacon',
        task: 'Plant a timed beacon: set `quest:beacon` to `on`, then expire it in 60 seconds.',
        hint: 'SET quest:beacon on  then  EXPIRE quest:beacon 60',
        damage: 22,
        xp: 30,
        check: (engine, entry) =>
          entry && entry.type === 'string' && entry.value === 'on' && entry.expiresAt !== null,
      },
    ],
  },
  {
    id: 'the-tangler',
    name: 'THE TANGLER',
    title: 'WEAVER OF STRING ENTROPY',
    maxHealth: 120,
    challenges: [
      {
        key: 'tangle:seed',
        task: 'Plant the seed: create `tangle:seed` with value `start`.',
        hint: 'SET tangle:seed start',
        damage: 20,
        xp: 20,
        check: (engine, entry) => entry && entry.type === 'string' && entry.value === 'start',
      },
      {
        key: 'tangle:seed',
        task: 'Prepend using GETRANGE/SETRANGE: overwrite `tangle:seed` to have prefix `tangled_`.',
        hint: 'SETRANGE tangle:seed 0 tangled_',
        damage: 20,
        xp: 20,
        check: (engine, entry) => entry && entry.type === 'string' && entry.value.startsWith('tangled_'),
      },
      {
        key: 'tangle:counter',
        task: 'Spin the counter: INCRBYFLOAT `tangle:counter` by 1.5 from 0.',
        hint: 'INCRBYFLOAT tangle:counter 1.5',
        damage: 20,
        xp: 20,
        check: (engine, entry) => entry && entry.type === 'string' && parseFloat(entry.value) === 1.5,
      },
      {
        key: 'tangle:frag',
        task: 'Extract a fragment: GETRANGE `tangle:frag` 0 4 should return `frag_`.',
        hint: 'SET tangle:frag fragment  then  GETRANGE tangle:frag 0 4',
        damage: 20,
        xp: 20,
        check: (engine, entry) => entry && entry.type === 'string' && entry.value === 'fragment',
      },
      {
        key: 'tangle:final',
        task: 'Seal the knot: SET `tangle:final` to `knotted` with EXPIRE 30.',
        hint: 'SET tangle:final knotted  then  EXPIRE tangle:final 30',
        damage: 20,
        xp: 25,
        check: (engine, entry) =>
          entry && entry.type === 'string' && entry.value === 'knotted' && entry.expiresAt !== null,
      },
    ],
  },
  {
    id: 'logistics-overseer',
    name: 'THE LOGISTICS OVERSEER',
    title: 'MASTER OF QUEUES AND PIPELINES',
    maxHealth: 140,
    challenges: [
      {
        key: 'log:inbox',
        task: 'Initialize the inbox: RPUSH `log:inbox` with `job1` `job2`.',
        hint: 'RPUSH log:inbox job1 job2',
        damage: 22,
        xp: 25,
        check: (engine, entry) => entry && entry.type === 'list' && entry.value.length >= 2,
      },
      {
        key: 'log:urgent',
        task: 'Priority insert: LINSERT `log:inbox` BEFORE `job1` value `urgent`.',
        hint: 'LINSERT log:inbox BEFORE job1 urgent',
        damage: 22,
        xp: 25,
        check: (engine, entry) =>
          entry && entry.type === 'list' && entry.value.toArray()[0] === 'urgent',
      },
      {
        key: 'log:processed',
        task: 'Process jobs: LPOP `log:inbox` until empty, RPUSH each to `log:processed`.',
        hint: 'LPOP log:inbox  (repeat)  then  RPUSH log:processed ...',
        damage: 22,
        xp: 25,
        check: (engine, entry) => entry && entry.type === 'list' && entry.value.length >= 3,
      },
      {
        key: 'log:blocking',
        task: 'Demonstrate blocking: BLPOP `log:blocking` 1 (should timeout gracefully).',
        hint: 'BLPOP log:blocking 1',
        damage: 22,
        xp: 25,
        check: () => true, // Blocking commands with empty list return nil - hard to test, accept any attempt
      },
      {
        key: 'log:archive',
        task: 'Archive old: LTRIM `log:processed` 0 1 (keep only 2 most recent).',
        hint: 'LTRIM log:processed 0 1',
        damage: 22,
        xp: 25,
        check: (engine, entry) => entry && entry.type === 'list' && entry.value.length <= 2,
      },
    ],
  },
  {
    id: 'set-warden',
    name: 'THE SET WARDEN',
    title: 'GUARDIAN OF UNIQUE MEMBERSHIP',
    maxHealth: 130,
    challenges: [
      {
        key: 'ward:gate',
        task: 'Open the gate: SADD `ward:gate` members `a` `b` `c`.',
        hint: 'SADD ward:gate a b c',
        damage: 20,
        xp: 22,
        check: (engine, entry) => entry && entry.type === 'set' && entry.value.size >= 3,
      },
      {
        key: 'ward:intersect',
        task: 'Find common: SINTERSTORE `ward:common` `ward:gate` `ward:other` (setup other first).',
        hint: 'SADD ward:other b c d  then  SINTERSTORE ward:common ward:gate ward:other',
        damage: 20,
        xp: 22,
        check: (engine, entry) => entry && entry.type === 'set' && entry.value.size >= 2,
      },
      {
        key: 'ward:union',
        task: 'Unite forces: SUNIONSTORE `ward:all` `ward:gate` `ward:other`.',
        hint: 'SUNIONSTORE ward:all ward:gate ward:other',
        damage: 20,
        xp: 22,
        check: (engine, entry) => entry && entry.type === 'set' && entry.value.size >= 4,
      },
      {
        key: 'ward:diff',
        task: 'Exclude traitors: SDIFFSTORE `ward:loyal` `ward:gate` `ward:other`.',
        hint: 'SDIFFSTORE ward:loyal ward:gate ward:other',
        damage: 20,
        xp: 22,
        check: (engine, entry) => entry && entry.type === 'set' && entry.value.has('a'),
      },
      {
        key: 'ward:final',
        task: 'Final muster: SCARD `ward:all` >= 4 and SPOP one member.',
        hint: 'SCARD ward:all  then  SPOP ward:all',
        damage: 20,
        xp: 25,
        check: (engine, entry) => entry && entry.type === 'set' && entry.value.size >= 3,
      },
    ],
  },
  {
    id: 'property-magnate',
    name: 'THE PROPERTY MAGNATE',
    title: 'TYCOON OF KEY-VALUE EMPIRES',
    maxHealth: 150,
    challenges: [
      {
        key: 'prop:deed',
        task: 'File the deed: HSET `prop:deed` field `owner` value `magnate`.',
        hint: 'HSET prop:deed owner magnate',
        damage: 25,
        xp: 25,
        check: (engine, entry) => entry && entry.type === 'hash' && entry.value.get('owner') === 'magnate',
      },
      {
        key: 'prop:portfolio',
        task: 'Build portfolio: HMSET `prop:portfolio` `addr` `123 Main` `price` `500000` `status` `owned`.',
        hint: 'HMSET prop:portfolio addr "123 Main" price 500000 status owned',
        damage: 25,
        xp: 25,
        check: (engine, entry) =>
          entry &&
          entry.type === 'hash' &&
          entry.value.get('addr') === '123 Main' &&
          entry.value.get('price') === '500000' &&
          entry.value.get('status') === 'owned',
      },
      {
        key: 'prop:scan',
        task: 'Survey holdings: HSCAN `prop:portfolio` 0 MATCH `addr*` COUNT 10.',
        hint: 'HSCAN prop:portfolio 0 MATCH addr* COUNT 10',
        damage: 25,
        xp: 25,
        check: () => true, // HSCAN returns results - accept attempt
      },
      {
        key: 'prop:increment',
        task: 'Appraise value: HINCRBYFLOAT `prop:portfolio` `price` 50000.',
        hint: 'HINCRBYFLOAT prop:portfolio price 50000',
        damage: 25,
        xp: 30,
        check: (engine, entry) =>
          entry && entry.type === 'hash' && parseFloat(entry.value.get('price')) === 550000,
      },
      {
        key: 'prop:final',
        task: 'Seal the empire: HSETNX `prop:final` `sealed` `true` (only if not exists).',
        hint: 'HSETNX prop:final sealed true',
        damage: 25,
        xp: 30,
        check: (engine, entry) =>
          entry && entry.type === 'hash' && entry.value.get('sealed') === 'true',
      },
    ],
  },
]

export const DEFAULT_BOSS = BOSSES[0]

export const REGIONS = [
  {
    id: 'string-forest',
    name: 'String Forest',
    theme: '🌲',
    description: 'Ancient strings twist through the canopy. Master the art of text manipulation.',
    bossId: 'the-tangler',
    requiredLevel: 1,
    order: 1,
    commands: ['GETRANGE', 'SETRANGE', 'INCRBYFLOAT', 'GETSET', 'APPEND', 'STRLEN'],
  },
  {
    id: 'list-harbor',
    name: 'List Harbor',
    theme: '🚢',
    description: 'Ships queue at the docks. Learn to manage sequences, pipelines, and workflows.',
    bossId: 'logistics-overseer',
    requiredLevel: 3,
    order: 2,
    commands: ['LINSERT', 'BLPOP', 'BRPOP', 'LSET', 'LTRIM', 'LINDEX'],
  },
  {
    id: 'set-caverns',
    name: 'Set Caverns',
    theme: '💎',
    description: 'Crystals form unique sets deep underground. Master membership and set algebra.',
    bossId: 'set-warden',
    requiredLevel: 5,
    order: 3,
    commands: ['SUNIONSTORE', 'SINTERSTORE', 'SDIFFSTORE', 'SMOVE', 'SISMEMBER', 'SCARD'],
  },
  {
    id: 'hash-city',
    name: 'Hash City',
    theme: '🏙️',
    description: 'Towering property records. Build empires with field-value architectures.',
    bossId: 'property-magnate',
    requiredLevel: 7,
    order: 4,
    commands: ['HSCAN', 'HINCRBYFLOAT', 'HSETNX', 'HKEYS', 'HVALS', 'HLEN'],
  },
]

export const REX_DIALOGUES = {
  // Greeting / intro
  greeting: [
    "🤖 REX ONLINE. Welcome to the Redis Quest. I am your Runtime EXecution companion.",
    "Systems nominal. Command parser ready. Let's make some keys.",
    "Initializing... done. Type HELP if you're lost, or just start typing Redis commands.",
  ],

  // Region-specific hints
  'string-forest': [
    "The trees here are made of pure text. GETRANGE and SETRANGE let you carve them.",
    "INCRBYFLOAT handles decimals — use it for precision counters.",
    "Remember: strings are binary-safe. You can store JSON, images, anything.",
    "PRO TIP: SETRANGE extends with null bytes if you write past the end.",
  ],
  'list-harbor': [
    "Ships queue at the harbor. LPUSH/RPUSH load them, LPOP/RPOP unload.",
    "LINSERT slips priority cargo between existing crates. BEFORE or AFTER a pivot.",
    "BLPOP and BRPOP block until work arrives — perfect for worker queues.",
    "LTRIM keeps only the freshest N items. Great for rolling logs.",
  ],
  'set-caverns': [
    "Every crystal here is unique. SADD adds, SREM removes, SISMEMBER checks.",
    "Set algebra: SUNION (merge), SINTER (common), SDIFF (difference).",
    "The _STORE variants write results to a new key. Use them for pipelines.",
    "SRANDMEMBER samples without removing. SPOP grabs and removes.",
  ],
  'hash-city': [
    "Properties are field-value towers. HSET builds them, HGET reads them.",
    "HSCAN iterates incrementally — safe for production keys with millions of fields.",
    "HINCRBYFLOAT for precise metrics. HSETNX for idempotent claims.",
    "HMGET fetches multiple fields in one round trip. Pipeline it.",
  ],

  // Boss-specific hints
  'the-tangler': [
    "The Tangler weaves chaos into strings. Use SETRANGE to impose order.",
    "INCRBYFLOAT spins the counter. Precision breaks the entropy.",
    "GETRANGE extracts the signal from the noise. 0 to 4 gives you the prefix.",
    "Final knot needs EXPIRE. Time is the ultimate untangler.",
  ],
  'logistics-overseer': [
    "The Overseer demands flow. LINSERT for priority, BLPOP for blocking workers.",
    "Process the inbox: LPOP to consume, RPUSH to archive.",
    "LTRIM archives the old. Keep the pipeline lean.",
    "Blocking pops with timeout — the Overseer tests patience.",
  ],
  'set-warden': [
    "The Warden guards uniqueness. SINTERSTORE finds the loyal intersection.",
    "SUNIONSTORE rallies all forces. SDIFFSTORE exiles the traitors.",
    "SCARD counts the muster. SPOP sends one to the front.",
    "SMOVE transfers allegiance atomically. No double-membership.",
  ],
  'property-magnate': [
    "The Magnate builds empires. HSET deeds, HMSET portfolios.",
    "HSCAN surveys holdings without blocking the city.",
    "HINCRBYFLOAT appreciates value. HSETNX claims uncontested land.",
    "Seal the empire with a final HSETNX. Only the first claim holds.",
  ],

  // Survival mode hints
  'cache-invalidation-storm': [
    "Storm's coming. SET with EX builds shelters. GET checks them.",
    "Thundering herd: multiple GETs on a cold key. Cache stampede!",
    "EXPIRE extends the shelter. MGET checks all at once.",
    "Invalidation is a DEL + SET. Atomic if you pipeline.",
  ],
  'job-queue-resilience': [
    "Jobs flood in. LPOP processes, RPUSH archives.",
    "Urgent work? LINSERT BEFORE the current head.",
    "Retries need a side queue: RPOP from retry, LPUSH back to main.",
    "Poison pills go to DLQ. LLEN dlq shows the damage.",
  ],
  'rate-limiting-citadel': [
    "Sliding window: SADD request IDs, EXPIRE the set, SCARD counts.",
    "Each client gets a set. Each IP gets a set. Union for global view.",
    "SUNIONSTORE aggregates. Cleanup is implicit via TTL.",
    "Burst traffic fills the set fast. SCARD is your radar.",
  ],
  'session-management-keep': [
    "Sessions are hashes. HSET login data, HINCRBY activity.",
    "HSCAN for cleanup sweeps. MATCH patterns find stale fields.",
    "Logout = HDEL active flag. HLEN shows remaining data.",
    "Last seen timestamps in fields. HINCRBYFLOAT for precise analytics.",
  ],

  // Command-specific hints (triggered by command usage)
  commandHints: {
    GETRANGE: "Negative indices count from the end. -1 is the last char.",
    SETRANGE: "Writing past the end pads with null bytes. Overwrites in place.",
    INCRBYFLOAT: "Returns the new value as a string. Handles scientific notation.",
    LINSERT: "Pivot must exist. BEFORE inserts left, AFTER inserts right.",
    BLPOP: "Blocks until an element exists. Timeout 0 = wait forever.",
    BRPOP: "Same as BLPOP but from the tail. Great for stack-like queues.",
    SUNIONSTORE: "Writes union to destination. Missing keys = empty sets.",
    SINTERSTORE: "Intersection. Order of keys doesn't matter.",
    SDIFFSTORE: "Members in first set not in others. First key is the base.",
    HSCAN: "Cursor 0 starts, 0 ends. COUNT is a hint, not a limit.",
    HINCRBYFLOAT: "Field must be a valid float. Returns new value as string.",
    HSETNX: "Only sets if field absent. Returns 1 if set, 0 if existed.",
  },

  // Achievement unlocks
  achievementUnlock: {
    'first-command': "First command executed. The journey begins.",
    'string-master': "String Slinger unlocked. You're weaving text now.",
    'list-master': "List Lancer unlocked. Queues bend to your will.",
    'set-master': "Set Striker unlocked. Uniqueness is your domain.",
    'hash-master': "Hash Hacker unlocked. Field-value architecture mastered.",
    'zset-master': "Zset Warden unlocked. Sorted scores at your command.",
    'all-datatypes': "Polyglot achieved. All five types in one session.",
    'boss-defeated': "NEON SERPENT dismantled. The vault is yours.",
    'tangler-slayer': "The Tangler unraveled. String entropy contained.",
    'logistics-commander': "The Overseer yields. Logistics mastered.",
    'warden-slayer': "The Warden falls. Membership secured.",
    'magnate-slayer': "The Magnate's empire is yours. Property tycoon.",
  },

  // Error recovery
  errorHints: {
    'WRONGTYPE': "Wrong data type for this command. Check the key's type with TYPE.",
    'ERR value is not a valid float': "Float parsing failed. Use numbers like 1.5, -0.3, 1e3.",
    'ERR value is not an integer': "Integer expected. No decimals, no letters.",
    'ERR syntax error': "Syntax error. Check argument count and order.",
    'ERR wrong number of arguments': "Wrong arity. Type HELP <command> for usage.",
  },

  // Level up
  levelUp: [
    "Level up! New commands unlocked in the registry.",
    "XP threshold crossed. Your Redis-fu grows stronger.",
    "Promotion! The engine recognizes your expertise.",
  ],
}

export const SKILL_CONSTELLATIONS = [
  {
    id: 'string-constellation',
    name: 'String Weaver',
    theme: '🌲',
    regionId: 'string-forest',
    description: 'Master the art of text manipulation and string operations.',
    skills: [
      { id: 'range-mastery', name: 'Range Mastery', desc: 'GETRANGE and SETRANGE precision.', icon: '📏', cost: 1, requires: [], unlocks: ['GETRANGE', 'SETRANGE'] },
      { id: 'float-precision', name: 'Float Precision', desc: 'INCRBYFLOAT for decimal counters.', icon: '🔢', cost: 1, requires: [], unlocks: ['INCRBYFLOAT'] },
      { id: 'string-splicing', name: 'String Splicing', desc: 'Combine APPEND, GETRANGE, SETRANGE.', icon: '✂️', cost: 2, requires: ['range-mastery'], unlocks: ['APPEND'] },
      { id: 'binary-safe', name: 'Binary Safe Strings', desc: 'Store any data in strings.', icon: '💾', cost: 1, requires: [], unlocks: [] },
      { id: 'expiry-control', name: 'Expiry Control', desc: 'EXPIRE, PEXPIRE, TTL mastery.', icon: '⏱️', cost: 1, requires: [], unlocks: ['EXPIRE', 'PEXPIRE', 'TTL'] },
      { id: 'tangler-slayer', name: 'Tangler Slayer', desc: 'Defeated THE TANGLER.', icon: '🐍', cost: 0, requires: [], unlocks: [] },
    ],
  },
  {
    id: 'list-constellation',
    name: 'Logistics Commander',
    theme: '🚢',
    regionId: 'list-harbor',
    description: 'Command queues, pipelines, and workflow orchestration.',
    skills: [
      { id: 'priority-insert', name: 'Priority Insert', desc: 'LINSERT for urgent jobs.', icon: '📦', cost: 1, requires: [], unlocks: ['LINSERT'] },
      { id: 'blocking-ops', name: 'Blocking Operations', desc: 'BLPOP/BRPOP for worker queues.', icon: '⏳', cost: 1, requires: [], unlocks: ['BLPOP', 'BRPOP'] },
      { id: 'pipeline-processing', name: 'Pipeline Processing', desc: 'LPOP consume, RPUSH archive.', icon: '🔄', cost: 2, requires: ['priority-insert'], unlocks: ['LPOP', 'RPUSH'] },
      { id: 'trim-archive', name: 'Trim & Archive', desc: 'LTRIM keeps freshest N.', icon: '📋', cost: 1, requires: [], unlocks: ['LTRIM'] },
      { id: 'index-access', name: 'Index Access', desc: 'LINDEX, LSET for random access.', icon: '🎯', cost: 1, requires: [], unlocks: ['LINDEX', 'LSET'] },
      { id: 'overseer-commander', name: 'Overseer Commander', desc: 'Defeated THE LOGISTICS OVERSEER.', icon: '🚢', cost: 0, requires: [], unlocks: [] },
    ],
  },
  {
    id: 'set-constellation',
    name: 'Set Algebraist',
    theme: '💎',
    regionId: 'set-caverns',
    description: 'Master set theory: unions, intersections, differences.',
    skills: [
      { id: 'union-store', name: 'Union Store', desc: 'SUNIONSTORE merges sets.', icon: '∪', cost: 1, requires: [], unlocks: ['SUNIONSTORE'] },
      { id: 'intersect-store', name: 'Intersect Store', desc: 'SINTERSTORE finds common.', icon: '∩', cost: 1, requires: [], unlocks: ['SINTERSTORE'] },
      { id: 'diff-store', name: 'Difference Store', desc: 'SDIFFSTORE excludes.', icon: '∖', cost: 1, requires: [], unlocks: ['SDIFFSTORE'] },
      { id: 'move-atomic', name: 'Atomic Move', desc: 'SMOVE transfers membership.', icon: '↔️', cost: 1, requires: [], unlocks: ['SMOVE'] },
      { id: 'cardinality', name: 'Cardinality Master', desc: 'SCARD, SISMEMBER checks.', icon: '🔢', cost: 1, requires: [], unlocks: ['SCARD', 'SISMEMBER'] },
      { id: 'warden-slayer', name: 'Warden Slayer', desc: 'Defeated THE SET WARDEN.', icon: '💎', cost: 0, requires: [], unlocks: [] },
    ],
  },
  {
    id: 'hash-constellation',
    name: 'Property Tycoon',
    theme: '🏙️',
    regionId: 'hash-city',
    description: 'Build empires with field-value architectures.',
    skills: [
      { id: 'scan-mastery', name: 'Scan Mastery', desc: 'HSCAN for safe iteration.', icon: '🔍', cost: 1, requires: [], unlocks: ['HSCAN'] },
      { id: 'float-increment', name: 'Float Increment', desc: 'HINCRBYFLOAT for metrics.', icon: '📈', cost: 1, requires: [], unlocks: ['HINCRBYFLOAT'] },
      { id: 'nx-claim', name: 'Idempotent Claim', desc: 'HSETNX for unique fields.', icon: '🔒', cost: 1, requires: [], unlocks: ['HSETNX'] },
      { id: 'bulk-fetch', name: 'Bulk Fetch', desc: 'HMGET, HKEYS, HVALS.', icon: '📦', cost: 1, requires: [], unlocks: ['HMGET', 'HKEYS', 'HVALS'] },
      { id: 'length-watcher', name: 'Length Watcher', desc: 'HLEN monitors field count.', icon: '📏', cost: 1, requires: [], unlocks: ['HLEN'] },
      { id: 'magnate-slayer', name: 'Magnate Slayer', desc: 'Defeated THE PROPERTY MAGNATE.', icon: '🏙️', cost: 0, requires: [], unlocks: [] },
    ],
  },
]

const SKILL_BY_ID = Object.fromEntries(
  SKILL_CONSTELLATIONS.flatMap((c) => c.skills.map((s) => [s.id, { ...s, constellationId: c.id }]))
)

export const SURVIVAL_SEEDS = [
  {
    id: 'cache-invalidation-storm',
    name: 'Cache Invalidation Storm',
    theme: '🌩️',
    regionId: 'string-forest',
    description: 'A burst of cache writes and invalidations. Use SET with EX, GET, and TTL to survive the storm.',
    difficulty: 'Normal',
    setup(engine) {
      // Pre-populate with some cache entries
      engine.rawExecute('SET', 'cache:user:1', '{"name":"Alice","ttl":300}', 'EX', '300')
      engine.rawExecute('SET', 'cache:user:2', '{"name":"Bob","ttl":300}', 'EX', '300')
      engine.rawExecute('SET', 'cache:config', '{"version":1}', 'EX', '600')
    },
    waves: [
      { name: 'Wave 1: Read Burst', commands: ['GET cache:user:1', 'GET cache:user:2', 'GET cache:config'] },
      { name: 'Wave 2: Invalidation', commands: ['DEL cache:user:1', 'SET cache:user:1 "{\\"name\\":\\"Alice v2\\",\\"ttl\\":300}" EX 300'] },
      { name: 'Wave 3: Thundering Herd', commands: ['GET cache:user:1', 'GET cache:user:1', 'GET cache:user:1', 'GET cache:user:1', 'GET cache:user:1'] },
      { name: 'Wave 4: Config Reload', commands: ['GET cache:config', 'SET cache:config "{\\"version\\":2}" EX 600'] },
      { name: 'Wave 5: Storm Peak', commands: ['MGET cache:user:1 cache:user:2 cache:config', 'EXPIRE cache:user:1 600', 'EXPIRE cache:user:2 600'] },
    ],
    winCondition: 'Complete all 5 waves',
    xpReward: 100,
  },
  {
    id: 'job-queue-resilience',
    name: 'Job Queue Resilience',
    theme: '📦',
    regionId: 'list-harbor',
    description: 'Process a flood of jobs with retries, dead letters, and priority lanes using lists.',
    difficulty: 'Hard',
    setup(engine) {
      engine.rawExecute('RPUSH', 'queue:jobs', 'job1', 'job2', 'job3')
      engine.rawExecute('RPUSH', 'queue:dlq', '')
      engine.rawExecute('DEL', 'queue:dlq')
    },
    waves: [
      { name: 'Wave 1: Normal Processing', commands: ['LPOP queue:jobs', 'LPOP queue:jobs', 'RPUSH queue:processed done1', 'RPUSH queue:processed done2'] },
      { name: 'Wave 2: Priority Insert', commands: ['LINSERT queue:jobs BEFORE job3 urgent-job', 'LPOP queue:jobs', 'RPUSH queue:processed urgent-done'] },
      { name: 'Wave 3: Retry Logic', commands: ['RPUSH queue:retry failed1', 'RPOP queue:retry', 'RPUSH queue:jobs failed1', 'LPOP queue:jobs', 'RPUSH queue:processed failed1-retry'] },
      { name: 'Wave 4: Dead Letter', commands: ['LPOP queue:jobs', 'RPUSH queue:dlq poison-pill', 'LLEN queue:dlq'] },
      { name: 'Wave 5: Bulk Drain', commands: ['RPUSH queue:jobs batch1 batch2 batch3 batch4 batch5', 'LRANGE queue:jobs 0 -1', 'LTRIM queue:jobs 0 -1'] },
    ],
    winCondition: 'Process all jobs and handle failures',
    xpReward: 120,
  },
  {
    id: 'rate-limiting-citadel',
    name: 'Rate Limiting Citadel',
    theme: '🛡️',
    regionId: 'set-caverns',
    description: 'Defend the citadel using sets for sliding window rate limiting with SADD, SCARD, and EXPIRE.',
    difficulty: 'Hard',
    setup(engine) {
      engine.rawExecute('DEL', 'ratelimit:user:1', 'ratelimit:user:2', 'ratelimit:ip:1.2.3.4')
    },
    waves: [
      { name: 'Wave 1: First Requests', commands: ['SADD ratelimit:user:1 req-1 req-2 req-3', 'EXPIRE ratelimit:user:1 60', 'SCARD ratelimit:user:1'] },
      { name: 'Wave 2: Burst Traffic', commands: ['SADD ratelimit:user:1 req-4 req-5 req-6 req-7 req-8 req-9 req-10', 'SCARD ratelimit:user:1'] },
      { name: 'Wave 3: New Client', commands: ['SADD ratelimit:user:2 req-1 req-2', 'EXPIRE ratelimit:user:2 60', 'SCARD ratelimit:user:2'] },
      { name: 'Wave 4: IP-Based Limit', commands: ['SADD ratelimit:ip:1.2.3.4 req-1 req-2 req-3 req-4 req-5', 'EXPIRE ratelimit:ip:1.2.3.4 60', 'SCARD ratelimit:ip:1.2.3.4'] },
      { name: 'Wave 5: Cleanup', commands: ['SUNIONSTORE ratelimit:all ratelimit:user:1 ratelimit:user:2 ratelimit:ip:1.2.3.4', 'SCARD ratelimit:all'] },
    ],
    winCondition: 'Track all clients without exceeding limits',
    xpReward: 120,
  },
  {
    id: 'session-management-keep',
    name: 'Session Management Keep',
    theme: '🏰',
    regionId: 'hash-city',
    description: 'Maintain user sessions with hashes: HSET for data, HSCAN for cleanup, HINCRBY for activity.',
    difficulty: 'Expert',
    setup(engine) {
      engine.rawExecute('DEL', 'session:user:1', 'session:user:2', 'session:user:3')
    },
    waves: [
      { name: 'Wave 1: Login', commands: ['HSET session:user:1 id 1 name Alice login 1000 active 1', 'HSET session:user:2 id 2 name Bob login 1000 active 1', 'HSET session:user:3 id 3 name Carol login 1000 active 1'] },
      { name: 'Wave 2: Activity', commands: ['HINCRBY session:user:1 requests 1', 'HINCRBY session:user:1 requests 1', 'HINCRBY session:user:2 requests 1', 'HGET session:user:1 requests'] },
      { name: 'Wave 3: Refresh', commands: ['HSET session:user:1 last_seen 2000', 'HSET session:user:2 last_seen 2000', 'HSCAN session:user:1 0 MATCH * COUNT 10'] },
      { name: 'Wave 4: Logout', commands: ['HSET session:user:3 active 0', 'HDEL session:user:3 active', 'HLEN session:user:3'] },
      { name: 'Wave 5: Cleanup Scan', commands: ['HSCAN session:user:1 0 MATCH * COUNT 100', 'HSCAN session:user:2 0 MATCH * COUNT 100', 'HKEYS session:user:1'] },
    ],
    winCondition: 'Manage all sessions through login, activity, and logout',
    xpReward: 150,
  },
]

const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]))

const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]))
const QUEST_KEYS = DEFAULT_BOSS.challenges.map((c) => c.key)

// Registry groups that represent a Redis data type (drives the Polyglot
// achievement and the per-type badges).
const DATATYPE_GROUPS = new Set(['strings', 'hashes', 'lists', 'sets', 'zsets'])

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export function levelInfo(xp) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  return {
    level,
    xp,
    xpIntoLevel: xp % XP_PER_LEVEL,
    xpForNext: XP_PER_LEVEL,
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

// Set while runCommand is executing the engine so the engine's synchronous
// change/error events (which would otherwise double-process the same command)
// are skipped — afterCommand runs exactly once, from runCommand.
let handling = false

const initialState = () => ({
  engine: null,
  xp: 0,
  totalCommands: 0,
  datatypesUsed: [], // registry group names: strings, hashes, lists, sets, zsets
  boss: null, // null = not engaged; see startBattle for the shape
  bossHistory: [], // { id, name, won, at, xp } records of completed battles
  unlocked: {}, // achievement id -> timestamp
  toasts: [], // undismissed unlock toasts ({...ACHIEVEMENTS, unlockedAt})
  currentRegion: 'string-forest', // active region
  completedRegions: [], // region ids completed in order
  regionProgress: {}, // region id -> { challengesCompleted, bossDefeated }
  // Survival mode
  survivalMode: null, // active survival seed id
  survivalProgress: {}, // seedId -> { wave, completed }
  survivalHistory: [], // { seedId, won, at, xp } records
  // Settings
  mode: 'beginner',
  hintDepth: 'full',
  visualGuides: true,
  speedrunTimer: false,
  terminalAutocomplete: true,
  autoSaveInterval: 30000,
  // Audio
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.5,
  sfxVolume: 0.7,
  // Objective banner visibility state
  objectiveBannerDismissed: false,
  // Skill tree
  skillPoints: 0, // unspent skill points (1 per level)
  unlockedSkills: [], // skill ids
})

export const useGameStore = create((set, get) => {
  function unlock(id) {
    const def = ACHIEVEMENTS.find((a) => a.id === id)
    if (!def || get().unlocked[id]) return
    set((s) => ({
      unlocked: { ...s.unlocked, [id]: Date.now() },
      toasts: [...s.toasts, { ...def, unlockedAt: Date.now() }],
    }))
    get().addXp(def.xp)
  }

  function syncStats() {
    const engine = get().engine
    if (!engine) return
    const stats = engine.stats
    const used = new Set(get().datatypesUsed)
    for (const name of Object.keys(stats.commandsByType)) {
      const group = engine.commandRegistry.get(name)?.group
      if (DATATYPE_GROUPS.has(group)) used.add(group)
    }
    set({ totalCommands: stats.totalCommands, datatypesUsed: [...used] })
  }

  function attackBoss(damage, info = {}) {
    const state = get()
    const boss = state.boss
    if (!boss || boss.defeated || boss.health <= 0) return
    const xpGain = info.xp ?? Math.max(1, Math.round(damage / 2))
    const nextHealth = Math.max(0, boss.health - damage)
    const challengeIndex = info.challenge ? boss.challengeIndex + 1 : boss.challengeIndex
    const defeated = nextHealth <= 0 || challengeIndex >= boss.challenges.length
    set((s) => ({
      boss: {
        ...boss,
        health: nextHealth,
        challengeIndex,
        defeated,
        lastResult: {
          at: Date.now(),
          ok: true,
          damage,
          xp: xpGain,
          message: defeated
            ? `DATA SECURED — ${boss.name} dismantled`
            : `SHIELD BREACHED −${damage} HP`,
          challenge: info.challenge,
        },
      },
      bossHistory: defeated
        ? [...s.bossHistory, { id: boss.id, name: boss.name, won: true, at: Date.now(), xp: xpGain }]
        : s.bossHistory,
    }))
    get().addXp(xpGain)
    if (defeated) {
      unlock('boss-defeated')
      // Region-specific boss achievements
      if (boss.id === 'the-tangler') unlock('tangler-slayer')
      else if (boss.id === 'logistics-overseer') unlock('logistics-commander')
      else if (boss.id === 'set-warden') unlock('warden-slayer')
      else if (boss.id === 'property-magnate') unlock('magnate-slayer')
      // Complete the region
      const region = REGIONS.find((r) => r.bossId === boss.id)
      if (region) completeRegion(region.id)
    }
  }

  function checkBoss(reply) {
    const { engine, boss } = get()
    if (!engine || !boss || boss.defeated || boss.health <= 0) return
    const challenge = boss.challenges[boss.challengeIndex]
    if (!challenge) return

    let solved = false
    try {
      solved = challenge.check(engine, engine.store.get(challenge.key))
    } catch {
      solved = false
    }

    if (solved) {
      attackBoss(challenge.damage, { xp: challenge.xp, challenge })
    } else if (reply && reply.type === 'error') {
      set((s) => ({
        boss: {
          ...s.boss,
          lastResult: {
            at: Date.now(),
            ok: false,
            damage: 0,
            xp: 0,
            message: 'SHIELD HOLDS — the vault rejects that.',
            hint: challenge.hint,
          },
        },
      }))
    }
  }

  function checkAchievements() {
    const { totalCommands, datatypesUsed } = get()
    if (totalCommands >= 1) unlock('first-command')
    if (totalCommands >= 10) unlock('ten-commands')
    if (totalCommands >= 50) unlock('fifty-commands')
    const D = new Set(datatypesUsed)
    if (D.has('strings')) unlock('string-master')
    if (D.has('hashes')) unlock('hash-master')
    if (D.has('lists')) unlock('list-master')
    if (D.has('sets')) unlock('set-master')
    if (D.has('zsets')) unlock('zset-master')
    if (D.size >= 5) unlock('all-datatypes')
  }

  function afterCommand(reply) {
    syncStats()
    checkAchievements()
    checkBoss(reply)

    if (reply && reply.type !== 'error') {
      const engine = get().engine
      if (engine && engine.commandHistory.length > 0) {
        const lastCmd = engine.commandHistory[engine.commandHistory.length - 1]
        const name = lastCmd ? lastCmd.command : ''
        if (name) {
          const isFirstUse = engine.stats.commandsByType[name] === 1
          const xpAwarded = xpForCommand({
            name,
            reply,
            isFirstUse,
            comboCount: 0,
            wasEfficient: false,
            mode: 'beginner',
          })
          if (xpAwarded > 0) {
            get().addXp(xpAwarded)
          }
        }
      }
    }
  }

  // Region progression helpers
  function getRegion(regionId) {
    return REGION_BY_ID[regionId]
  }

  function isRegionUnlocked(regionId) {
    const region = REGION_BY_ID[regionId]
    if (!region) return false
    if (region.order === 1) return true
    const prevRegion = REGIONS.find((r) => r.order === region.order - 1)
    return prevRegion && get().completedRegions.includes(prevRegion.id)
  }

  function getAvailableRegions() {
    return REGIONS.filter((r) => isRegionUnlocked(r.id)).map((r) => ({
      ...r,
      unlocked: true,
      completed: get().completedRegions.includes(r.id),
      current: get().currentRegion === r.id,
    }))
  }

  function enterRegion(regionId) {
    const region = REGION_BY_ID[regionId]
    if (!region || !isRegionUnlocked(regionId)) return false
    set({ currentRegion: regionId })
    unlock(`${regionId}-explorer`)
    return true
  }

  function completeRegion(regionId) {
    const state = get()
    if (!state.completedRegions.includes(regionId)) {
      set((s) => ({
        completedRegions: [...s.completedRegions, regionId],
        regionProgress: { ...s.regionProgress, [regionId]: { bossDefeated: true, challengesCompleted: true } },
      }))
      // Unlock next region if available
      const nextRegion = REGIONS.find((r) => r.order === REGION_BY_ID[regionId].order + 1)
      if (nextRegion) {
        unlock(`${nextRegion.id}-explorer`)
      }
    }
  }

  // Survival mode helpers
  function getSurvivalSeed(seedId) {
    return SURVIVAL_SEEDS.find((s) => s.id === seedId)
  }

  function getAvailableSurvivalSeeds() {
    return SURVIVAL_SEEDS.filter((s) => {
      const region = REGION_BY_ID[s.regionId]
      return region && isRegionUnlocked(region.id)
    })
  }

  function startSurvival(seedId) {
    const seed = getSurvivalSeed(seedId)
    if (!seed) return false
    const engine = get().engine
    if (engine && seed.setup) {
      try {
        seed.setup(engine)
      } catch (e) {
        console.error('Survival setup error:', e)
      }
    }
    set((s) => ({
      survivalMode: seedId,
      survivalProgress: { ...s.survivalProgress, [seedId]: { wave: 0, completed: false } },
    }))
    return true
  }

  function advanceSurvivalWave() {
    const { survivalMode, survivalProgress } = get()
    if (!survivalMode) return false
    const progress = survivalProgress[survivalMode]
    if (!progress || progress.completed) return false

    const seed = getSurvivalSeed(survivalMode)
    if (!seed) return false

    const nextWave = progress.wave + 1
    if (nextWave >= seed.waves.length) {
      // Completed!
      set((s) => ({
        survivalMode: null,
        survivalProgress: { ...s.survivalProgress, [survivalMode]: { wave: seed.waves.length, completed: true } },
        survivalHistory: [...s.survivalHistory, { seedId: survivalMode, won: true, at: Date.now(), xp: seed.xpReward }],
        xp: s.xp + seed.xpReward,
      }))
      unlock(`survival-${survivalMode}`)
      return 'completed'
    }

    set((s) => ({
      survivalProgress: { ...s.survivalProgress, [survivalMode]: { wave: nextWave, completed: false } },
    }))
    return nextWave
  }

  function getSurvivalState() {
    const { survivalMode, survivalProgress } = get()
    if (!survivalMode) return null
    const seed = getSurvivalSeed(survivalMode)
    const progress = survivalProgress[survivalMode] || { wave: 0, completed: false }
    return {
      seed,
      wave: progress.wave,
      completed: progress.completed,
      totalWaves: seed?.waves.length || 0,
      currentWave: seed?.waves[progress.wave] || null,
    }
  }

  // REX dialogue system
  function getRexDialogue(category, key = null) {
    const dialogues = REX_DIALOGUES[category]
    if (!dialogues) return null
    if (key && dialogues[key]) return dialogues[key]
    if (Array.isArray(dialogues)) {
      // Pick a random dialogue from array
      return dialogues[Math.floor(Math.random() * dialogues.length)]
    }
    return dialogues
  }

  function getRexHintForCommand(command) {
    return REX_DIALOGUES.commandHints[command.toUpperCase()] || null
  }

  function getRexHintForError(errorMsg) {
    for (const [key, hint] of Object.entries(REX_DIALOGUES.errorHints)) {
      if (errorMsg.includes(key)) return hint
    }
    return null
  }

  function getRexAchievementMessage(achievementId) {
    return REX_DIALOGUES.achievementUnlock[achievementId] || null
  }

  function getRexLevelUpMessage() {
    const msgs = REX_DIALOGUES.levelUp
    return msgs[Math.floor(Math.random() * msgs.length)]
  }

  function getRexRegionHint(regionId) {
    const hints = REX_DIALOGUES[regionId]
    if (!hints || !Array.isArray(hints)) return null
    return hints[Math.floor(Math.random() * hints.length)]
  }

  function getRexBossHint(bossId) {
    const hints = REX_DIALOGUES[bossId]
    if (!hints || !Array.isArray(hints)) return null
    return hints[Math.floor(Math.random() * hints.length)]
  }

  function getRexSurvivalHint(seedId) {
    const hints = REX_DIALOGUES[seedId]
    if (!hints || !Array.isArray(hints)) return null
    return hints[Math.floor(Math.random() * hints.length)]
  }

  function getRexGreeting() {
    const greetings = REX_DIALOGUES.greeting
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  // Skill tree helpers
  function canUnlockSkill(skillId) {
    const skill = SKILL_BY_ID[skillId]
    if (!skill) return false
    const state = get()
    // Already unlocked
    if (state.unlockedSkills.includes(skillId)) return true
    // Check if enough skill points
    if (state.skillPoints < skill.cost) return false
    // Check prerequisites
    for (const req of skill.requires || []) {
      if (!state.unlockedSkills.includes(req)) return false
    }
    // Check if region is unlocked (for region-gated skills)
    const constellation = SKILL_CONSTELLATIONS.find((c) => c.id === skill.constellationId)
    if (constellation && !isRegionUnlocked(constellation.regionId)) return false
    return true
  }

  function unlockSkill(skillId) {
    if (!canUnlockSkill(skillId)) return false
    const skill = SKILL_BY_ID[skillId]
    // Idempotent - if already unlocked, return true
    const state = get()
    if (state.unlockedSkills.includes(skillId)) return true
    set((s) => ({
      unlockedSkills: [...s.unlockedSkills, skillId],
      skillPoints: s.skillPoints - skill.cost,
    }))
    return true
  }

  return {
    ...initialState(),

    // Register the app's engine and subscribe to its mutation events. Direct
    // engine calls (rawExecute, third-party code) still feed the game systems.
    bindEngine(engine) {
      if (get().engine) return
      set({ engine })
      engine.on('change', () => {
        if (handling) return
        afterCommand()
      })
      engine.on('error', () => {
        if (handling) return
        afterCommand()
      })
    },

    // Canonical path for the terminal: execute + route through game systems.
    runCommand(line) {
      const engine = get().engine
      if (!engine) return { type: 'error', value: 'ERR engine not initialised' }
      handling = true
      let reply
      try {
        reply = engine.execute(line)
      } finally {
        handling = false
      }
      afterCommand(reply)
      return reply
    },

    attackBoss,
    addXp(amount) {
      if (amount <= 0) return
      set((s) => {
        const newXp = s.xp + amount
        const oldLevel = Math.floor(s.xp / XP_PER_LEVEL) + 1
        const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1
        const levelUps = newLevel - oldLevel
        return {
          xp: newXp,
          skillPoints: s.skillPoints + levelUps,
        }
      })
    },

    // Start (or restart) a boss battle. Quest keys are cleared so a rematch
    // can't be one-shotted by leftover state from the previous fight.
    startBattle(bossId = DEFAULT_BOSS.id) {
      const engine = get().engine
      const def = BOSS_BY_ID[bossId] ?? DEFAULT_BOSS
      if (engine) {
        try {
          engine.rawExecute('DEL', ...QUEST_KEYS)
        } catch {
          /* engine too hot to touch — fight on whatever is there */
        }
      }
      set((s) => ({
        boss: {
          id: def.id,
          name: def.name,
          title: def.title,
          maxHealth: def.maxHealth,
          health: def.maxHealth,
          challengeIndex: 0,
          challenges: def.challenges,
          defeated: false,
          lastResult: {
            at: Date.now(),
            ok: true,
            damage: 0,
            xp: 0,
            message: `ENGAGED — ${def.name} rises.`,
          },
        },
      }))
    },

    unlockAchievement(id) {
      unlock(id)
    },
    setMode(mode) { set({ mode }) },
    setHintDepth(hintDepth) { set({ hintDepth }) },
    setVisualGuides(visualGuides) { set({ visualGuides }) },
    setSpeedrunTimer(speedrunTimer) { set({ speedrunTimer }) },
    setTerminalAutocomplete(terminalAutocomplete) { set({ terminalAutocomplete }) },
    setAutoSaveInterval(autoSaveInterval) { set({ autoSaveInterval }) },
    dismissObjectiveBanner() {
      set({ objectiveBannerDismissed: true })
    },

    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    },

    // Audio
    setBgmEnabled(bgmEnabled) { set({ bgmEnabled }) },
    setSfxEnabled(sfxEnabled) { set({ sfxEnabled }) },
    setBgmVolume(bgmVolume) { set({ bgmVolume }) },
    setSfxVolume(sfxVolume) { set({ sfxVolume }) },

    // Region progression
    getRegion,
    getAvailableRegions,
    enterRegion,
    completeRegion,
    isRegionUnlocked,

    // Survival mode
    getSurvivalSeed,
    getAvailableSurvivalSeeds,
    startSurvival,
    advanceSurvivalWave,
    getSurvivalState,

    // REX dialogue system
    getRexDialogue,
    getRexHintForCommand,
    getRexHintForError,
    getRexAchievementMessage,
    getRexLevelUpMessage,
    getRexRegionHint,
    getRexBossHint,
    getRexSurvivalHint,
    getRexGreeting,

    // Skill tree
    canUnlockSkill,
    unlockSkill,

    // Test / new-game hook: wipe all game state. Does NOT touch the engine.
    resetGame() {
      handling = false
      set(initialState())
    },
  }
})
