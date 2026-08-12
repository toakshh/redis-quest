// REXPersonality — chooses what REX says and how REX's voice adapts.
//
// REX is not one flat voice: it has four personality traits (curiosity, humor,
// wisdom, sternness) that shine in different regions, it reacts to what the
// player just did (success, error, expired key...), and it reads the player's
// playstyle — rushed vs careful, experimental vs by-the-book — to pick tone and
// length. All text is data in src/data/rex-dialogue/.
//
// Playstyle is learned from observations (command timing, first-time commands,
// failure rate) and persisted so the voice stays consistent across sessions.

// Dominant trait per region (the "flavor" REX leans into there).
const REGION_TRAIT = {
  'memory-village': 'curiosity',
  'string-forest': 'curiosity',
  'list-harbor': 'humor',
  'set-caverns': 'sternness',
  'hash-city': 'wisdom',
  'leaderboard-arena': 'humor',
  'performance-lab': 'sternness',
  'script-temple': 'wisdom',
  'redis-core': 'sternness',
}
const DEFAULT_TRAIT = 'curiosity'
const TRAITS = ['curiosity', 'humor', 'wisdom', 'sternness']

// Cadence buckets (ms between commands) → pace playstyle.
const RUSHED_MS = 2000
const CAREFUL_MS = 6000

const MAX_CADENCE_SAMPLES = 12

function pick(arr, rng) {
  if (!arr || arr.length === 0) return ''
  return arr[Math.floor(rng() * arr.length)]
}

// Avoid repeating the same line twice in a row for the same slot.
function pickNoRepeat(slot, arr, rng) {
  if (!arr || arr.length === 0) return ''
  if (arr.length === 1) return arr[0]
  let i = Math.floor(rng() * arr.length)
  if (i === slot.last) i = (i + 1) % arr.length
  slot.last = i
  return arr[i]
}

