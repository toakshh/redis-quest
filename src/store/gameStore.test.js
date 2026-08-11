// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createEngine } from '../engine/engine.js'
import { useGameStore, levelInfo, ACHIEVEMENTS } from './gameStore.js'

let engine

beforeEach(() => {
  useGameStore.getState().resetGame()
  engine = createEngine()
  useGameStore.getState().bindEngine(engine)
})

afterEach(() => {
  useGameStore.getState().resetGame()
})

describe('levelInfo', () => {
  it('derives level and progress from XP', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForNext: 100 })
    expect(levelInfo(100)).toMatchObject({ level: 2, xpIntoLevel: 0 })
    expect(levelInfo(250)).toMatchObject({ level: 3, xpIntoLevel: 50 })
  })
})

describe('command tracking + achievements', () => {
  it('unlocks First Blood on the first command via runCommand', () => {
    useGameStore.getState().runCommand('SET name Ada')
    const s = useGameStore.getState()
    expect(s.totalCommands).toBe(1)
    expect(s.unlocked['first-command']).toBeTruthy()
    expect(s.datatypesUsed).toContain('strings')
  })

  it('tracks datatypes and unlocks masters + Polyglot across all five types', () => {
    const run = useGameStore.getState().runCommand
    run('SET s v')
    run('HSET h f v')
    run('RPUSH l a b')
    run('SADD set a b')
    run('ZADD z 1 m')
    const s = useGameStore.getState()
    expect(new Set(s.datatypesUsed)).toEqual(
      new Set(['strings', 'hashes', 'lists', 'sets', 'zsets']),
    )
    expect(s.unlocked['string-master']).toBeTruthy()
    expect(s.unlocked['hash-master']).toBeTruthy()
    expect(s.unlocked['list-master']).toBeTruthy()
    expect(s.unlocked['set-master']).toBeTruthy()
    expect(s.unlocked['zset-master']).toBeTruthy()
    expect(s.unlocked['all-datatypes']).toBeTruthy()
  })

  it('unlocks 10 commands after enough commands', () => {
    const run = useGameStore.getState().runCommand
    for (let i = 0; i < 10; i++) run(`SET k${i} v${i}`)
    expect(useGameStore.getState().unlocked['ten-commands']).toBeTruthy()
  })

  it('unlockAchievement awards XP and pushes a toast; dismiss removes it', () => {
    const store = useGameStore.getState()
    const xpBefore = store.xp
    store.unlockAchievement('string-master')
    let s = useGameStore.getState()
    expect(s.toasts.map((t) => t.id)).toContain('string-master')
    expect(s.xp).toBe(xpBefore + ACHIEVEMENTS.find((a) => a.id === 'string-master').xp)

    // unlocking the same id again is a no-op
    useGameStore.getState().unlockAchievement('string-master')
    s = useGameStore.getState()
    expect(s.toasts.filter((t) => t.id === 'string-master')).toHaveLength(1)

    useGameStore.getState().dismissToast('string-master')
    expect(useGameStore.getState().toasts).toEqual([])
  })
})

describe('boss battle', () => {
  it('deals no damage until the objective is actually solved', () => {
    useGameStore.getState().startBattle()
    const run = useGameStore.getState().runCommand
    // wrong key -> challenge 0 (quest:start) unsolved
    run('SET wrong begun')
    expect(useGameStore.getState().boss.health).toBe(100)
    // correct key + value
    run('SET quest:start begun')
    expect(useGameStore.getState().boss.health).toBe(82)
    expect(useGameStore.getState().boss.challengeIndex).toBe(1)
  })

  it('reports shield feedback on an erroring command', () => {
    useGameStore.getState().startBattle()
    const reply = useGameStore.getState().runCommand('NOTACOMMAND')
    expect(reply.type).toBe('error')
    const { boss } = useGameStore.getState()
    expect(boss.lastResult.ok).toBe(false)
    expect(boss.health).toBe(100)
  })

  it('dismantles the serpent by solving every objective', () => {
    useGameStore.getState().startBattle()
    const run = useGameStore.getState().runCommand
    run('SET quest:start begun')
    run('HSET quest:map north 1 east 2 south 3')
    run('RPUSH quest:trail alpha beta')
    run('SADD quest:tokens red green blue')
    run('ZADD quest:ranks 1 alpha 2 beta')
    expect(useGameStore.getState().boss.health).toBe(10)
    expect(useGameStore.getState().boss.defeated).toBe(false)

    // beacon needs both the value AND an expiry
    run('SET quest:beacon on')
    expect(useGameStore.getState().boss.health).toBe(10)
    run('EXPIRE quest:beacon 60')
    const s = useGameStore.getState()
    expect(s.boss.defeated).toBe(true)
    expect(s.boss.health).toBe(0)
    expect(s.unlocked['boss-defeated']).toBeTruthy()
    expect(s.bossHistory.some((b) => b.name === 'NEON SERPENT' && b.won)).toBe(true)
  })

  it('awarded XP rewards the player and feeds level progression', () => {
    useGameStore.getState().startBattle()
    const run = useGameStore.getState().runCommand
    run('SET quest:start begun')
    const s = useGameStore.getState()
    // command XP (base 10 * 1.5 + first-use 10 * 1.5 = 30) + challenge xp (15) + first-command xp (10) + string-master xp (10)
    expect(s.xp).toBe(65)
    expect(levelInfo(s.xp).level).toBe(1)
  })

  it('handles the event-driven path (rawExecute) just like the terminal', () => {
    useGameStore.getState().startBattle()
    engine.rawExecute('SET', 'quest:start', 'begun')
    expect(useGameStore.getState().boss.health).toBe(82)
  })

  it('resetGame clears all game state', () => {
    const run = useGameStore.getState().runCommand
    run('SET x y')
    useGameStore.getState().startBattle()
    useGameStore.getState().resetGame()
    const s = useGameStore.getState()
    expect(s.totalCommands).toBe(0)
    expect(s.unlocked).toEqual({})
    expect(s.toasts).toEqual([])
    expect(s.boss).toBeNull()
    expect(s.xp).toBe(0)
  })
})
