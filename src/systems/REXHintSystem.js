// REXHintSystem — the 4-level progressive hint state machine.
//
// Hints *teach, don't solve*: each level reveals one more step, and only when
// the player is stuck. Every situation (command, region, boss, tutorial step)
// carries its own independent hint level, so success in one place never spoils
// another.
//
//   Level 1  Gentle Nudge   ambient, vague, encourages thinking
//   Level 2  Concept Pointer  points at the Redis *concept*, not the command
//   Level 3  Syntax Clue      shows the command structure with placeholders
//   Level 4  Direct Example   the exact command for the current situation
//
// Triggers (per spec):
//   L1: idle >30s, repeated failures, entering a new area
//   L2: L1 shown 2x, or player asks "what do I do?"
//   L3: L2 shown 2x, or player types "help" / "?"
//   L4: L3 shown 2x, 3+ failed attempts, or explicit "HELP ME"
//
// Hints decay: a success resets the situation back to the entry level.
// Pro Mode starts at level 2 and never shows level 4; Beginner Mode uses the
// full 1→4 ladder with longer cooldowns.
//
// The system is deliberately pure and event-driven: the store feeds it
// commands/idle/help events and reads back the level to show. State is plain
// JSON (serialize/hydrate) so save/load is trivial.

export const HINT_LEVELS = {
  NUDGE: 1,
  CONCEPT: 2,
  SYNTAX: 3,
  EXAMPLE: 4,
}

export const MODE_CONFIG = {
  beginner: {
    minLevel: HINT_LEVELS.NUDGE,
    maxLevel: HINT_LEVELS.EXAMPLE,
    idleThresholdMs: 30000, // spec: idle >30s triggers the first nudge
    idleCooldownMs: 45000, // don't nag every tick while idle
    repeatThreshold: 2, // same level shown twice → escalate
    escalationCooldownMs: 20000, // "longer cooldowns" in beginner mode
    jumpToMaxFailures: 3, // 3+ failed attempts → direct example
    nudgeAtFailures: 2, // 2 failures → bump a level
  },
  pro: {
    minLevel: HINT_LEVELS.CONCEPT, // starts at Level 2
    maxLevel: HINT_LEVELS.SYNTAX, // never a direct example
    idleThresholdMs: 45000, // fewer, later hints
    idleCooldownMs: 30000,
    repeatThreshold: 3,
    escalationCooldownMs: 10000,
    jumpToMaxFailures: 5,
    nudgeAtFailures: 3,
  },
}

export function createREXHintSystem({ mode = 'beginner', now = () => Date.now() } = {}) {
  const situations = new Map() // id -> situation state

  function config() {
    return MODE_CONFIG[mode]
  }

  function ensure(id) {
    if (!situations.has(id)) {
      situations.set(id, {
        level: config().minLevel,
        shownAtLevel: 0,
        failures: 0,
        lastShownAt: 0,
        lastEscalatedAt: 0,
        enteredAt: 0,
      })
    }
    return situations.get(id)
  }

  function clampLevel(level) {
    const { minLevel, maxLevel } = config()
    return Math.max(minLevel, Math.min(maxLevel, level))
  }

  function escalate(s, at) {
    const { maxLevel, escalationCooldownMs } = config()
    if (at - s.lastEscalatedAt < escalationCooldownMs) return false
    if (s.level >= maxLevel) return false
    s.level = clampLevel(s.level + 1)
    s.shownAtLevel = 0
    s.lastEscalatedAt = at
    return true
  }

  // ---------- events ----------

  // Every executed command. `ok` = reply was not an error. Success resets the
  // situation (hint decay); failure escalates toward a concrete answer.
  function onCommand(id, ok, at = now()) {
    const s = ensure(id)
    if (ok) {
      s.level = config().minLevel
      s.shownAtLevel = 0
      s.failures = 0
      return { level: s.level, escalated: false, reset: true }
    }

    s.failures++
    s.lastShownAt = at
    const { jumpToMaxFailures, nudgeAtFailures, maxLevel } = config()
    if (s.failures >= jumpToMaxFailures) {
      if (s.level < maxLevel) {
        s.level = maxLevel
        s.lastEscalatedAt = at
        return { level: s.level, escalated: true }
      }
      return { level: s.level, escalated: false }
    }
    if (s.failures >= nudgeAtFailures) {
      const did = escalate(s, at)
      return { level: s.level, escalated: did }
    }
    // A single failure nudges toward showing a hint (counts as one "shown").
    s.shownAtLevel++
    return { level: s.level, escalated: false }
  }

  // REX displayed the current level's hint. Repeat hints escalate.
  function onHintShown(id, at = now()) {
    const s = ensure(id)
    s.shownAtLevel++
    s.lastShownAt = at
    const did = s.shownAtLevel >= config().repeatThreshold ? escalate(s, at) : false
    return { level: s.level, escalated: did }
  }

  // Idle ticks. Returns the level to hint at, or null if not time yet.
  function onIdle(id, elapsedMs, at = now()) {
    const s = ensure(id)
    const { idleThresholdMs, idleCooldownMs } = config()
    if (elapsedMs < idleThresholdMs) return null
    if (at - s.lastShownAt < idleCooldownMs) return null
    s.lastShownAt = at
    return onHintShown(id, at).level
  }

  // Entering a new area resets exploration state and starts at the entry level.
  function onEnterRegion(id, at = now()) {
    const s = ensure(id)
    s.level = config().minLevel
    s.shownAtLevel = 0
    s.failures = 0
    s.enteredAt = at
    return s.level
  }

  // Player asked for help. kind: 'what-do-i-do' | 'help' | '?' | 'help-me'
  function onAskHelp(id, kind, at = now()) {
    const s = ensure(id)
    s.lastShownAt = at
    switch (kind) {
      case 'what-do-i-do':
        s.level = clampLevel(Math.max(s.level, HINT_LEVELS.CONCEPT))
        break
      case 'help':
      case '?':
        s.level = clampLevel(Math.max(s.level, HINT_LEVELS.SYNTAX))
        break
      case 'help-me':
        s.level = config().maxLevel // direct example (or pro cap)
        break
      default:
        break
    }
    return s.level
  }

  // Read the current level without mutating (for "hint tip" UI).
  function levelFor(id) {
    return situations.has(id) ? situations.get(id).level : config().minLevel
  }

  function situationIds() {
    return [...situations.keys()]
  }

  function setMode(nextMode) {
    mode = MODE_CONFIG[nextMode] ? nextMode : 'beginner'
    const { minLevel, maxLevel } = config()
    for (const s of situations.values()) s.level = clampLevel(s.level)
    return mode
  }

  function reset() {
    situations.clear()
  }

  function serialize() {
    return {
      mode,
      situations: Object.fromEntries(
        [...situations.entries()].map(([id, s]) => [id, { ...s }]),
      ),
    }
  }

  function hydrate(state) {
    if (!state) return
    if (state.mode) setMode(state.mode)
    if (state.situations) {
      situations.clear()
      for (const [id, s] of Object.entries(state.situations)) {
        situations.set(id, { ...s })
      }
    }
  }

  return {
    onCommand,
    onHintShown,
    onIdle,
    onEnterRegion,
    onAskHelp,
    levelFor,
    situationIds,
    setMode,
    get mode() {
      return mode
    },
    config,
    reset,
    serialize,
    hydrate,
  }
}