export function createREXPersonality({
  dialogue,
  rng = Math.random,
  now = () => Date.now(),
} = {}) {
  const region = (id) => (dialogue && dialogue[id]) || null

  // Persistent learning state.
  const state = {
    cadenceSamples: [],
    uniqueCommands: new Set(),
    totalCommands: 0,
    failures: 0,
    traitsSeen: [], // region ids that surfaced a personality trait
  }
  const lastSlot = {} // key -> last line index, for no-repeat picking

  function dlg(regionId, path) {
    const base = region(regionId) || (dialogue && dialogue.generic) || {}
    return (base[path] ?? {}) // per-region section
  }

  function lineFor(regionId, path, fallbackArr, rngFn = pickNoRepeat) {
    const own = dlg(regionId, path)
    const arr = (own && Array.isArray(own) && own) || (own && own[path]) || fallbackArr
    const slot = lastSlot[`${regionId}:${path}`] || (lastSlot[`${regionId}:${path}`] = {})
    return rngFn(slot, arr, rng)
  }

  // ---------- hint / intro text ----------

  function pickHint(regionId, level) {
    const hints = dlg(regionId, 'hints')
    const arr = hints && hints[String(level)]
    const genericHints = (dialogue && dialogue.generic)?.hints?.[String(level)] || []
    const src = (arr && arr.length ? arr : genericHints)
    return pickNoRepeat((lastSlot[`hint:${regionId}:${level}`] || (lastSlot[`hint:${regionId}:${level}`] = {})), src, rng)
  }

  function pickIntro(regionId) {
    return lineFor(regionId, 'intro', (dialogue && dialogue.generic)?.intro, pick)
  }

  // ---------- reactions ----------

  // kind: ok | okFirst | error | wrongtype | unknown | expired | syntax
  function react(kind, regionId) {
    const own = dlg(regionId, 'reactions')
    const arr = own && own[kind]
    const genericArr = (dialogue && dialogue.generic)?.reactions?.[kind] || []
    return pickNoRepeat(
      lastSlot[`react:${regionId}:${kind}`] || (lastSlot[`react:${regionId}:${kind}`] = {}),
      (arr && arr.length ? arr : genericArr),
      rng,
    )
  }

  // ---------- personality trait lines ----------

  function dominantTrait(regionId) {
    return REGION_TRAIT[regionId] || DEFAULT_TRAIT
  }

  function pickTraitLine(regionId) {
    const dominant = dominantTrait(regionId)
    // 55% dominant, otherwise any trait — so each region has a voice but stays varied.
    const trait = rng() < 0.55 ? dominant : TRAITS[Math.floor(rng() * TRAITS.length)]
    if (!state.traitsSeen.includes(regionId)) state.traitsSeen.push(regionId)
    const own = dlg(regionId, 'personality')
    const arr = (own && own[trait]) || (dialogue && dialogue.personalities)?.traits?.[trait]?.lines || []
    return pickNoRepeat(
      lastSlot[`trait:${regionId}:${trait}`] || (lastSlot[`trait:${regionId}:${trait}`] = {}),
      arr,
      rng,
    )
  }

  // ---------- playstyle learning ----------

  // observation: { at, ok, isFirst, regionId }
  function observe({ at, ok, isFirst } = {}) {
    state.totalCommands++
    if (!ok) state.failures++
    if (isFirst) state.uniqueCommands.add(isFirst)

    const last = state.cadenceSamples.length
      ? state.cadenceSamples[state.cadenceSamples.length - 1]
      : null
    if (last && at) {
      const delta = Math.max(0, at - last)
      if (delta > 0) state.cadenceSamples.push(delta)
      if (state.cadenceSamples.length > MAX_CADENCE_SAMPLES) state.cadenceSamples.shift()
    }
    if (at) state.cadenceSamples[state.cadenceSamples.length - 1] = at
  }

  function pace() {
    const samples = state.cadenceSamples.filter((v) => typeof v === 'number' && v > 0)
    if (samples.length === 0) return 'steady'
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length
    if (avg < RUSHED_MS) return 'rushed'
    if (avg > CAREFUL_MS) return 'careful'
    return 'steady'
  }

  function style() {
    const firstRatio = state.totalCommands > 0 ? state.uniqueCommands.size / state.totalCommands : 0
    const failRatio = state.totalCommands > 0 ? state.failures / state.totalCommands : 0
    // High first-time ratio + moderate failures → experimenting; otherwise steady/belief.
    if (firstRatio > 0.5) return 'experimental'
    if (failRatio > 0.4 && firstRatio > 0.25) return 'experimental'
    return 'byTheBook'
  }

  function pickPlaystyle() {
    const p = pace()
    const s = style()
    const voices = (dialogue && dialogue.personalities)?.playstyle || {}
    const pools = [p && voices[p], s === 'experimental' ? voices.experimental : voices.byTheBook]
    const arr = (pools[0] || [])
      .concat(rng() < 0.5 ? pools[1] || [] : [])
      .filter(Boolean)
    const src = arr.length ? arr : [voices.steady ? voices.steady[0] : ''].filter(Boolean)
    return pickNoRepeat((lastSlot.playstyle || (lastSlot.playstyle = {})), src, rng)
  }

  function playstyleTags() {
    return { pace: pace(), style: style() }
  }

  // ---------- structured lines (boss / tutorial / mode) ----------

  function pickGroup(group, kind) {
    const section = (dialogue && dialogue.personalities)?.[group] || {}
    const arr = section[kind] || []
    return pickNoRepeat(
      lastSlot[`group:${group}:${kind}`] || (lastSlot[`group:${group}:${kind}`] = {}),
      arr,
      rng,
    )
  }

  const pickBoss = (kind) => pickGroup('boss', kind)
  const pickTutorial = (kind) => pickGroup('tutorial', kind)
  const pickMode = (kind) => pickGroup('mode', kind)

  // ---------- persistence ----------

  function serialize() {
    return {
      traitsSeen: state.traitsSeen,
      cadenceSamples: state.cadenceSamples,
      uniqueCommands: [...state.uniqueCommands],
      totalCommands: state.totalCommands,
      failures: state.failures,
    }
  }

  function hydrate(saved) {
    if (!saved) return
    if (Array.isArray(saved.traitsSeen)) state.traitsSeen = saved.traitsSeen
    if (Array.isArray(saved.cadenceSamples)) state.cadenceSamples = saved.cadenceSamples
    if (Array.isArray(saved.uniqueCommands)) state.uniqueCommands = new Set(saved.uniqueCommands)
    if (typeof saved.totalCommands === 'number') state.totalCommands = saved.totalCommands
    if (typeof saved.failures === 'number') state.failures = saved.failures
  }

  return {
    pickHint,
    pickIntro,
    react,
    pickTraitLine,
    dominantTrait,
    observe,
    playstyleTags,
    pickPlaystyle,
    pickBoss,
    pickTutorial,
    pickMode,
    serialize,
    hydrate,
  }
}
