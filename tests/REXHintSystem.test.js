import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createREXHintSystem, HINT_LEVELS, MODE_CONFIG } from '../src/systems/REXHintSystem.js'

describe('REXHintSystem', () => {
  let system
  let now

  beforeEach(() => {
    now = 1000000
    system = createREXHintSystem({ mode: 'beginner', now: () => now })
  })

  describe('Beginner Mode', () => {
    it('starts at NUDGE level (1)', () => {
      expect(system.levelFor('test')).toBe(HINT_LEVELS.NUDGE)
    })

    it('success resets to min level', () => {
      system.onCommand('cmd1', false, now) // failure
      system.onCommand('cmd1', false, now) // failure
      expect(system.levelFor('cmd1')).toBeGreaterThan(HINT_LEVELS.NUDGE)
      system.onCommand('cmd1', true, now) // success
      expect(system.levelFor('cmd1')).toBe(HINT_LEVELS.NUDGE)
    })

    it('escalates on repeated failures', () => {
      const cfg = MODE_CONFIG.beginner
      // nudgeAtFailures = 2, so after 2 failures should escalate
      system.onCommand('cmd1', false, now)
      expect(system.levelFor('cmd1')).toBe(HINT_LEVELS.NUDGE)
      system.onCommand('cmd1', false, now)
      expect(system.levelFor('cmd1')).toBe(HINT_LEVELS.CONCEPT) // escalated to level 2
    })

    it('jumps to max on jumpToMaxFailures (3+)', () => {
      const cfg = MODE_CONFIG.beginner
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now) // 3rd failure
      expect(system.levelFor('cmd1')).toBe(cfg.maxLevel)
    })

    it('onHintShown escalates after repeatThreshold', () => {
      const cfg = MODE_CONFIG.beginner
      // Show hint twice at same level
      system.onHintShown('situation1', now)
      expect(system.levelFor('situation1')).toBe(HINT_LEVELS.NUDGE)
      system.onHintShown('situation1', now + cfg.escalationCooldownMs + 1)
      expect(system.levelFor('situation1')).toBe(HINT_LEVELS.CONCEPT)
    })

    it('onIdle triggers hint after idleThresholdMs', () => {
      const cfg = MODE_CONFIG.beginner
      system.onEnterRegion('memory-village', now)
      // Not yet idle
      expect(system.onIdle('memory-village', cfg.idleThresholdMs - 1, now)).toBeNull()
      // Idle threshold reached
      const level = system.onIdle('memory-village', cfg.idleThresholdMs, now)
      expect(level).toBe(HINT_LEVELS.NUDGE)
    })

    it('onIdle respects idleCooldownMs', () => {
      const cfg = MODE_CONFIG.beginner
      system.onEnterRegion('memory-village', now)
      system.onIdle('memory-village', cfg.idleThresholdMs, now)
      // Immediately again - should be null due to cooldown
      expect(system.onIdle('memory-village', cfg.idleThresholdMs, now + 1)).toBeNull()
      // After cooldown
      expect(system.onIdle('memory-village', cfg.idleThresholdMs, now + cfg.idleCooldownMs + 1)).toBe(HINT_LEVELS.NUDGE)
    })

    it('onEnterRegion resets to entry level', () => {
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now)
      expect(system.levelFor('cmd1')).toBeGreaterThan(HINT_LEVELS.NUDGE)
      system.onEnterRegion('memory-village', now)
      expect(system.levelFor('memory-village')).toBe(HINT_LEVELS.NUDGE)
    })

    it('onAskHelp escalates appropriately', () => {
      // what-do-i-do -> CONCEPT
      system.onAskHelp('memory-village', 'what-do-i-do', now)
      expect(system.levelFor('memory-village')).toBe(HINT_LEVELS.CONCEPT)

      // help / ? -> SYNTAX
      system.onAskHelp('memory-village', 'help', now)
      expect(system.levelFor('memory-village')).toBe(HINT_LEVELS.SYNTAX)

      // help-me -> max level
      system.onAskHelp('memory-village', 'help-me', now)
      expect(system.levelFor('memory-village')).toBe(HINT_LEVELS.EXAMPLE)
    })

    it('setMode updates all situations', () => {
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now)
      expect(system.levelFor('cmd1')).toBeGreaterThan(HINT_LEVELS.NUDGE)

      system.setMode('pro')
      // Pro mode min level is CONCEPT
      expect(system.levelFor('cmd1')).toBeGreaterThanOrEqual(HINT_LEVELS.CONCEPT)
    })

    it('serialize/hydrate preserves state', () => {
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now)
      const saved = system.serialize()

      const system2 = createREXHintSystem({ mode: 'beginner', now: () => now })
      system2.hydrate(saved)
      expect(system2.levelFor('cmd1')).toBe(system.levelFor('cmd1'))
      expect(system2.mode).toBe('beginner')
    })

    it('reset clears all situations', () => {
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd2', false, now)
      system.reset()
      expect(system.situationIds().length).toBe(0)
    })
  })

  describe('Pro Mode', () => {
    beforeEach(() => {
      system = createREXHintSystem({ mode: 'pro', now: () => now })
    })

    it('starts at CONCEPT level (2)', () => {
      expect(system.levelFor('test')).toBe(HINT_LEVELS.CONCEPT)
    })

    it('never shows EXAMPLE level (4)', () => {
      const cfg = MODE_CONFIG.pro
      // Even with many failures
      for (let i = 0; i < 10; i++) {
        system.onCommand('cmd1', false, now)
      }
      expect(system.levelFor('cmd1')).toBeLessThanOrEqual(cfg.maxLevel)
      expect(system.levelFor('cmd1')).toBeLessThanOrEqual(HINT_LEVELS.SYNTAX)
    })

    it('has different thresholds', () => {
      const cfg = MODE_CONFIG.pro
      expect(cfg.minLevel).toBe(HINT_LEVELS.CONCEPT)
      expect(cfg.maxLevel).toBe(HINT_LEVELS.SYNTAX)
      expect(cfg.idleThresholdMs).toBeGreaterThan(MODE_CONFIG.beginner.idleThresholdMs)
      expect(cfg.repeatThreshold).toBeGreaterThan(MODE_CONFIG.beginner.repeatThreshold)
    })
  })

  describe('Edge Cases', () => {
    it('clampLevel bounds levels to min/max', () => {
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now)
      // Even with many failures, should not exceed max
      expect(system.levelFor('cmd1')).toBeLessThanOrEqual(MODE_CONFIG.beginner.maxLevel)
    })

    it('different situations are independent', () => {
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now)
      expect(system.levelFor('cmd1')).toBeGreaterThan(HINT_LEVELS.NUDGE)
      expect(system.levelFor('cmd2')).toBe(HINT_LEVELS.NUDGE)
    })

    it('onHintShown at max level does not escalate further', () => {
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now)
      system.onCommand('cmd1', false, now) // at max
      const before = system.levelFor('cmd1')
      system.onHintShown('cmd1', now)
      system.onHintShown('cmd1', now + 30000)
      expect(system.levelFor('cmd1')).toBe(before)
    })
  })
})