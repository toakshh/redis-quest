// Typed game-event catalog shared by the event bus, the RedisGameBridge and
// every game system. Keeping the type names in one place means the compiler
// and debug overlay speak the same vocabulary as the bridge that produces
// the events.
//
// Every event flowing through the bus is a plain serializable object:
//   { type, seq, timestamp, source, payload }
// so a session can be recorded to JSON and replayed deterministically.

export const EVENT_TYPES = {
  // A Redis command was executed (or queued) on the mock engine.
  REDIS_COMMAND_EXECUTED: 'RedisCommandExecuted',
  // A key in the Redis store changed: created, updated, deleted or expired.
  REDIS_STATE_CHANGED: 'RedisStateChanged',
  // A generic, engine-agnostic game event (systems can raise these).
  GAME_EVENT: 'GameEvent',
  // The player earned XP.
  XP_GAINED: 'XPGained',
  // An achievement was unlocked.
  ACHIEVEMENT_UNLOCKED: 'AchievementUnlocked',
  // A skill was unlocked on the skill tree.
  SKILL_UNLOCKED: 'SkillUnlocked',
  // A new region of the world became available.
  REGION_UNLOCKED: 'RegionUnlocked',
  // A boss encounter began.
  BOSS_ENCOUNTER_STARTED: 'BossEncounterStarted',
  // A boss was defeated.
  BOSS_DEFEATED: 'BossDefeated',
  // The player levelled up.
  PLAYER_LEVEL_UP: 'PlayerLevelUp',
  // Something in the world should play a visual effect.
  VISUAL_EFFECT_REQUESTED: 'VisualEffectRequested',
}

// Convenience builder so systems can raise events without remembering the
// shape. `source` names the subsystem that raised the event (used by the
// debug overlay to group the event log).
export function gameEvent(type, payload = {}, source = 'game') {
  return { type, payload, source }
}

// Every visual effect kind the renderer knows how to draw. The bridge picks
// one per Redis command; systems can raise more.
export const EFFECT_KINDS = {
  CRYSTAL_FORM: 'crystal_form', // new key crystallises in place
  CRYSTAL_PULSE: 'crystal_pulse', // existing value written
  COUNTER_PULSE: 'counter_pulse', // INCR/DECR/etc: pulsing ring + delta
  RETRIEVE_BEAM: 'retrieve_beam', // GET: beam from key to player
  SHATTER: 'shatter', // DEL/UNLINK: crystal breaks apart
  POOF: 'poof', // key expired: crystal fades to smoke
  COUNTDOWN_HALO: 'countdown_halo', // EXPIRE: ring that counts down
  CANCEL_HALO: 'cancel_halo', // PERSIST: halo removed
  FIELD_FLASH: 'field_flash', // hash field written
  QUEUE_SLIDE: 'queue_slide', // LPUSH/RPUSH: crate slides into queue
  QUEUE_POP: 'queue_pop', // LPOP/RPOP: crate slides out
  ORBIT_JOIN: 'orbit_join', // SADD: orb spirals into orbit
  ORBIT_LEAVE: 'orbit_leave', // SREM: orb spirals away
  LEADERBOARD_MOVE: 'leaderboard_move', // ZADD/ZINCRBY: rank arrow
  RADIO_WAVE: 'radio_wave', // PUBLISH: expanding arcs
  CRYSTAL_MOVE: 'crystal_move', // RENAME: beam to new home
  ERROR_RIPPLE: 'error_ripple', // a command errored (red ring, teaching moment)
  COMMAND_ECHO: 'command_echo', // fallback for unmapped commands
}

export const EFFECT_KIND_LIST = Object.values(EFFECT_KINDS)
