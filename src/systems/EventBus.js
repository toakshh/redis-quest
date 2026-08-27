// EventBus — the game's semantic event backbone. The engine emits low-level
// mutations ('change', 'error', 'expired'); the store re-emits high-level game
// events here so REX and friends can subscribe without touching the engine.
//
// All event names live in EVENTS so subscribers can reference them safely and
// the payloads stay documented in one place. The bus is a tiny synchronous
// emitter (same shape as the engine's) — no external dependency.

export const EVENTS = {
  // Redis command lifecycle
  COMMAND_EXECUTED: 'command:executed', // { name, args, reply, ok, at }
  COMMAND_FAILED: 'command:failed', // { name, args, reply, at }
  ERROR_EXPLAINED: 'error:explained', // { reply, message }

  // Player state
  PLAYER_ACTIVITY: 'player:activity', // { at }
  PLAYER_IDLE: 'player:idle', // { elapsedMs, at }

  // World / progression
  REGION_ENTERED: 'region:entered', // { regionId, from }
  BOSS_PHASE_CHANGED: 'boss:phase', // { bossId, challengeIndex, challengeKey, solved }

  // Tutorial lifecycle
  TUTORIAL_STARTED: 'tutorial:started', // { tutorialId }
  TUTORIAL_STEP: 'tutorial:step', // { tutorialId, stepId, ok }
  TUTORIAL_COMPLETED: 'tutorial:completed', // { tutorialId }

  // Encyclopedia
  ENCYCLOPEDIA_UNLOCKED: 'encyclopedia:unlocked', // { entryId }

  // REX itself
  REX_HINT: 'rex:hint', // { situationId, level }
  REX_SAID: 'rex:said', // { kind, text }
  MODE_CHANGED: 'mode:changed', // { mode }
}

// Tiny synchronous pub/sub. Mirrors the engine Emitter API so existing code
// that already talks to an emitter can subscribe to the bus too.
export class EventBus {
  constructor() {
    this.handlers = new Map()
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event).add(fn)
    return () => this.off(event, fn)
  }

  off(event, fn) {
    this.handlers.get(event)?.delete(fn)
  }

  emit(event, payload) {
    const set = this.handlers.get(event)
    if (set) for (const fn of set) fn(payload)
  }

  // Remove every subscriber (used between game sessions / in tests).
  clear() {
    this.handlers.clear()
  }
}

export function createEventBus() {
  return new EventBus()
}
