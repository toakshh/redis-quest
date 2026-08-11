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
]

export const DEFAULT_BOSS = BOSSES[0]

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
})

export const useGameStore = create((set, get) => {
  function unlock(id) {
    const def = ACHIEVEMENTS.find((a) => a.id === id)
    if (!def || get().unlocked[id]) return
    set((s) => ({
      unlocked: { ...s.unlocked, [id]: Date.now() },
      toasts: [...s.toasts, { ...def, unlockedAt: Date.now() }],
      xp: s.xp + def.xp,
    }))
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
      xp: s.xp + xpGain,
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
    if (defeated) unlock('boss-defeated')
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
      if (amount > 0) set((s) => ({ xp: s.xp + amount }))
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
    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    },

    // Test / new-game hook: wipe all game state. Does NOT touch the engine.
    resetGame() {
      handling = false
      set(initialState())
    },
  }
})
