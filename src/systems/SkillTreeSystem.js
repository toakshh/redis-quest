// Skill Tree system: unlocking skills, prerequisites, respec, XP costs

import { eventBus, EVENTS } from '../engine/EventBus.js'
import { SKILLS, getSkillsByRegion, getSkillById, getPrerequisiteChain } from '../data/skills.js'

export class SkillTreeSystem {
  constructor() {
    this.unlocked = new Set()
    this.skillPoints = 0
  }

  init(unlockedIds = [], skillPoints = 0) {
    for (const id of unlockedIds) this.unlocked.add(id)
    this.skillPoints = skillPoints
  }

  // Check if a skill can be unlocked (prerequisites met, not already unlocked)
  canUnlock(skillId, state = {}) {
    const skill = getSkillById(skillId)
    if (!skill) return { can: false, reason: 'Skill not found' }
    if (this.unlocked.has(skillId)) return { can: false, reason: 'Already unlocked' }

    // Check prerequisites
    for (const prereqId of skill.prerequisites) {
      if (!this.unlocked.has(prereqId)) {
        const prereq = getSkillById(prereqId)
        return { can: false, reason: `Requires: ${prereq?.name || prereqId}` }
      }
    }

    // Check region unlocked
    const regionUnlocked = state.unlockedRegions?.[skill.regionId]
    if (!regionUnlocked && skill.regionId !== 'strings') {
      return { can: false, reason: `Region locked: ${skill.regionId}` }
    }

    // Check XP/skill points
    if (this.skillPoints < skill.xpCost) {
      return { can: false, reason: `Need ${skill.xpCost} SP (have ${this.skillPoints})` }
    }

    return { can: true }
  }

  // Unlock a skill
  unlock(skillId, state = {}) {
    const check = this.canUnlock(skillId, state)
    if (!check.can) return { success: false, reason: check.reason }

    const skill = getSkillById(skillId)
    this.skillPoints -= skill.xpCost
    this.unlocked.add(skillId)

    eventBus.emit(EVENTS.SKILL_UNLOCKED, {
      skillId,
      regionId: skill.regionId,
      name: skill.name,
      xpCost: skill.xpCost,
      remainingSP: this.skillPoints,
    })

    return { success: true, skill, remainingSP: this.skillPoints }
  }

  // Reset skills in a region (respec)
  resetRegion(regionId) {
    const regionSkills = getSkillsByRegion(regionId)
    let refunded = 0
    for (const skill of regionSkills) {
      if (this.unlocked.has(skill.id)) {
        this.unlocked.delete(skill.id)
        refunded += skill.xpCost
      }
    }
    this.skillPoints += refunded

    eventBus.emit(EVENTS.SKILL_RESET, { regionId, refunded, totalSP: this.skillPoints })
    return { refunded, totalSP: this.skillPoints }
  }

  // Reset all skills (full respec)
  resetAll() {
    let refunded = 0
    for (const skill of SKILLS) {
      if (this.unlocked.has(skill.id)) {
        refunded += skill.xpCost
      }
    }
    this.unlocked.clear()
    this.skillPoints += refunded

    eventBus.emit(EVENTS.SKILL_RESET, { regionId: 'all', refunded, totalSP: this.skillPoints })
    return { refunded, totalSP: this.skillPoints }
  }

  // Add skill points (from level up, achievements, etc.)
  addSkillPoints(amount) {
    this.skillPoints += amount
    return this.skillPoints
  }

  // Check if skill is unlocked
  isUnlocked(skillId) {
    return this.unlocked.has(skillId)
  }

  // Get all unlocked skills
  getUnlocked() {
    return Array.from(this.unlocked).map(id => getSkillById(id)).filter(Boolean)
  }

  // Get skills for a region with unlock status
  getRegionSkills(regionId, state = {}) {
    return getSkillsByRegion(regionId).map(skill => ({
      ...skill,
      unlocked: this.unlocked.has(skill.id),
      canUnlock: this.canUnlock(skill.id, state).can,
      prerequisitesMet: skill.prerequisites.every(p => this.unlocked.has(p)),
    }))
  }

  // Get all skills grouped by region
  getAllSkillsByRegion(state = {}) {
    const result = {}
    for (const skill of SKILLS) {
      if (!result[skill.regionId]) result[skill.regionId] = []
      result[skill.regionId].push({
        ...skill,
        unlocked: this.unlocked.has(skill.id),
        canUnlock: this.canUnlock(skill.id, state).can,
        prerequisitesMet: skill.prerequisites.every(p => this.unlocked.has(p)),
      })
    }
    return result
  }

  // Get total SP spent
  getTotalSpent() {
    return Array.from(this.unlocked).reduce((sum, id) => {
      const skill = getSkillById(id)
      return sum + (skill?.xpCost || 0)
    }, 0)
  }

  // Get unlock percentage
  getCompletionPercent() {
    return (this.unlocked.size / SKILLS.length) * 100
  }

  // Serialize for save
  serialize() {
    return {
      unlocked: Array.from(this.unlocked),
      skillPoints: this.skillPoints,
    }
  }

  // Deserialize from save
  deserialize(data) {
    if (data?.unlocked) this.unlocked = new Set(data.unlocked)
    this.skillPoints = data?.skillPoints || 0
  }

  reset() {
    this.unlocked.clear()
    this.skillPoints = 0
  }
}

export const skillTreeSystem = new SkillTreeSystem()