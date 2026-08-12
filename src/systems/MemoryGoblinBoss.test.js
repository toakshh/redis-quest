import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEngine } from '../engine/engine.js'
import { useGameStore } from '../store/gameStore.js'
import { MemoryGoblinBoss, GOBLIN_PHASES, createMemoryGoblinBoss } from './MemoryGoblinBoss.js'

let engine
let store

beforeEach(() => {
  useGameStore.getState().resetGame()
  engine = createEngine()
  store = useGameStore.getState()
  store.bindEngine(engine)
})

afterEach(() => {
  useGameStore.getState().resetGame()
})

describe('MemoryGoblinBoss phase definitions', () => {
  it('defines three phases with correct structure', () => {
    expect(GOBLIN_PHASES[1]).toBeTruthy()
    expect(GOBLIN_PHASES[2]).toBeTruthy()
    expect(GOBLIN_PHASES[3]).toBeTruthy()
    expect(GOBLIN_PHASES[1].name).toBe('Hoarding')
    expect(GOBLIN_PHASES[2].name).toBe('Pressure')
    expect(GOBLIN_PHASES[3].name).toBe('Finale - Memory Leak')
  })

  it('each phase has required properties', () => {
    for (const [num, phase] of Object.entries(GOBLIN_PHASES)) {
      expect(phase.maxHealth).toBeGreaterThan(0)
      expect(phase.damagePerPlayerAction).toBeGreaterThan(0)
      expect(phase.goblinActionIntervalMs).toBeGreaterThan(0)
      expect(phase.goblinAction).toBeTruthy()
      expect(phase.playerGoal).toBeTruthy()
      expect(phase.xpReward).toBeGreaterThan(0)
    }
  })
})

describe('MemoryGoblinBoss basic lifecycle', () => {
  it('creates a boss instance', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    expect(boss).toBeInstanceOf(MemoryGoblinBoss)
    expect(boss.getState().phase).toBe(0)
    expect(boss.getState().isActive).toBe(false)
  })

  it('starts at phase 1 with correct health', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    const callbacks = {
      onPhaseChange: vi.fn(),
      onHealthChange: vi.fn(),
      onMessage: vi.fn(),
      onDefeated: vi.fn(),
    }
    boss.start(callbacks)

    const state = boss.getState()
    expect(state.phase).toBe(1)
    expect(state.phaseName).toBe('Hoarding')
    expect(state.health).toBe(GOBLIN_PHASES[1].maxHealth)
    expect(state.maxHealth).toBe(GOBLIN_PHASES[1].maxHealth)
    expect(state.isActive).toBe(true)
    expect(callbacks.onPhaseChange).toHaveBeenCalled()
  })

  it('destroys cleanly', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    boss.start({})
    boss.destroy()
    expect(boss.getState().isActive).toBe(false)
    expect(boss.getState().phase).toBe(0)
  })
})

describe('Phase 1 - Hoarding', () => {
  it('tracks player SET commands on player prefix', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    boss.start({})

    // Player sets 3 keys with player prefix
    engine.rawExecute('SET', 'player:memory:1', 'real')
    const r1 = boss.handlePlayerCommand('SET', ['SET', 'player:memory:1', 'real'], { type: 'simple', value: 'OK' })
    expect(r1.damage).toBe(15)

    engine.rawExecute('SET', 'player:memory:2', 'real')
    const r2 = boss.handlePlayerCommand('SET', ['SET', 'player:memory:2', 'real'], { type: 'simple', value: 'OK' })
    expect(r2.damage).toBe(15)

    // Non-player keys don't count
    engine.rawExecute('SET', 'other:key', 'value')
    const r3 = boss.handlePlayerCommand('SET', ['SET', 'other:key', 'value'], { type: 'simple', value: 'OK' })
    expect(r3.damage).toBe(0)

    // Error replies don't count
    const r4 = boss.handlePlayerCommand('SET', ['SET', 'player:memory:3', 'real'], { type: 'error', value: 'ERR' })
    expect(r4.damage).toBe(0)
  })

  it('completes phase 1 after 5 player keys', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    const onPhaseChange = vi.fn()
    boss.start({ onPhaseChange })

    for (let i = 1; i <= 5; i++) {
      engine.rawExecute('SET', `player:memory:${i}`, 'real')
      boss.handlePlayerCommand('SET', ['SET', `player:memory:${i}`, 'real'], { type: 'simple', value: 'OK' })
    }

    // Should have triggered phase complete -> advance to phase 2
    // Wait a bit for the async phase transition (skipDelay: true makes it immediate)
    return new Promise((resolve) => {
      setTimeout(() => {
        const state = boss.getState()
        expect(state.phase).toBe(2)
        expect(onPhaseChange).toHaveBeenCalledTimes(2) // phase 1 start + phase 2 start
        resolve()
      }, 100)
    })
  })
})

