import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTutorialEngine, HINT_LEVELS } from '../src/systems/TutorialEngine.js'
import { createEventBus } from '../src/systems/EventBus.js'

describe('TutorialEngine', () => {
  let engine
  let eventBus
  let events

  beforeEach(() => {
    events = {}
    eventBus = createEventBus()
    // Capture all events
    eventBus.on('tutorial:started', (e) => { events.started = e })
    eventBus.on('tutorial:stepStarted', (e) => { events.stepStarted = e })
    eventBus.on('tutorial:stepCompleted', (e) => { events.stepCompleted = e })
    eventBus.on('tutorial:completed', (e) => { events.completed = e })
    eventBus.on('tutorial:skipped', (e) => { events.skipped = e })
    eventBus.on('tutorial:hintRequested', (e) => { events.hintRequested = e })

    engine = createTutorialEngine({ eventBus, now: () => 1000000 })
  })

  describe('getTutorial', () => {
    it('returns tutorial by id', () => {
      const t = engine.getTutorial('mv-set-get')
      expect(t).toBeTruthy()
      expect(t.id).toBe('mv-set-get')
      expect(t.title).toBe('Store and Recall')
    })

    it('returns null for unknown id', () => {
      expect(engine.getTutorial('unknown')).toBeNull()
    })
  })

  describe('getTutorialsForRegion', () => {
    it('returns tutorials for memory-village', () => {
      const tuts = engine.getTutorialsForRegion('memory-village')
      expect(tuts.length).toBeGreaterThan(0)
      for (const t of tuts) {
        expect(t.region).toBe('memory-village')
      }
    })

    it('returns empty array for unknown region', () => {
      expect(engine.getTutorialsForRegion('unknown')).toEqual([])
    })
  })

  describe('getNextTutorial', () => {
    it('returns first incomplete tutorial for region', () => {
      const next = engine.getNextTutorial('memory-village')
      expect(next).toBeTruthy()
      expect(next.id).toBe('mv-set-get')
    })

    it('returns null when all completed', () => {
      // Complete all tutorials for region
      const tuts = engine.getTutorialsForRegion('memory-village')
      for (const t of tuts) {
        engine.startTutorial(t.id)
        // Complete all steps
        while (engine.getState().currentTutorial) {
          const step = engine.getState().currentTutorial.steps[engine.getState().currentTutorial.steps.length - 1]
          // Simulate completing by using a valid command
          const cmd = step.validate.command
          const key = step.validate.keyPattern
          const input = `${cmd} ${key} test`
          engine.validateStep(input)
        }
      }
      expect(engine.getNextTutorial('memory-village')).toBeNull()
    })

    it('skips skipped tutorials', () => {
      engine.startTutorial('mv-set-get')
      engine.skipTutorial()
      const next = engine.getNextTutorial('memory-village')
      expect(next.id).not.toBe('mv-set-get')
    })
  })

  describe('startTutorial', () => {
    it('starts tutorial and emits started event', () => {
      const result = engine.startTutorial('mv-set-get')
      expect(result.success).toBe(true)
      expect(events.started).toBeTruthy()
      expect(events.started.tutorialId).toBe('mv-set-get')
      expect(events.started.region).toBe('memory-village')
    })

    it('emits stepStarted for first step', () => {
      engine.startTutorial('mv-set-get')
      expect(events.stepStarted).toBeTruthy()
      expect(events.stepStarted.stepId).toBe('set-name')
      expect(events.stepStarted.objective).toContain('SET player_name')
    })

    it('returns error for unknown tutorial', () => {
      const result = engine.startTutorial('unknown')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('not found')
    })

    it('returns error for already completed', () => {
      engine.startTutorial('mv-set-get')
      engine.validateStep('SET player_name "Alex"')
      engine.validateStep('GET player_name')
      // Now completed
      const result = engine.startTutorial('mv-set-get')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('already completed')
    })

    it('returns error for already skipped', () => {
      engine.startTutorial('mv-set-get')
      engine.skipTutorial()
      const result = engine.startTutorial('mv-set-get')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('already skipped')
    })
  })

  describe('validateStep', () => {
    beforeEach(() => {
      engine.startTutorial('mv-set-get')
      events.stepCompleted = null
    })

    it('validates correct command with key pattern', () => {
      const result = engine.validateStep('SET player_name "Alex"')
      expect(result.valid).toBe(true)
      expect(events.stepCompleted).toBeTruthy()
      expect(events.stepCompleted.stepId).toBe('set-name')
      expect(events.stepCompleted.explanation).toContain('labeling a box')
      expect(events.stepCompleted.reward.xp).toBe(5)
    })

    it('rejects wrong command', () => {
      const result = engine.validateStep('GET player_name')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('expected command SET')
    })

    it('rejects missing key pattern', () => {
      const result = engine.validateStep('SET other_name "Alex"')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('expected key matching player_name')
    })

    it('advances to next step on success', () => {
      engine.validateStep('SET player_name "Alex"')
      expect(engine.getState().currentTutorial).toBeTruthy()
      expect(engine.getState().currentStepIndex).toBe(1)
      expect(events.stepStarted.stepId).toBe('get-name')
    })

    it('completes tutorial after last step', () => {
      engine.validateStep('SET player_name "Alex"')
      events.stepCompleted = null
      events.completed = null
      engine.validateStep('GET player_name')
      expect(events.completed).toBeTruthy()
      expect(events.completed.tutorialId).toBe('mv-set-get')
      expect(events.completed.totalXp).toBe(10)
      expect(engine.getState().currentTutorial).toBeNull()
    })

    it('handles quoted strings correctly', () => {
      const result = engine.validateStep('SET player_name "Alex"')
      expect(result.valid).toBe(true)
    })

    it('handles single quotes', () => {
      const result = engine.validateStep("SET player_name 'Alex'")
      expect(result.valid).toBe(true)
    })

    it('rejects empty input', () => {
      const result = engine.validateStep('')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('empty')
    })

    it('returns no active tutorial when none started', () => {
      const engine2 = createTutorialEngine({ eventBus: createEventBus() })
      const result = engine2.validateStep('SET foo bar')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('no active tutorial')
    })
  })

  describe('skipTutorial', () => {
    it('skips current tutorial', () => {
      engine.startTutorial('mv-set-get')
      const result = engine.skipTutorial()
      expect(result.success).toBe(true)
      expect(events.skipped).toBeTruthy()
      expect(events.skipped.tutorialId).toBe('mv-set-get')
      expect(engine.getState().currentTutorial).toBeNull()
    })

    it('returns error when no active tutorial', () => {
      const result = engine.skipTutorial()
      expect(result.success).toBe(false)
      expect(result.reason).toBe('no active tutorial')
    })

    it('marks tutorial as skipped', () => {
      engine.startTutorial('mv-set-get')
      engine.skipTutorial()
      expect(engine.isSkipped('mv-set-get')).toBe(true)
      expect(engine.isCompleted('mv-set-get')).toBe(false)
    })
  })

  describe('requestHint', () => {
    it('returns hint for current step', () => {
      engine.startTutorial('mv-set-get')
      const result = engine.requestHint(HINT_LEVELS.NUDGE)
      expect(result.success).toBe(true)
      expect(result.hint).toContain('SET player_name')
      expect(result.level).toBe(HINT_LEVELS.NUDGE)
      expect(events.hintRequested).toBeTruthy()
    })

    it('returns error when no active tutorial', () => {
      const result = engine.requestHint()
      expect(result.success).toBe(false)
      expect(result.reason).toBe('no active tutorial')
    })
  })

  describe('getState', () => {
    it('returns null when no tutorial active', () => {
      const state = engine.getState()
      expect(state.currentTutorial).toBeNull()
      expect(state.completedTutorials).toEqual([])
      expect(state.skippedTutorials).toEqual([])
    })

    it('returns current tutorial info', () => {
      engine.startTutorial('mv-set-get')
      const state = engine.getState()
      expect(state.currentTutorial).toBeTruthy()
      expect(state.currentTutorial.id).toBe('mv-set-get')
      expect(state.currentTutorial.title).toBe('Store and Recall')
      expect(state.currentTutorial.region).toBe('memory-village')
      expect(state.currentTutorial.stepIndex).toBe(0)
      expect(state.currentTutorial.totalSteps).toBe(2)
    })

    it('tracks completed tutorials', () => {
      engine.startTutorial('mv-set-get')
      engine.validateStep('SET player_name "Alex"')
      engine.validateStep('GET player_name')
      const state = engine.getState()
      expect(state.completedTutorials).toContain('mv-set-get')
    })

    it('tracks skipped tutorials', () => {
      engine.startTutorial('mv-set-get')
      engine.skipTutorial()
      const state = engine.getState()
      expect(state.skippedTutorials).toContain('mv-set-get')
    })
  })

  describe('isCompleted / isSkipped', () => {
    it('returns false initially', () => {
      expect(engine.isCompleted('mv-set-get')).toBe(false)
      expect(engine.isSkipped('mv-set-get')).toBe(false)
    })

    it('returns true after completion', () => {
      engine.startTutorial('mv-set-get')
      engine.validateStep('SET player_name "Alex"')
      engine.validateStep('GET player_name')
      expect(engine.isCompleted('mv-set-get')).toBe(true)
    })

    it('returns true after skip', () => {
      engine.startTutorial('mv-set-get')
      engine.skipTutorial()
      expect(engine.isSkipped('mv-set-get')).toBe(true)
    })
  })

  describe('reset', () => {
    it('clears all progress', () => {
      engine.startTutorial('mv-set-get')
      engine.validateStep('SET player_name "Alex"')
      engine.validateStep('GET player_name')
      engine.startTutorial('mv-incr-decr')
      engine.skipTutorial()

      engine.reset()

      expect(engine.getState().currentTutorial).toBeNull()
      expect(engine.getState().completedTutorials).toEqual([])
      expect(engine.getState().skippedTutorials).toEqual([])
    })
  })

  describe('serialize/hydrate', () => {
    it('preserves completed and skipped', () => {
      engine.startTutorial('mv-set-get')
      engine.validateStep('SET player_name "Alex"')
      engine.validateStep('GET player_name')
      engine.startTutorial('mv-incr-decr')
      engine.skipTutorial()

      const saved = engine.serialize()
      expect(saved.completedTutorials).toContain('mv-set-get')
      expect(saved.skippedTutorials).toContain('mv-incr-decr')

      const engine2 = createTutorialEngine({ eventBus: createEventBus() })
      engine2.hydrate(saved)

      expect(engine2.isCompleted('mv-set-get')).toBe(true)
      expect(engine2.isSkipped('mv-incr-decr')).toBe(true)
    })
  })

  describe('Multiple tutorials per region', () => {
    it('memory-village has 4 tutorials', () => {
      const tuts = engine.getTutorialsForRegion('memory-village')
      expect(tuts.length).toBe(4)
    })

    it('hash-city has 1 tutorial', () => {
      const tuts = engine.getTutorialsForRegion('hash-city')
      expect(tuts.length).toBe(1)
      expect(tuts[0].id).toBe('mv-hash-basics')
    })

    it('list-harbor has 1 tutorial', () => {
      const tuts = engine.getTutorialsForRegion('list-harbor')
      expect(tuts.length).toBe(1)
      expect(tuts[0].id).toBe('mv-list-basics')
    })

    it('set-caverns has 1 tutorial', () => {
      const tuts = engine.getTutorialsForRegion('set-caverns')
      expect(tuts.length).toBe(1)
      expect(tuts[0].id).toBe('mv-set-basics')
    })

    it('leaderboard-arena has 1 tutorial', () => {
      const tuts = engine.getTutorialsForRegion('leaderboard-arena')
      expect(tuts.length).toBe(1)
      expect(tuts[0].id).toBe('mv-zset-basics')
    })
  })

  describe('Tutorial step validation details', () => {
    it('mv-incr-decr validates INCR/DECR', () => {
      engine.startTutorial('mv-incr-decr')
      engine.validateStep('SET score 0')
      engine.validateStep('INCR score')
      const result = engine.validateStep('DECR score')
      expect(result.valid).toBe(true)
    })

    it('mv-expire-ttl validates EXPIRE/TTL', () => {
      engine.startTutorial('mv-expire-ttl')
      engine.validateStep('SET torch lit')
      engine.validateStep('EXPIRE torch 60')
      const result = engine.validateStep('TTL torch')
      expect(result.valid).toBe(true)
    })

    it('mv-del-exists validates EXISTS/DEL', () => {
      engine.startTutorial('mv-del-exists')
      engine.validateStep('SET temp hello')
      engine.validateStep('EXISTS temp')
      const result = engine.validateStep('DEL temp')
      expect(result.valid).toBe(true)
    })

    it('mv-hash-basics validates HSET/HGET/HGETALL', () => {
      engine.startTutorial('mv-hash-basics')
      engine.validateStep('HSET hero:1 name Alex hp 100')
      engine.validateStep('HGET hero:1 hp')
      const result = engine.validateStep('HGETALL hero:1')
      expect(result.valid).toBe(true)
    })

    it('mv-list-basics validates LPUSH/RPUSH/LRANGE', () => {
      engine.startTutorial('mv-list-basics')
      engine.validateStep('LPUSH enemies Goblin')
      engine.validateStep('RPUSH enemies Dragon')
      const result = engine.validateStep('LRANGE enemies 0 -1')
      expect(result.valid).toBe(true)
    })

    it('mv-set-basics validates SADD/SMEMBERS', () => {
      engine.startTutorial('mv-set-basics')
      engine.validateStep('SADD party Mage Warrior')
      const result = engine.validateStep('SMEMBERS party')
      expect(result.valid).toBe(true)
    })

    it('mv-zset-basics validates ZADD/ZRANGE', () => {
      engine.startTutorial('mv-zset-basics')
      engine.validateStep('ZADD scores 100 Alex')
      const result = engine.validateStep('ZRANGE scores 0 -1')
      expect(result.valid).toBe(true)
    })
  })
})