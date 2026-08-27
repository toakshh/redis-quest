// 30+ achievements across 5 categories.
// Each achievement has:
// - id: unique key
// - name: display name
// - description: what to do
// - category: 'discovery' | 'mastery' | 'boss' | 'exploration' | 'meta'
// - rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
// - xp: XP reward
// - icon: emoji
// - criteria: function(state) => boolean - evaluated on each command/game event

import { SKILLS } from './skills.js'

export const ACHIEVEMENTS = [
  // DISCOVERY (First-time actions)
  {
    id: 'first-command',
    name: 'First Blood',
    description: 'Execute your very first Redis command.',
    category: 'discovery',
    rarity: 'common',
    xp: 10,
    icon: '🩸',
    criteria: (state) => state.totalCommands >= 1,
  },
  {
    id: 'first-error',
    name: 'Trial by Error',
    description: 'Encounter your first command error. Every expert was once a beginner.',
    category: 'discovery',
    rarity: 'common',
    xp: 5,
    icon: '💥',
    criteria: (state) => state.totalErrors >= 1,
  },
  {
    id: 'first-keyspace',
    name: 'Key Master',
    description: 'Use KEYS or SCAN to explore the keyspace.',
    category: 'discovery',
    rarity: 'common',
    xp: 15,
    icon: '🔑',
    criteria: (state) => state.commandsByType?.keys || state.commandsByType?.scan,
  },
  {
    id: 'first-expiry',
    name: 'Time Lord',
    description: 'Set your first TTL with EXPIRE or EXPIREAT.',
    category: 'discovery',
    rarity: 'common',
    xp: 15,
    icon: '⏳',
    criteria: (state) => state.commandsByType?.expire || state.commandsByType?.pexpire,
  },
  {
    id: 'first-pubsub',
    name: 'Broadcaster',
    description: 'Publish your first message with PUBLISH.',
    category: 'discovery',
    rarity: 'uncommon',
    xp: 25,
    icon: '📢',
    criteria: (state) => state.commandsByType?.publish,
  },
  {
    id: 'first-transaction',
    name: 'Deal Maker',
    description: 'Execute your first transaction with MULTI/EXEC.',
    category: 'discovery',
    rarity: 'uncommon',
    xp: 30,
    icon: '🤝',
    criteria: (state) => state.commandsByType?.multi && state.commandsByType?.exec,
  },
  {
    id: 'first-script',
    name: 'Script Kiddie',
    description: 'Run your first Lua script with EVAL.',
    category: 'discovery',
    rarity: 'rare',
    xp: 40,
    icon: '📜',
    criteria: (state) => state.commandsByType?.eval,
  },
  {
    id: 'first-stream',
    name: 'Stream Dream',
    description: 'Append your first entry to a stream with XADD.',
    category: 'discovery',
    rarity: 'rare',
    xp: 40,
    icon: '🌊',
    criteria: (state) => state.commandsByType?.xadd,
  },
  {
    id: 'first-cluster',
    name: 'Cluster Pioneer',
    description: 'Execute your first CLUSTER command.',
    category: 'discovery',
    rarity: 'epic',
    xp: 50,
    icon: '🌟',
    criteria: (state) => Object.keys(state.commandsByType || {}).some(k => k.startsWith('cluster')),
  },

  // MASTERY (Data type proficiency)
  {
    id: 'string-master',
    name: 'String Theorist',
    description: 'Execute 25 string commands (SET, GET, APPEND, INCR, etc.).',
    category: 'mastery',
    rarity: 'common',
    xp: 30,
    icon: '🧵',
    criteria: (state) => (state.datatypeCounts?.strings || 0) >= 25,
  },
  {
    id: 'hash-master',
    name: 'Hash Architect',
    description: 'Execute 20 hash commands (HSET, HGET, HGETALL, etc.).',
    category: 'mastery',
    rarity: 'common',
    xp: 30,
    icon: '🗂️',
    criteria: (state) => (state.datatypeCounts?.hashes || 0) >= 20,
  },
  {
    id: 'list-master',
    name: 'List Weaver',
    description: 'Execute 20 list commands (LPUSH, RPUSH, LPOP, LRANGE, etc.).',
    category: 'mastery',
    rarity: 'common',
    xp: 30,
    icon: '📋',
    criteria: (state) => (state.datatypeCounts?.lists || 0) >= 20,
  },
  {
    id: 'set-master',
    name: 'Set Theoretician',
    description: 'Execute 20 set commands (SADD, SREM, SUNION, SINTER, etc.).',
    category: 'mastery',
    rarity: 'common',
    xp: 30,
    icon: '🔘',
    criteria: (state) => (state.datatypeCounts?.sets || 0) >= 20,
  },
  {
    id: 'zset-master',
    name: 'Rank Commander',
    description: 'Execute 20 sorted set commands (ZADD, ZRANGE, ZSCORE, etc.).',
    category: 'mastery',
    rarity: 'uncommon',
    xp: 40,
    icon: '📈',
    criteria: (state) => (state.datatypeCounts?.zsets || 0) >= 20,
  },
  {
    id: 'all-datatypes',
    name: 'Polyglot',
    description: 'Use all 5 core data types at least once.',
    category: 'mastery',
    rarity: 'uncommon',
    xp: 50,
    icon: '🌈',
    criteria: (state) => {
      const types = new Set(state.datatypesUsed || [])
      return types.has('strings') && types.has('hashes') && types.has('lists') &&
             types.has('sets') && types.has('zsets')
    },
  },
  {
    id: 'ten-commands',
    name: 'Decacorn',
    description: 'Execute 10 commands total.',
    category: 'mastery',
    rarity: 'common',
    xp: 20,
    icon: '🦄',
    criteria: (state) => state.totalCommands >= 10,
  },
  {
    id: 'hundred-commands',
    name: 'Centurion',
    description: 'Execute 100 commands total.',
    category: 'mastery',
    rarity: 'uncommon',
    xp: 75,
    icon: '💯',
    criteria: (state) => state.totalCommands >= 100,
  },
  {
    id: 'thousand-commands',
    name: 'Kilo-Commander',
    description: 'Execute 1,000 commands total.',
    category: 'mastery',
    rarity: 'rare',
    xp: 200,
    icon: '🔥',
    criteria: (state) => state.totalCommands >= 1000,
  },
  {
    id: 'pipeline-master',
    name: 'Pipeline Pro',
    description: 'Use MULTI/EXEC to batch 10+ commands in a single transaction.',
    category: 'mastery',
    rarity: 'uncommon',
    xp: 50,
    icon: '🚀',
    criteria: (state) => state.maxTransactionSize >= 10,
  },
  {
    id: 'lua-master',
    name: 'Lua Alchemist',
    description: 'Run 10 Lua scripts (EVAL or EVALSHA).',
    category: 'mastery',
    rarity: 'rare',
    xp: 100,
    icon: '⚗️',
    criteria: (state) => (state.commandsByType?.eval || 0) + (state.commandsByType?.evalsha || 0) >= 10,
  },

  // BOSS (Boss battle achievements)
  {
    id: 'boss-defeated',
    name: 'Serpent Slayer',
    description: 'Defeat the NEON SERPENT boss.',
    category: 'boss',
    rarity: 'uncommon',
    xp: 100,
    icon: '🐍',
    criteria: (state) => state.bossHistory?.some(b => b.name === 'NEON SERPENT' && b.won),
  },
  {
    id: 'boss-flawless',
    name: 'Flawless Victory',
    description: 'Defeat a boss without taking any damage (no wrong commands).',
    category: 'boss',
    rarity: 'rare',
    xp: 150,
    icon: '💎',
    criteria: (state) => state.bossHistory?.some(b => b.won && b.wrongCommands === 0),
  },
  {
    id: 'boss-speedrun',
    name: 'Speed Demon',
    description: 'Defeat the NEON SERPENT in under 60 seconds.',
    category: 'boss',
    rarity: 'epic',
    xp: 200,
    icon: '⚡',
    criteria: (state) => state.bossHistory?.some(b => b.name === 'NEON SERPENT' && b.won && b.durationMs < 60000),
  },
  {
    id: 'boss-all-challenges',
    name: 'Completionist',
    description: 'Solve every challenge in a boss battle.',
    category: 'boss',
    rarity: 'rare',
    xp: 100,
    icon: '✨',
    criteria: (state) => state.bossHistory?.some(b => b.won && b.challengesSolved === b.totalChallenges),
  },

  // EXPLORATION (Region/map progress)
  {
    id: 'region-3',
    name: 'Explorer',
    description: 'Unlock 3 regions.',
    category: 'exploration',
    rarity: 'common',
    xp: 50,
    icon: '🗺️',
    criteria: (state) => Object.keys(state.unlockedRegions || {}).length >= 3,
  },
  {
    id: 'region-6',
    name: 'Cartographer',
    description: 'Unlock 6 regions.',
    category: 'exploration',
    rarity: 'uncommon',
    xp: 100,
    icon: '🧭',
    criteria: (state) => Object.keys(state.unlockedRegions || {}).length >= 6,
  },
  {
    id: 'region-all',
    name: 'World Walker',
    description: 'Unlock all 12 regions.',
    category: 'exploration',
    rarity: 'legendary',
    xp: 500,
    icon: '🌍',
    criteria: (state) => Object.keys(state.unlockedRegions || {}).length >= 12,
  },
  {
    id: 'skill-10',
    name: 'Skill Seeker',
    description: 'Unlock 10 skills.',
    category: 'exploration',
    rarity: 'common',
    xp: 50,
    icon: '⭐',
    criteria: (state) => Object.keys(state.unlockedSkills || {}).length >= 10,
  },
  {
    id: 'skill-30',
    name: 'Skill Collector',
    description: 'Unlock 30 skills.',
    category: 'exploration',
    rarity: 'uncommon',
    xp: 150,
    icon: '🌟',
    criteria: (state) => Object.keys(state.unlockedSkills || {}).length >= 30,
  },
  {
    id: 'skill-all',
    name: 'Grandmaster',
    description: 'Unlock all 60 skills.',
    category: 'exploration',
    rarity: 'legendary',
    xp: 1000,
    icon: '👑',
    criteria: (state) => Object.keys(state.unlockedSkills || {}).length >= 60,
  },
  {
    id: 'fast-travel',
    name: 'Teleporter',
    description: 'Use fast travel 5 times.',
    category: 'exploration',
    rarity: 'uncommon',
    xp: 50,
    icon: '⚡',
    criteria: (state) => (state.fastTravelCount || 0) >= 5,
  },

  // META (Special/fun achievements)
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Play between midnight and 5 AM.',
    category: 'meta',
    rarity: 'uncommon',
    xp: 25,
    icon: '🦉',
    criteria: (state) => {
      const hour = new Date().getHours()
      return hour >= 0 && hour < 5
    },
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Play between 5 AM and 8 AM.',
    category: 'meta',
    rarity: 'uncommon',
    xp: 25,
    icon: '🐦',
    criteria: (state) => {
      const hour = new Date().getHours()
      return hour >= 5 && hour < 8
    },
  },
  {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    description: 'Play on a Saturday or Sunday.',
    category: 'meta',
    rarity: 'common',
    xp: 15,
    icon: '🏖️',
    criteria: (state) => {
      const day = new Date().getDay()
      return day === 0 || day === 6
    },
  },
  {
    id: 'comeback-kid',
    name: 'Comeback Kid',
    description: 'Load a save file that is at least 7 days old.',
    category: 'meta',
    rarity: 'rare',
    xp: 100,
    icon: '🔙',
    criteria: (state) => state.saveAgeDays >= 7,
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete the game with 0 errors (Pro mode only).',
    category: 'meta',
    rarity: 'legendary',
    xp: 500,
    icon: '💯',
    criteria: (state) => state.mode === 'pro' && state.totalErrors === 0 && state.totalCommands > 100,
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Defeat the boss using only 5 unique commands.',
    category: 'meta',
    rarity: 'epic',
    xp: 200,
    icon: '🎯',
    criteria: (state) => {
      const uniqueCmds = new Set(Object.keys(state.commandsByType || {}))
      return state.bossHistory?.some(b => b.won && uniqueCmds.size <= 5)
    },
  },
]

// Rarity colors for UI
export const RARITY_COLORS = {
  common: '#64748b',     // dim
  uncommon: '#22d3ee',   // cyan
  rare: '#a78bfa',       // purple
  epic: '#fbbf24',       // amber
  legendary: '#fb7185',  // red
}

export const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
}

export const CATEGORY_LABELS = {
  discovery: 'Discovery',
  mastery: 'Mastery',
  boss: 'Boss',
  exploration: 'Exploration',
  meta: 'Meta',
}

export const CATEGORY_ICONS = {
  discovery: '🔍',
  mastery: '🏆',
  boss: '👑',
  exploration: '🗺️',
  meta: '✨',
}