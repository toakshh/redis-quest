// Game-wide event bus for progression, achievements, UI juice, and sound
// design hooks. Separate from the engine's low-level emitter — this carries
// "game things happening" events (XP gained, achievement unlocked, boss hit,
// region unlocked, skill purchased, cosmetic equipped) that any system can
// subscribe to without coupling.
//
// Usage:
//   import { eventBus } from './EventBus.js'
//   const off = eventBus.on('xp:gained', ({ amount }) => ...)
//   eventBus.emit('xp:gained', { amount: 10 })
//   off()

class GameEventBus {
  constructor() {
    this._handlers = new Map()
    this._wildcards = new Set()
  }

  // Subscribe to a named event. Returns an unsubscribe function.
  on(event, fn) {
    if (event === '*') {
      this._wildcards.add(fn)
      return () => this._wildcards.delete(fn)
    }
    if (!this._handlers.has(event)) this._handlers.set(event, new Set())
    this._handlers.get(event).add(fn)
    return () => this._handlers.get(event)?.delete(fn)
  }

  // Subscribe for exactly one firing, then auto-remove.
  once(event, fn) {
    const off = this.on(event, (payload) => {
      off()
      fn(payload)
    })
    return off
  }

  // Fire an event. Wildcard listeners receive (event, payload).
  emit(event, payload) {
    const set = this._handlers.get(event)
    if (set) for (const fn of set) fn(payload)
    for (const fn of this._wildcards) fn(event, payload)
  }

  // Remove all listeners (useful for tests / hot reload).
  clear() {
    this._handlers.clear()
    this._wildcards.clear()
  }
}

export const eventBus = new GameEventBus()

// Canonical game event names for discoverability and autocomplete.
// Systems emit() and on() these strings.
export const EVENTS = {
  // Progression
  XP_GAINED: 'xp:gained',               // { amount, source }
  LEVEL_UP: 'level:up',                  // { level, previousLevel }
  COMMAND_EXECUTED: 'command:executed',   // { name, args, reply, isError }

  // Achievements
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked', // { id, name, xp, icon, rarity }
  ACHIEVEMENT_PROGRESS: 'achievement:progress', // { id, current, target }

  // Boss
  BOSS_ENGAGED: 'boss:engaged',         // { bossId, name }
  BOSS_DAMAGED: 'boss:damaged',         // { bossId, damage, health, maxHealth }
  BOSS_DEFEATED: 'boss:defeated',       // { bossId, name, xp }

  // Skills
  SKILL_UNLOCKED: 'skill:unlocked',     // { skillId, regionId, name }
  SKILL_RESET: 'skill:reset',           // { regionId }

  // Regions
  REGION_UNLOCKED: 'region:unlocked',   // { regionId, name }
  REGION_ENTERED: 'region:entered',     // { regionId }
  GATEWAY_ACTIVATED: 'gateway:activated', // { regionId }

  // Cosmetics
  COSMETIC_UNLOCKED: 'cosmetic:unlocked', // { id, type, name }
  COSMETIC_EQUIPPED: 'cosmetic:equipped', // { id, type, name }

  // Juice / polish
  SCREEN_SHAKE: 'juice:shake',          // { intensity, duration }
  HIT_PAUSE: 'juice:hitpause',          // { frames }
  PARTICLE_BURST: 'juice:particles',    // { x, y, color, count }
  FLASH: 'juice:flash',                 // { color, duration }

  // Save
  GAME_SAVED: 'save:saved',             // { slot }
  GAME_LOADED: 'save:loaded',           // { slot }
  GAME_RESET: 'save:reset',             // {}

  // Settings
  MODE_CHANGED: 'settings:mode',        // { mode } 'beginner'|'pro'
}