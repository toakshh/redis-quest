// Save system: localStorage auto-save, JSON export/import with schema versioning
// Supports backward compatibility and multiple save slots

import { eventBus, EVENTS } from '../engine/EventBus.js'

const SAVE_VERSION = 4
const SAVE_KEY_PREFIX = 'redis-quest-save-'
const AUTO_SAVE_KEY = 'redis-quest-autosave'
const SETTINGS_KEY = 'redis-quest-settings'
const MAX_SLOTS = 5

// Current schema version for migration
export const SCHEMA_VERSION = SAVE_VERSION

// Default game state template
export function createDefaultState() {
  return {
    schemaVersion: SAVE_VERSION,
    timestamp: Date.now(),
    // Core progression
    xp: 0,
    level: 1,
    totalCommands: 0,
    totalErrors: 0,
    commandsByType: {},
    datatypeCounts: {},
    datatypesUsed: [],
    maxTransactionSize: 0,
    // Unlocks
    unlocked: {}, // achievements
    unlockedSkills: {},
    unlockedRegions: { strings: true }, // strings starts unlocked
    currentRegion: 'strings',
    // Skills
    skillPoints: 0,
    // Cosmetics
    ownedCosmetics: ['crystal-cyan', 'rex-cube', 'trail-none', 'theme-cyberpunk', 'title-novice'],
    equippedCosmetic: {
      playerSkin: 'crystal-cyan',
      rexVariant: 'rex-cube',
      particleTrail: 'trail-none',
      uiTheme: 'theme-cyberpunk',
      title: 'title-novice',
    },
    // Boss
    boss: null,
    bossHistory: [],
    // Settings
    mode: 'beginner', // 'beginner' | 'pro'
    autoSaveInterval: 30000, // 30s beginner, 60s pro
    hintDepth: 'full', // 'full' | 'minimal' | 'none'
    visualGuides: true,
    speedrunTimer: false,
    // Statistics
    playTimeMs: 0,
    sessionStartTime: Date.now(),
    fastTravelCount: 0,
    saveAgeDays: 0,
    // Engine state (serialized)
    engineSnapshot: null,
  }
}

// Migration functions for backward compatibility
const migrations = {
  1: (state) => {
    // v1 -> v2: Add schemaVersion, rename fields
    state.schemaVersion = 2
    if (state.unlockedAchievements) {
      state.unlocked = state.unlockedAchievements
      delete state.unlockedAchievements
    }
    return state
  },
  2: (state) => {
    // v2 -> v3: Add cosmetics, regions, skills
    state.schemaVersion = 3
    state.ownedCosmetics = state.ownedCosmetics || ['crystal-cyan', 'rex-cube', 'trail-none', 'theme-cyberpunk', 'title-novice']
    state.equippedCosmetic = state.equippedCosmetic || {
      playerSkin: 'crystal-cyan',
      rexVariant: 'rex-cube',
      particleTrail: 'trail-none',
      uiTheme: 'theme-cyberpunk',
      title: 'title-novice',
    }
    state.unlockedRegions = state.unlockedRegions || { strings: true }
    state.currentRegion = state.currentRegion || 'strings'
    state.unlockedSkills = state.unlockedSkills || {}
    state.skillPoints = state.skillPoints || 0
    state.fastTravelCount = state.fastTravelCount || 0
    return state
  },
  3: (state) => {
    // v3 -> v4: Add mode, hintDepth, visualGuides, speedrunTimer, playTimeMs, saveAgeDays
    state.schemaVersion = 4
    state.mode = state.mode || 'beginner'
    state.autoSaveInterval = state.mode === 'pro' ? 60000 : 30000
    state.hintDepth = state.hintDepth || 'full'
    state.visualGuides = state.visualGuides !== false
    state.speedrunTimer = state.speedrunTimer || false
    state.playTimeMs = state.playTimeMs || 0
    state.sessionStartTime = state.sessionStartTime || Date.now()
    state.saveAgeDays = state.saveAgeDays || 0
    return state
  },
}

function migrateState(state) {
  if (!state.schemaVersion) state.schemaVersion = 1
  let currentVersion = state.schemaVersion
  while (currentVersion < SAVE_VERSION) {
    const migration = migrations[currentVersion]
    if (migration) {
      state = migration(state)
      currentVersion = state.schemaVersion
    } else {
      break
    }
  }
  return state
}

// Save manager class
export class SaveManager {
  constructor() {
    this.autoSaveTimer = null
    this.currentSlot = 0
    this.listeners = new Set()
  }

  // Subscribe to save events
  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  _notify(event, data) {
    for (const fn of this.listeners) fn(event, data)
  }

