// Region progression system: unlock criteria, gateways, fast travel, silhouettes

import { eventBus, EVENTS } from '../engine/EventBus.js'
import { REGIONS, REGION_CONNECTIONS, getSkillsByRegion } from '../data/regions.js'
import { getSkillById } from '../data/skills.js'

export class RegionSystem {
  constructor() {
    this.unlocked = new Set(['strings']) // strings starts unlocked
    this.currentRegion = 'strings'
    this.discovered = new Set(['strings']) // regions player knows exist
    this.fastTravelCount = 0
    this.gatewayActivated = new Set()
  }

  init(unlockedIds = [], currentRegion = 'strings', discoveredIds = [], fastTravelCount = 0) {
    this.unlocked = new Set(unlockedIds)
    this.currentRegion = currentRegion
    this.discovered = new Set(discoveredIds)
    this.fastTravelCount = fastTravelCount
  }

  // Check if a region can be unlocked
  canUnlock(regionId, state = {}) {
    const region = REGIONS.find(r => r.id === regionId)
    if (!region) return { can: false, reason: 'Region not found' }
    if (this.unlocked.has(regionId)) return { can: false, reason: 'Already unlocked' }

    const criteria = region.unlockCriteria

    // Check boss defeated
    if (criteria.bossDefeated) {
      const bossDefeated = state.bossHistory?.some(b => b.name === criteria.bossDefeated && b.won)
      if (!bossDefeated) return { can: false, reason: `Defeat ${criteria.bossDefeated} first` }
    }

    // Check minimum level
    if (criteria.minLevel) {
      const level = state.level || 1
      if (level < criteria.minLevel) return { can: false, reason: `Requires level ${criteria.minLevel}` }
    }

    // Check key skills
    if (criteria.keySkills) {
      for (const skillId of criteria.keySkills) {
        if (!state.unlockedSkills?.[skillId]) {
          const skill = getSkillById(skillId)
          return { can: false, reason: `Requires skill: ${skill?.name || skillId}` }
        }
      }
    }

    return { can: true }
  }

  // Unlock a region
  unlock(regionId, state = {}) {
    const check = this.canUnlock(regionId, state)
    if (!check.can) return { success: false, reason: check.reason }

    this.unlocked.add(regionId)
    this.discovered.add(regionId)

    eventBus.emit(EVENTS.REGION_UNLOCKED, { regionId, name: REGIONS.find(r => r.id === regionId)?.name })

    // Check for region unlock achievements
    // This is handled by AchievementSystem checking state

    return { success: true, region: REGIONS.find(r => r.id === regionId) }
  }

  // Enter a region (set as current)
  enterRegion(regionId) {
    if (!this.unlocked.has(regionId)) return { success: false, reason: 'Region not unlocked' }
    const previousRegion = this.currentRegion
    this.currentRegion = regionId
    this.discovered.add(regionId)

    eventBus.emit(EVENTS.REGION_ENTERED, { regionId, previousRegion })
    return { success: true, region: REGIONS.find(r => r.id === regionId) }
  }

  // Fast travel to a region
  fastTravel(regionId) {
    if (!this.unlocked.has(regionId)) return { success: false, reason: 'Region not unlocked' }
    if (!REGIONS.find(r => r.id === regionId)?.fastTravel) {
      return { success: false, reason: 'Fast travel not available for this region' }
    }
    this.fastTravelCount++
    const result = this.enterRegion(regionId)
    if (result.success) {
      eventBus.emit(EVENTS.GATEWAY_ACTIVATED, { regionId })
    }
    return { ...result, fastTravelCount: this.fastTravelCount }
  }

  // Activate gateway (visual effect when entering new region)
  activateGateway(regionId) {
    this.gatewayActivated.add(regionId)
    eventBus.emit(EVENTS.GATEWAY_ACTIVATED, { regionId })
  }

  // Get region info
  getRegion(regionId) {
    return REGIONS.find(r => r.id === regionId)
  }

  // Get all regions with status
  getAllRegions(state = {}) {
    return REGIONS.map(region => {
      const unlocked = this.unlocked.has(region.id)
      const discovered = this.discovered.has(region.id)
      const canUnlock = this.canUnlock(region.id, state)
      return {
        ...region,
        unlocked,
        discovered,
        canUnlock: canUnlock.can,
        unlockReason: canUnlock.reason,
        isCurrent: region.id === this.currentRegion,
        skills: getSkillsByRegion(region.id).map(s => ({
          id: s.id,
          name: s.name,
          unlocked: state.unlockedSkills?.[s.id] || false,
        })),
      }
    })
  }

  // Get connected regions for constellation map
  getConnections() {
    return REGION_CONNECTIONS.map(([from, to]) => ({
      from,
      to,
      fromUnlocked: this.unlocked.has(from),
      toUnlocked: this.unlocked.has(to),
      fromDiscovered: this.discovered.has(from),
      toDiscovered: this.discovered.has(to),
    }))
  }

  // Get unlocked region count
  getUnlockedCount() {
    return this.unlocked.size
  }

  // Check if all regions unlocked
  isComplete() {
    return this.unlocked.size === REGIONS.length
  }

  // Get next unlockable regions
  getNextUnlockable(state = {}) {
    return REGIONS
      .filter(r => !this.unlocked.has(r.id))
      .filter(r => this.canUnlock(r.id, state).can)
      .map(r => ({ ...r, reason: this.canUnlock(r.id, state).reason }))
  }

  // Serialize for save
  serialize() {
    return {
      unlocked: Array.from(this.unlocked),
      currentRegion: this.currentRegion,
      discovered: Array.from(this.discovered),
      fastTravelCount: this.fastTravelCount,
      gatewayActivated: Array.from(this.gatewayActivated),
    }
  }

  // Deserialize from save
  deserialize(data) {
    if (data?.unlocked) this.unlocked = new Set(data.unlocked)
    this.currentRegion = data?.currentRegion || 'strings'
    if (data?.discovered) this.discovered = new Set(data.discovered)
    this.fastTravelCount = data?.fastTravelCount || 0
    if (data?.gatewayActivated) this.gatewayActivated = new Set(data.gatewayActivated)
  }

  reset() {
    this.unlocked = new Set(['strings'])
    this.currentRegion = 'strings'
    this.discovered = new Set(['strings'])
    this.fastTravelCount = 0
    this.gatewayActivated.clear()
  }
}

export const regionSystem = new RegionSystem()