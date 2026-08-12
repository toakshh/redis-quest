// Achievement system: tracking, unlocking, progress, XP rewards, toasts

import { eventBus, EVENTS } from '../engine/EventBus.js'
import { ACHIEVEMENTS, RARITY_COLORS, CATEGORY_LABELS, CATEGORY_ICONS } from '../data/achievements.js'

export class AchievementSystem {
  constructor() {
    this.unlocked = new Set()
    this.progress = new Map() // achievementId -> { current, target }
    this.toasts = [] // active achievement toasts
    this.toastDuration = 4000
    this.maxToasts = 3
    this._checkInterval = null
  }

  // Initialize with already-unlocked achievements
  init(unlockedIds = []) {
    for (const id of unlockedIds) {
      this.unlocked.add(id)
    }
    this._startPeriodicCheck()
  }

  // Check all achievements against current game state
  checkAll(state) {
    const newlyUnlocked = []
    for (const achievement of ACHIEVEMENTS) {
      if (this.unlocked.has(achievement.id)) continue
      try {
        if (achievement.criteria(state)) {
          newlyUnlocked.push(achievement)
        }
      } catch (e) {
        console.warn(`Achievement check failed for ${achievement.id}:`, e)
      }
    }
    for (const achievement of newlyUnlocked) {
      this.unlock(achievement.id)
    }
    return newlyUnlocked
  }

  // Unlock a specific achievement by ID
  unlock(achievementId) {
    if (this.unlocked.has(achievementId)) return null
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId)
    if (!achievement) return null

    this.unlocked.add(achievementId)

    // Add toast notification
    this._addToast(achievement)

    // Emit event for other systems
    eventBus.emit(EVENTS.ACHIEVEMENT_UNLOCKED, {
      id: achievement.id,
      name: achievement.name,
      xp: achievement.xp,
      icon: achievement.icon,
      rarity: achievement.rarity,
      category: achievement.category,
    })

    return achievement
  }

  // Update progress for an achievement (for progress bars)
  updateProgress(achievementId, current, target) {
    this.progress.set(achievementId, { current, target })
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId)
    if (achievement && !this.unlocked.has(achievementId)) {
      eventBus.emit(EVENTS.ACHIEVEMENT_PROGRESS, {
        id: achievementId,
        current,
        target,
        name: achievement.name,
      })
    }
  }

  // Get progress for an achievement
  getProgress(achievementId) {
    return this.progress.get(achievementId) || { current: 0, target: 1 }
  }

  // Check if achievement is unlocked
  isUnlocked(achievementId) {
    return this.unlocked.has(achievementId)
  }

  // Get all unlocked achievements
  getUnlocked() {
    return Array.from(this.unlocked).map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean)
  }

  // Get achievements by category
  getByCategory(category) {
    return ACHIEVEMENTS.filter(a => a.category === category)
  }

  // Get all achievements with unlock status
  getAllWithStatus() {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: this.unlocked.has(a.id),
      progress: this.progress.get(a.id) || { current: 0, target: a.target || 1 },
      rarityColor: RARITY_COLORS[a.rarity],
      categoryLabel: CATEGORY_LABELS[a.category],
      categoryIcon: CATEGORY_ICONS[a.category],
    }))
  }

  // Get total XP from achievements
  getTotalXP() {
    return Array.from(this.unlocked).reduce((sum, id) => {
      const a = ACHIEVEMENTS.find(a => a.id === id)
      return sum + (a?.xp || 0)
    }, 0)
  }

  // Toast management
  _addToast(achievement) {
    const toast = {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      rarity: achievement.rarity,
      rarityColor: RARITY_COLORS[achievement.rarity],
      xp: achievement.xp,
      timestamp: Date.now(),
    }
    this.toasts.unshift(toast)
    if (this.toasts.length > this.maxToasts) {
      this.toasts.pop()
    }
    // Auto-dismiss
    setTimeout(() => this.dismissToast(achievement.id), this.toastDuration)
  }

  dismissToast(achievementId) {
    this.toasts = this.toasts.filter(t => t.id !== achievementId)
  }

  getToasts() {
    return [...this.toasts]
  }

  // Periodic check for meta achievements (time-based, etc.)
  _startPeriodicCheck() {
    this._checkInterval = setInterval(() => {
      // Meta achievements like night-owl, early-bird, weekend-warrior
      // are checked on demand by the store when state changes
    }, 60000)
  }

  stopPeriodicCheck() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval)
      this._checkInterval = null
    }
  }

  // Serialize for save
  serialize() {
    return {
      unlocked: Array.from(this.unlocked),
      progress: Object.fromEntries(this.progress),
    }
  }

  // Deserialize from save
  deserialize(data) {
    if (data?.unlocked) this.unlocked = new Set(data.unlocked)
    if (data?.progress) this.progress = new Map(Object.entries(data.progress))
  }

  // Reset all achievements
  reset() {
    this.unlocked.clear()
    this.progress.clear()
    this.toasts = []
  }
}

export const achievementSystem = new AchievementSystem()