  // Get all save slots metadata
  getSlots() {
    const slots = []
    for (let i = 0; i < MAX_SLOTS; i++) {
      const key = SAVE_KEY_PREFIX + i
      try {
        const data = localStorage.getItem(key)
        if (data) {
          const parsed = JSON.parse(data)
          slots.push({
            slot: i,
            timestamp: parsed.timestamp || 0,
            level: parsed.level || 1,
            xp: parsed.xp || 0,
            region: parsed.currentRegion || 'strings',
            playTime: parsed.playTimeMs || 0,
            mode: parsed.mode || 'beginner',
          })
        } else {
          slots.push({ slot: i, empty: true })
        }
      } catch (e) {
        slots.push({ slot: i, empty: true, corrupted: true })
      }
    }
    return slots
  }

  // Save to a specific slot
  save(slot, state) {
    const key = SAVE_KEY_PREFIX + slot
    const saveData = {
      ...state,
      schemaVersion: SAVE_VERSION,
      timestamp: Date.now(),
      playTimeMs: state.playTimeMs + (Date.now() - state.sessionStartTime),
      saveAgeDays: Math.floor((Date.now() - (state.firstSaveTime || Date.now())) / 86400000),
    }
    try {
      localStorage.setItem(key, JSON.stringify(saveData))
      this.currentSlot = slot
      this._notify('saved', { slot, state: saveData })
      eventBus.emit(EVENTS.GAME_SAVED, { slot })
      return true
    } catch (e) {
      console.error('Save failed:', e)
      return false
    }
  }

  // Load from a specific slot
  load(slot) {
    const key = SAVE_KEY_PREFIX + slot
    try {
      const data = localStorage.getItem(key)
      if (!data) return null
      const parsed = JSON.parse(data)
      const migrated = migrateState(parsed)
      migrated.sessionStartTime = Date.now()
      this.currentSlot = slot
      this._notify('loaded', { slot, state: migrated })
      eventBus.emit(EVENTS.GAME_LOADED, { slot })
      return migrated
    } catch (e) {
      console.error('Load failed:', e)
      return null
    }
  }

  // Auto-save to dedicated autosave slot
  autoSave(state) {
    const saveData = {
      ...state,
      schemaVersion: SAVE_VERSION,
      timestamp: Date.now(),
      playTimeMs: state.playTimeMs + (Date.now() - state.sessionStartTime),
    }
    try {
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(saveData))
      return true
    } catch (e) {
      console.error('Auto-save failed:', e)
      return false
    }
  }

  // Load auto-save
  loadAutoSave() {
    try {
      const data = localStorage.getItem(AUTO_SAVE_KEY)
      if (!data) return null
      const parsed = JSON.parse(data)
      return migrateState(parsed)
    } catch (e) {
      console.error('Auto-load failed:', e)
      return null
    }
  }

  // Delete a save slot
  deleteSlot(slot) {
    const key = SAVE_KEY_PREFIX + slot
    localStorage.removeItem(key)
    this._notify('deleted', { slot })
  }

  // Export save as JSON file
  exportSave(slot) {
    const key = SAVE_KEY_PREFIX + slot
    const data = localStorage.getItem(key)
    if (!data) return null
    const parsed = JSON.parse(data)
    return {
      ...parsed,
      exportVersion: SAVE_VERSION,
      exportedAt: new Date().toISOString(),
    }
  }

  // Import save from JSON
  importSave(jsonString, targetSlot = null) {
    try {
      const imported = JSON.parse(jsonString)
      if (!imported.schemaVersion) {
        throw new Error('Invalid save file: missing schema version')
      }
      const migrated = migrateState(imported)
      const slot = targetSlot ?? this.findEmptySlot() ?? 0
      this.save(slot, migrated)
      return { success: true, slot }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  findEmptySlot() {
    for (let i = 0; i < MAX_SLOTS; i++) {
      const key = SAVE_KEY_PREFIX + i
      if (!localStorage.getItem(key)) return i
    }
    return null
  }

  // Start auto-save timer
  startAutoSave(getStateFn, intervalMs = 30000) {
    this.stopAutoSave()
    this.autoSaveTimer = setInterval(() => {
      const state = getStateFn()
      this.autoSave(state)
    }, intervalMs)
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
  }

  // Save settings
  saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      return true
    } catch (e) {
      console.error('Settings save failed:', e)
      return false
    }
  }

  // Load settings
  loadSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY)
      return data ? JSON.parse(data) : {}
    } catch (e) {
      console.error('Settings load failed:', e)
      return {}
    }
  }

  // Reset all data (for new game)
  resetAll() {
    for (let i = 0; i < MAX_SLOTS; i++) {
      localStorage.removeItem(SAVE_KEY_PREFIX + i)
    }
    localStorage.removeItem(AUTO_SAVE_KEY)
    localStorage.removeItem(SETTINGS_KEY)
    this._notify('reset', {})
    eventBus.emit(EVENTS.GAME_RESET, {})
  }
}

export const saveManager = new SaveManager()