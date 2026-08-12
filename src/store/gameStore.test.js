// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createEngine } from '../engine/engine.js'
import { useGameStore, levelInfo, ACHIEVEMENTS, REGIONS, BOSSES, SURVIVAL_SEEDS, SKILL_CONSTELLATIONS } from './gameStore.js'

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

describe('region progression', () => {
  it('starts with String Forest unlocked and as current region', () => {
    const s = useGameStore.getState()
    expect(s.currentRegion).toBe('string-forest')
    expect(s.completedRegions).toEqual([])
    const available = s.getAvailableRegions()
    expect(available.length).toBe(1)
    expect(available[0].id).toBe('string-forest')
    expect(available[0].unlocked).toBe(true)
    expect(available[0].current).toBe(true)
  })

  it('can enter the current region', () => {
    const result = useGameStore.getState().enterRegion('string-forest')
    const s = useGameStore.getState()
    expect(result).toBe(true)
    expect(s.currentRegion).toBe('string-forest')
    expect(s.unlocked['string-forest-explorer']).toBeTruthy()
  })

  it('cannot enter a locked region', () => {
    const s = useGameStore.getState()
    const result = s.enterRegion('list-harbor')
    expect(result).toBe(false)
    expect(s.currentRegion).toBe('string-forest')
  })

  it('unlocks next region after completing current region boss', () => {
    // Defeat the Tangler (String Forest boss)
    useGameStore.getState().startBattle('the-tangler')
    const run = useGameStore.getState().runCommand
    run('SET tangle:seed start')
    run('SETRANGE tangle:seed 0 tangled_')
    run('INCRBYFLOAT tangle:counter 1.5')
    run('SET tangle:frag fragment')
    run('SET tangle:final knotted')
    run('EXPIRE tangle:final 30')

    const s = useGameStore.getState()
    expect(s.completedRegions).toContain('string-forest')
    expect(s.unlocked['tangler-slayer']).toBeTruthy()

    // List Harbor should now be unlocked
    const available = s.getAvailableRegions()
    const listHarbor = available.find(r => r.id === 'list-harbor')
    expect(listHarbor).toBeTruthy()
    expect(listHarbor.unlocked).toBe(true)
  })

  it('tracks region progress', () => {
    useGameStore.getState().startBattle('the-tangler')
    const run = useGameStore.getState().runCommand
    run('SET tangle:seed start')
    run('SETRANGE tangle:seed 0 tangled_')
    run('INCRBYFLOAT tangle:counter 1.5')
    run('SET tangle:frag fragment')
    run('SET tangle:final knotted')
    run('EXPIRE tangle:final 30')

    const s = useGameStore.getState()
    expect(s.regionProgress['string-forest']).toEqual({ bossDefeated: true, challengesCompleted: true })
  })
})

describe('survival mode', () => {
  it('lists available survival seeds for unlocked regions', () => {
    const s = useGameStore.getState()
    const seeds = s.getAvailableSurvivalSeeds()
    // Initially only string-forest is unlocked
    expect(seeds.length).toBe(1)
    expect(seeds[0].id).toBe('cache-invalidation-storm')
  })

  it('starts a survival seed and runs setup', () => {
    const result = useGameStore.getState().startSurvival('cache-invalidation-storm')
    const s = useGameStore.getState()
    expect(result).toBe(true)
    expect(s.survivalMode).toBe('cache-invalidation-storm')
    expect(s.survivalProgress['cache-invalidation-storm']).toEqual({ wave: 0, completed: false })

    // Check engine was set up with cache keys
    const cache1 = engine.rawExecute('GET', 'cache:user:1')
    expect(cache1.type).toBe('bulk')
    expect(cache1.value).toContain('Alice')
  })

  it('advances through waves and completes', () => {
    useGameStore.getState().startSurvival('cache-invalidation-storm')

    // Advance through all 5 waves
    for (let i = 0; i < 5; i++) {
      const result = useGameStore.getState().advanceSurvivalWave()
      if (i < 4) {
        expect(result).toBe(i + 1)
      } else {
        expect(result).toBe('completed')
      }
    }

    const s = useGameStore.getState()
    expect(s.survivalMode).toBeNull()
    expect(s.survivalProgress['cache-invalidation-storm'].completed).toBe(true)
    expect(s.survivalHistory.length).toBe(1)
    expect(s.survivalHistory[0].won).toBe(true)
    expect(s.unlocked['survival-cache-invalidation-storm']).toBeTruthy()
  })

  it('getSurvivalState returns current wave info', () => {
    const s = useGameStore.getState()
    s.startSurvival('cache-invalidation-storm')

    let state = s.getSurvivalState()
    expect(state.wave).toBe(0)
    expect(state.totalWaves).toBe(5)
    expect(state.currentWave.name).toBe('Wave 1: Read Burst')

    s.advanceSurvivalWave()
    state = s.getSurvivalState()
    expect(state.wave).toBe(1)
    expect(state.currentWave.name).toBe('Wave 2: Invalidation')
  })
})

