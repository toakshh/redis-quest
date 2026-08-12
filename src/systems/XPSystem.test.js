import { describe, it, expect } from 'vitest'
import {
  xpForCommand,
  comboCount,
  modeMultiplier,
  XP_BASE,
  COMBO_WINDOW_MS,
} from './XPSystem.js'

const ok = { type: 'simple', value: 'OK' }
const err = { type: 'error', value: 'ERR nope' }

describe('xpForCommand', () => {
  it('awards base XP for a successful command in pro mode', () => {
    expect(xpForCommand({ name: 'SET', reply: ok, mode: 'pro' })).toBe(XP_BASE)
  })

  it('awards nothing for an error reply', () => {
    expect(xpForCommand({ name: 'SET', reply: err, mode: 'pro' })).toBe(0)
  })

  it('adds first-use and efficiency bonuses', () => {
    const xp = xpForCommand({
      name: 'SET',
      reply: ok,
      isFirstUse: true,
      wasEfficient: true,
      comboCount: 1,
      mode: 'pro',
    })
    expect(xp).toBe(XP_BASE + 10 + 5)
  })

  it('adds a combo bonus once a 3+ streak is active', () => {
    const xp = xpForCommand({ name: 'GET', reply: ok, comboCount: 3, mode: 'pro' })
    expect(xp).toBe(XP_BASE + 5)
  })

  it('applies the beginner generosity multiplier (1.5x) and rounds', () => {
    expect(modeMultiplier('beginner')).toBe(1.5)
    // base 10 * 1.5 = 15
    expect(xpForCommand({ name: 'SET', reply: ok, mode: 'beginner' })).toBe(15)
    // base 10 + first-use 10 + efficiency 5 = 25 * 1.5 = 37.5 -> 38
    expect(
      xpForCommand({
        name: 'SET',
        reply: ok,
        isFirstUse: true,
        wasEfficient: true,
        comboCount: 1,
        mode: 'beginner',
      }),
    ).toBe(38)
  })
})

describe('comboCount', () => {
  const now = 1_000_000
  it('counts a trailing streak of successful commands', () => {
    const log = [
      { name: 'SET', ok: true, at: now - 2000 },
      { name: 'GET', ok: true, at: now - 1000 },
      { name: 'INCR', ok: true, at: now },
    ]
    expect(comboCount(log)).toBe(3)
  })

  it('breaks the combo on an error', () => {
    const log = [
      { name: 'SET', ok: true, at: now - 2000 },
      { name: 'GET', ok: false, at: now - 1000 },
      { name: 'INCR', ok: true, at: now },
    ]
    expect(comboCount(log)).toBe(1)
  })

  it('breaks the combo when commands are too far apart', () => {
    const log = [
      { name: 'SET', ok: true, at: now - 60_000 },
      { name: 'GET', ok: true, at: now },
    ]
    expect(comboCount(log)).toBe(1)
  })

  it('returns 0 for an empty log or an immediate error', () => {
    expect(comboCount([])).toBe(0)
    expect(comboCount([{ name: 'BAD', ok: false, at: now }])).toBe(0)
  })
})

describe('combo window constant sanity', () => {
  it('is a ten second window', () => {
    expect(COMBO_WINDOW_MS).toBe(10_000)
  })
})
