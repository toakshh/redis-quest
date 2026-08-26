// Cosmetic system: unlocking, equipping, preview, application

import { eventBus, EVENTS } from '../engine/EventBus.js'
import { COSMETICS, getCosmeticsByType, getCosmeticById, getDefaultCosmetic } from '../data/cosmetics.js'

export class CosmeticSystem {
  constructor() {
    this.owned = new Set()
    this.equipped = {
      playerSkin: null,
      rexVariant: null,
      particleTrail: null,
      uiTheme: null,
      title: null,
    }
  }

  init(ownedIds = [], equipped = {}) {
    for (const id of ownedIds) this.owned.add(id)
    this.equipped = {
      playerSkin: equipped.playerSkin || getDefaultCosmetic('playerSkin')?.id,
      rexVariant: equipped.rexVariant || getDefaultCosmetic('rexVariant')?.id,
      particleTrail: equipped.particleTrail || getDefaultCosmetic('particleTrail')?.id,
      uiTheme: equipped.uiTheme || getDefaultCosmetic('uiTheme')?.id,
      title: equipped.title || getDefaultCosmetic('title')?.id,
    }
    // Ensure defaults are owned
    for (const type of ['playerSkin', 'rexVariant', 'particleTrail', 'uiTheme', 'title']) {
      const def = getDefaultCosmetic(type)
      if (def) this.owned.add(def.id)
    }
  }

  // Check if cosmetic can be unlocked
  canUnlock(cosmeticId, state = {}) {
    const cosmetic = getCosmeticById(cosmeticId)
    if (!cosmetic) return { can: false, reason: 'Cosmetic not found' }
    if (this.owned.has(cosmeticId)) return { can: false, reason: 'Already owned' }

    const criteria = cosmetic.unlockCriteria
    if (!criteria) return { can: true }

    // Default unlock
    if (criteria.default) return { can: true }

    // Level requirement
    if (criteria.level) {
      if ((state.level || 1) < criteria.level) {
        return { can: false, reason: `Requires level ${criteria.level}` }
      }
    }

    // Achievement requirement
    if (criteria.achievement) {
      if (!state.unlockedAchievements?.[criteria.achievement]) {
        const ach = COSMETICS.find(c => c.id === criteria.achievement) // Wrong - need to import achievements
        // We'll check this externally
        return { can: false, reason: `Requires achievement: ${criteria.achievement}` }
      }
    }

    return { can: true }
  }

  // Unlock a cosmetic
  unlock(cosmeticId, state = {}) {
    const cosmetic = getCosmeticById(cosmeticId)
    if (!cosmetic) return { success: false, reason: 'Cosmetic not found' }
    if (this.owned.has(cosmeticId)) return { success: false, reason: 'Already owned' }

    const check = this.canUnlock(cosmeticId, state)
    if (!check.can) return { success: false, reason: check.reason }

    this.owned.add(cosmeticId)

    eventBus.emit(EVENTS.COSMETIC_UNLOCKED, {
      id: cosmetic.id,
      type: cosmetic.type,
      name: cosmetic.name,
      rarity: cosmetic.rarity,
    })

    return { success: true, cosmetic }
  }

  // Equip a cosmetic
  equip(cosmeticId) {
    const cosmetic = getCosmeticById(cosmeticId)
    if (!cosmetic) return { success: false, reason: 'Cosmetic not found' }
    if (!this.owned.has(cosmeticId)) return { success: false, reason: 'Not owned' }

    const previous = this.equipped[cosmetic.type]
    this.equipped[cosmetic.type] = cosmeticId

    eventBus.emit(EVENTS.COSMETIC_EQUIPPED, {
      id: cosmetic.id,
      type: cosmetic.type,
      name: cosmetic.name,
      previous,
    })

    return { success: true, cosmetic, previous }
  }

  // Unequip (revert to default)
  unequip(type) {
    const def = getDefaultCosmetic(type)
    if (!def) return { success: false, reason: 'No default for type' }
    return this.equip(def.id)
  }

  // Get equipped cosmetic of a type
  getEquipped(type) {
    const id = this.equipped[type]
    return id ? getCosmeticById(id) : getDefaultCosmetic(type)
  }

  // Get all equipped cosmetics as objects
  getAllEquipped() {
    const result = {}
    for (const [type, id] of Object.entries(this.equipped)) {
      result[type] = id ? getCosmeticById(id) : getDefaultCosmetic(type)
    }
    return result
  }

  // Get owned cosmetics by type
  getOwnedByType(type) {
    return getCosmeticsByType(type).filter(c => this.owned.has(c.id))
  }

  // Get all owned cosmetics
  getAllOwned() {
    return COSMETICS.filter(c => this.owned.has(c.id))
  }

  // Check if owned
  isOwned(cosmeticId) {
    return this.owned.has(cosmeticId)
  }

  // Check if equipped
  isEquipped(cosmeticId) {
    return Object.values(this.equipped).includes(cosmeticId)
  }

  // Get cosmetic preview data for UI
  getPreview(cosmeticId) {
    const cosmetic = getCosmeticById(cosmeticId)
    if (!cosmetic) return null
    return {
      ...cosmetic,
      owned: this.owned.has(cosmeticId),
      equipped: this.isEquipped(cosmeticId),
    }
  }

  // Apply UI theme (returns CSS custom properties)
  getThemeCSS() {
    const theme = this.getEquipped('uiTheme')
    if (!theme?.colors) return {}
    const css = {}
    for (const [key, value] of Object.entries(theme.colors)) {
      css[`--color-${key}`] = value
    }
    return css
  }

  // Get player skin render data
  getPlayerSkinData() {
    const skin = this.getEquipped('playerSkin')
    return skin?.preview || { primary: '#22d3ee', secondary: '#06b6d4', glow: 'rgba(34, 211, 238, 0.5)' }
  }

  // Get REX variant render data
  getRexVariantData() {
    const variant = this.getEquipped('rexVariant')
    return {
      geometry: variant?.geometry || 'cube',
      color: variant?.color || '#22d3ee',
    }
  }

  // Get particle trail config
  getParticleTrailConfig() {
    const trail = this.getEquipped('particleTrail')
    return trail?.particles || { particles: [] }
  }

  // Get title format
  getTitleFormat(playerName) {
    const title = this.getEquipped('title')
    if (!title?.format) return playerName
    return title.format.replace('{name}', playerName)
  }

  // Serialize for save
  serialize() {
    return {
      owned: Array.from(this.owned),
      equipped: { ...this.equipped },
    }
  }

  // Deserialize from save
  deserialize(data) {
    if (data?.owned) this.owned = new Set(data.owned)
    if (data?.equipped) this.equipped = { ...this.equipped, ...data.equipped }
  }

  reset() {
    this.owned.clear()
    this.equipped = {
      playerSkin: null,
      rexVariant: null,
      particleTrail: null,
      uiTheme: null,
      title: null,
    }
  }
}

export const cosmeticSystem = new CosmeticSystem()