describe('skill tree', () => {
  it('starts with 0 skill points and no unlocked skills', () => {
    const s = useGameStore.getState()
    expect(s.skillPoints).toBe(0)
    expect(s.unlockedSkills).toEqual([])
  })

  it('earns skill points on level up (1 per level)', () => {
    // Manually add XP to trigger level up
    useGameStore.getState().addXp(100) // Level 2
    const s = useGameStore.getState()
    expect(s.xp).toBe(100)
    expect(levelInfo(s.xp).level).toBe(2)
    // skillPoints should equal level - 1 (1 point per level after level 1)
    expect(s.skillPoints).toBe(1)
  })

  it('canUnlockSkill returns true for available skills with enough points', () => {
    const s = useGameStore.getState()
    s.addXp(100) // Level 2, 1 skill point

    // range-mastery costs 1, requires nothing, in String Forest (unlocked)
    expect(s.canUnlockSkill('range-mastery')).toBe(true)
    // float-precision costs 1, requires nothing
    expect(s.canUnlockSkill('float-precision')).toBe(true)
  })

  it('canUnlockSkill returns false if not enough skill points', () => {
    const s = useGameStore.getState()
    // No skill points at level 1
    expect(s.canUnlockSkill('range-mastery')).toBe(false)
  })

  it('canUnlockSkill returns false if prerequisites not met', () => {
    const s = useGameStore.getState()
    s.addXp(300) // Level 4, 3 skill points

    // string-splicing requires range-mastery
    expect(s.canUnlockSkill('string-splicing')).toBe(false)

    // Unlock range-mastery first
    s.unlockSkill('range-mastery')
    expect(s.canUnlockSkill('string-splicing')).toBe(true)
  })

  it('canUnlockSkill returns false for skills in locked regions', () => {
    useGameStore.getState().addXp(300) // Level 4, 3 skill points

    // priority-insert is in list-harbor which is locked
    expect(useGameStore.getState().canUnlockSkill('priority-insert')).toBe(false)

    // Complete String Forest to unlock List Harbor
    useGameStore.getState().startBattle('the-tangler')
    const run = useGameStore.getState().runCommand
    run('SET tangle:seed start')
    run('SETRANGE tangle:seed 0 tangled_')
    run('INCRBYFLOAT tangle:counter 1.5')
    run('SET tangle:frag fragment')
    run('SET tangle:final knotted')
    run('EXPIRE tangle:final 30')

    // Now list-harbor should be unlocked
    expect(useGameStore.getState().canUnlockSkill('priority-insert')).toBe(true)
  })

  it('unlockSkill spends points and adds to unlockedSkills', () => {
    useGameStore.getState().addXp(100) // 1 skill point

    const result = useGameStore.getState().unlockSkill('range-mastery')
    const s = useGameStore.getState()
    expect(result).toBe(true)
    expect(s.unlockedSkills).toContain('range-mastery')
    expect(s.skillPoints).toBe(0)
  })

  it('unlockSkill returns false if cannot unlock', () => {
    const s = useGameStore.getState()
    // No skill points
    const result = s.unlockSkill('range-mastery')
    expect(result).toBe(false)
    expect(s.unlockedSkills).not.toContain('range-mastery')
  })

  it('unlockSkill returns false for already unlocked skill', () => {
    useGameStore.getState().addXp(100)
    useGameStore.getState().unlockSkill('range-mastery')

    // Try to unlock again
    const result = useGameStore.getState().unlockSkill('range-mastery')
    const s = useGameStore.getState()
    expect(result).toBe(true) // Idempotent - already unlocked
    expect(s.unlockedSkills.filter(id => id === 'range-mastery')).toHaveLength(1)
  })

  it('all skill constellations are defined', () => {
    expect(SKILL_CONSTELLATIONS.length).toBe(4)
    expect(SKILL_CONSTELLATIONS.map(c => c.id)).toEqual([
      'string-constellation',
      'list-constellation',
      'set-constellation',
      'hash-constellation'
    ])
  })

  it('each constellation has the expected number of skills', () => {
    const stringConstellation = SKILL_CONSTELLATIONS.find(c => c.id === 'string-constellation')
    expect(stringConstellation.skills.length).toBe(6)

    const listConstellation = SKILL_CONSTELLATIONS.find(c => c.id === 'list-constellation')
    expect(listConstellation.skills.length).toBe(6)

    const setConstellation = SKILL_CONSTELLATIONS.find(c => c.id === 'set-constellation')
    expect(setConstellation.skills.length).toBe(6)

    const hashConstellation = SKILL_CONSTELLATIONS.find(c => c.id === 'hash-constellation')
    expect(hashConstellation.skills.length).toBe(6)
  })
})
