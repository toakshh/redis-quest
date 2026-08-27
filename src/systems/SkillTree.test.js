import { describe, it, expect } from 'vitest'
import { SKILLS, canUnlockSkill, isSkillUnlockable, purchasableSkills } from './SkillTree.js'

// Fresh state: nothing owned, region locked, one point.
function state(overrides = {}) {
  return {
    skills: {},
    skillPoints: 1,
    regions: {},
    ...overrides,
  }
}

describe('SkillTree catalog', () => {
  it('has crystal-clarity as the Memory Village root skill', () => {
    const clarity = SKILLS.find((s) => s.id === 'crystal-clarity')
    expect(clarity).toBeTruthy()
    expect(clarity.region).toBe('memory-village')
    expect(clarity.cost).toBe(1)
    expect(clarity.requires || []).toEqual([])
  })

  it('declares roadmap skills that connect to crystal-clarity', () => {
    const swift = SKILLS.find((s) => s.id === 'swift-retrieval')
    const memorialist = SKILLS.find((s) => s.id === 'memorialist')
    expect(swift.requires).toContain('crystal-clarity')
    expect(memorialist.requires).toContain('crystal-clarity')
  })
})

describe('canUnlockSkill', () => {
  it('is not unlockable while the region is locked', () => {
    expect(canUnlockSkill('crystal-clarity', state()).ok).toBe(false)
  })

  it('unlocks once the Memory Village region is reached', () => {
    const res = canUnlockSkill('crystal-clarity', state({ regions: { 'memory-village': true } }))
    expect(res.ok).toBe(true)
    expect(res.skill.id).toBe('crystal-clarity')
  })

  it('refuses without enough points', () => {
    const res = canUnlockSkill(
      'crystal-clarity',
      state({ regions: { 'memory-village': true }, skillPoints: 0 }),
    )
    expect(res).toMatchObject({ ok: false, reason: 'no-points' })
  })

  it('refuses already-owned skills', () => {
    const res = canUnlockSkill('crystal-clarity', state({
      regions: { 'memory-village': true },
      skills: { 'crystal-clarity': Date.now() },
    }))
    expect(res.reason).toBe('already-owned')
  })

  it('keeps roadmap skills locked even with points', () => {
    const res = canUnlockSkill('swift-retrieval', state({ regions: { 'memory-village': true } }))
    expect(res.reason).toBe('locked')
  })
})

describe('isSkillUnlockable + purchasableSkills', () => {
  it('lists only the purchasable skill', () => {
    const unlocked = {
      regions: { 'memory-village': true },
      skills: {},
      skillPoints: 1,
    }
    expect(purchasableSkills(unlocked)).toEqual(['crystal-clarity'])
  })

  it('exposes crystal-clarity once owned for future-node rendering', () => {
    expect(
      isSkillUnlockable('crystal-clarity', { skills: { 'crystal-clarity': 1 }, regions: {} }),
    ).toBe(false)
  })
})
