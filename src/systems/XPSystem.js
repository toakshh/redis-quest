// XPSystem — pure XP economics for Redis Quest.
//
// Every executed command earns XP: a flat base for a successful command, plus
// bonuses for first-time use of a command, rapid successful combos, and clean
// efficiency. Boss defeats and region completions award lump sums. Beginner
// mode applies a generosity multiplier so new players level quickly.
//
// This module is pure (no store, no engine) so it can be unit-tested and the
// store owns the single source of truth for how XP actually gets awarded.

export const XP_BASE = 10
export const XP_FIRST_USE_BONUS = 10
export const XP_COMBO_BONUS = 5
export const XP_EFFICIENCY_BONUS = 5
export const XP_BOSS_DEFEAT = 500
export const XP_REGION_COMPLETE = 1000
export const XP_GOBLIN_PHASE = 30 // small award per boss phase cleared

// Combo window: consecutive successful commands within this many ms of the
// previous command count toward a "combo".
export const COMBO_WINDOW_MS = 10_000

/** Beginner mode earns 1.5x XP; Pro earns the standard 1.0x. */
export function modeMultiplier(mode) {
  return mode === 'beginner' ? 1.5 : 1
}

/**
 * Compute the XP a single executed command should award.
 * @param {object} opts
 * @param {string} opts.name       canonical command name (e.g. 'SET')
 * @param {object} opts.reply      RedisReply; error replies award nothing
 * @param {boolean} opts.isFirstUse first successful use of this command
 * @param {number} opts.comboCount consecutive successful commands in the window
 * @param {boolean} opts.wasEfficient previous command also succeeded
 * @param {string} opts.mode       'beginner' | 'pro'
 * @returns {number} XP awarded (may be 0)
 */
export function xpForCommand({ name, reply, isFirstUse, comboCount, wasEfficient, mode }) {
  if (!reply || reply.type === 'error') return 0
  let xp = XP_BASE
  if (isFirstUse) xp += XP_FIRST_USE_BONUS
  if (comboCount >= 3) xp += XP_COMBO_BONUS
  if (wasEfficient) xp += XP_EFFICIENCY_BONUS
  return Math.round(xp * modeMultiplier(mode))
}

/**
 * Count the current combo streak from a recent-command log (newest first or
 * oldest first — order doesn't matter, it walks the trailing streak).
 * A command is "in the combo" when it succeeded and is within COMBO_WINDOW_MS
 * of the command that followed it.
 * @param {Array<{ok: boolean, at: number}>} log chronological, newest last
 * @returns {number}
 */
export function comboCount(log) {
  let count = 0
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]
    if (!entry.ok) break
    // The gap to the command that FOLLOWED this one (newer) must stay within
    // the window; a slow pause between commands breaks the combo.
    if (i < log.length - 1 && log[i + 1].at - entry.at > COMBO_WINDOW_MS) break
    count++
  }
  return count
}

/** Round a raw XP figure to a friendly integer. */
export function roundXp(xp) {
  return Math.round(xp)
}