describe('Phase 2 - Pressure', () => {
  it('tracks EXPIRE/TTL on tracked keys', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    boss.start({})

    // Advance to phase 2 manually for testing
    boss.phase = 2
    boss._enterPhase(2)

    const state = boss.getState()
    expect(state.phase).toBe(2)
    expect(state.keysToKeepAlive.length).toBe(3)

    // EXPIRE on a tracked key deals damage
    const key = state.keysToKeepAlive[0]
    const r1 = boss.handlePlayerCommand('EXPIRE', ['EXPIRE', key, '30'], { type: 'integer', value: 1 })
    expect(r1.damage).toBe(12)

    // TTL on a tracked key also deals damage
    const r2 = boss.handlePlayerCommand('TTL', ['TTL', key], { type: 'integer', value: 25 })
    expect(r2.damage).toBe(12)

    // Commands on untracked keys don't count
    const r3 = boss.handlePlayerCommand('EXPIRE', ['EXPIRE', 'other:key', '30'], { type: 'integer', value: 1 })
    expect(r3.damage).toBe(0)
  })
})

describe('Phase 3 - Finale', () => {
  it('FLUSHDB defeats the boss instantly', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    const onDefeated = vi.fn()
    boss.start({ onDefeated })

    // Advance to phase 3
    boss.phase = 3
    boss._enterPhase(3)

    const result = boss.handlePlayerCommand('FLUSHDB', ['FLUSHDB'], { type: 'simple', value: 'OK' })
    expect(result.defeated).toBe(true)
    expect(result.damage).toBe(20)
    expect(onDefeated).toHaveBeenCalled()
  })

  it('other commands in phase 3 do not defeat boss', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    boss.start({})

    boss.phase = 3
    boss._enterPhase(3)

    const result = boss.handlePlayerCommand('SET', ['SET', 'key', 'value'], { type: 'simple', value: 'OK' })
    expect(result.defeated).toBe(false)
    expect(result.damage).toBe(0)
  })
})

describe('Goblin autonomous actions', () => {
  it('phase 1 spawns fake memories via silentExecute', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    boss.start({})

    const initialCount = engine.rawExecute('KEYS', 'goblin:fake:*').value.length
    boss._spawnFakeMemory()
    const afterCount = engine.rawExecute('KEYS', 'goblin:fake:*').value.length
    expect(afterCount).toBe(initialCount + 1)
  })

  it('phase 2 drains TTL on tracked keys', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    boss.start({})

    boss.phase = 2
    boss._enterPhase(2)

    const key = boss.getState().keysToKeepAlive[0]
    const ttlBefore = engine.rawExecute('TTL', key).value
    boss._drainTTL()
    const ttlAfter = engine.rawExecute('TTL', key).value
    // TTL should be reduced (set to 5 by goblin action)
    expect(ttlAfter).toBeLessThanOrEqual(5)
  })

  it('phase 3 leaks corruption memories', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    boss.start({})

    boss.phase = 3
    boss._enterPhase(3)

    const initialCount = engine.rawExecute('KEYS', 'leak:corruption:*').value.length
    boss._leakMemory()
    const afterCount = engine.rawExecute('KEYS', 'leak:corruption:*').value.length
    expect(afterCount).toBeGreaterThan(initialCount)
  })
})

describe('Phase fail conditions', () => {
  it('phase 1 fails when goblin fills 8 slots', () => {
    const boss = createMemoryGoblinBoss(engine, store)
    const onMessage = vi.fn()
    boss.start({ onMessage })

    // Fill 8 fake memories via goblin action
    for (let i = 0; i < 8; i++) {
      boss._goblinAct()
    }

    // Should trigger phase fail message
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'phase-fail', phase: 1 })
    )
  })
})