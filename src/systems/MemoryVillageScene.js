// MemoryVillageScene — renders the Memory Village region and its interactive elements.
// Visual effects for each Redis command create observable world changes.

export const VILLAGE_ELEMENTS = {
  well: {
    id: 'memory-well',
    name: 'Memory Well',
    description: 'A crystalline well that stores memories as glowing crystals.',
    slots: 8,
    crystals: [], // { key, value, color, createdAt }
  },
  cave: {
    id: 'goblin-cave',
    name: 'Goblin Cave',
    description: 'The Memory Goblin\'s lair. Corrupted memories seep from within.',
    isOpen: false,
    corruptionLevel: 0,
  },
  crystals: {
    // Floating memory crystals around the village
    ambient: [],
    maxAmbient: 12,
  },
}

// Color palette for memory crystals by data type / value hash
const CRYSTAL_COLORS = [
  '#00ffff', // cyan
  '#ff6b35', // orange
  '#7fff00', // lime
  '#ff1493', // pink
  '#00bfff', // deep sky blue
  '#ffd700', // gold
  '#da70d6', // orchid
  '#32cd32', // lime green
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function colorForValue(value) {
  const idx = hashString(String(value)) % CRYSTAL_COLORS.length
  return CRYSTAL_COLORS[idx]
}

/**
 * Create a visual effect for SET command - spawns a crystal at the well.
 */
export function createSetEffect({ key, value, well }) {
  const crystal = {
    id: `crystal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key,
    value: String(value).slice(0, 50),
    color: colorForValue(value),
    createdAt: Date.now(),
    animation: 'spawn',
    // Position: flies from player toward well, then slots in
    startPos: { x: 50, y: 80 }, // player area (bottom center)
    endPos: { x: 50, y: 30 },   // well shelf area (top center)
    slotIndex: well.crystals.length % well.slots,
  }
  well.crystals.push(crystal)
  return {
    type: 'set-crystal-spawn',
    crystal,
    duration: 800, // ms
  }
}

/**
 * Create a visual effect for GET command - retrieval beam from well to player.
 */
export function createGetEffect({ key, value, well, found }) {
  const crystal = well.crystals.find((c) => c.key === key)
  return {
    type: 'get-retrieval-beam',
    key,
    value: found ? String(value).slice(0, 50) : null,
    found,
    crystalColor: crystal?.color || '#888',
    duration: 1000,
    // Beam from well to player
    startPos: { x: 50, y: 30 },
    endPos: { x: 50, y: 80 },
  }
}

/**
 * Create a visual effect for INCR command - counter pulse on crystal.
 */
export function createIncrEffect({ key, newValue, well }) {
  const crystal = well.crystals.find((c) => c.key === key)
  return {
    type: 'incr-counter-pulse',
    key,
    newValue,
    crystalColor: crystal?.color || '#ffd700',
    duration: 600,
    // Pulse at crystal's slot position
    position: crystal ? { x: 50, y: 30 } : { x: 50, y: 50 },
  }
}

/**
 * Create a visual effect for EXPIRE command - golden countdown halo.
 */
export function createExpireEffect({ key, ttl, well }) {
  const crystal = well.crystals.find((c) => c.key === key)
  return {
    type: 'expire-golden-halo',
    key,
    ttl,
    crystalColor: crystal?.color || '#ffd700',
    duration: 1200,
    // Halo around the crystal
    position: crystal ? { x: 50, y: 30 } : { x: 50, y: 50 },
  }
}

/**
 * Create a visual effect for TTL command - floating countdown number.
 */
export function createTtlEffect({ key, ttl, well }) {
  const crystal = well.crystals.find((c) => c.key === key)
  return {
    type: 'ttl-floating-countdown',
    key,
    ttl,
    crystalColor: crystal?.color || '#00bfff',
    duration: 1500,
    // Floating above the crystal
    position: crystal ? { x: 50, y: 25 } : { x: 50, y: 45 },
  }
}

/**
 * Create effect for key expiry - crystal poofs away.
 */
export function createExpirePoofEffect({ key, well }) {
  const idx = well.crystals.findIndex((c) => c.key === key)
  if (idx === -1) return null
  const crystal = well.crystals[idx]
  well.crystals.splice(idx, 1)
  return {
    type: 'expire-poof',
    key,
    crystalColor: crystal.color,
    duration: 500,
    position: { x: 50, y: 30 },
  }
}

/**
 * Create effect for FLUSHDB - all crystals shatter.
 */
export function createFlushEffect({ well }) {
  const crystals = [...well.crystals]
  well.crystals = []
  return {
    type: 'flush-shatter',
    crystals: crystals.map((c) => ({ color: c.color, key: c.key })),
    duration: 1500,
  }
}

/**
 * Memory Village Scene class - manages the visual state of the village.
 */
export class MemoryVillageScene {
  constructor() {
    this.well = { ...VILLAGE_ELEMENTS.well, crystals: [] }
    this.cave = { ...VILLAGE_ELEMENTS.cave }
    this.ambientCrystals = []
    this.activeEffects = []
    this.effectIdCounter = 0
  }

  /**
   * Process a command event from the engine and generate visual effects.
   */
  processCommandEvent(event) {
    const { name, args, reply } = event
    const cmd = name.toUpperCase()
    let effect = null

    switch (cmd) {
      case 'SET':
        if (reply?.type !== 'error' && args.length >= 3) {
          effect = createSetEffect({ key: args[1], value: args[2], well: this.well })
        }
        break
      case 'GET':
        if (args.length >= 2) {
          const key = args[1]
          const crystal = this.well.crystals.find((c) => c.key === key)
          effect = createGetEffect({
            key,
            value: reply?.value ?? null,
            well: this.well,
            found: !!crystal && reply?.type !== 'nil',
          })
        }
        break
      case 'INCR':
        if (reply?.type !== 'error' && args.length >= 2) {
          effect = createIncrEffect({ key: args[1], newValue: reply.value, well: this.well })
        }
        break
      case 'EXPIRE':
        if (reply?.type !== 'error' && args.length >= 3) {
          effect = createExpireEffect({ key: args[1], ttl: parseInt(args[2]), well: this.well })
        }
        break
      case 'TTL':
        if (args.length >= 2) {
          const ttl = reply?.type === 'integer' ? reply.value : -2 // -2 = no expiry
          effect = createTtlEffect({ key: args[1], ttl, well: this.well })
        }
        break
      case 'FLUSHDB':
        if (reply?.type !== 'error') {
          effect = createFlushEffect({ well: this.well })
        }
        break
      // Engine will emit 'expired' event for auto-expiry
    }

    if (effect) {
      const effectId = `effect-${++this.effectIdCounter}`
      this.activeEffects.push({ ...effect, id: effectId, startedAt: Date.now() })
      // Auto-cleanup after duration
      setTimeout(() => {
        this.activeEffects = this.activeEffects.filter((e) => e.id !== effectId)
      }, effect.duration + 100)
    }

    return effect
  }

  /**
   * Handle engine 'expired' event - crystal poofs away.
   */
  handleExpiredEvent(key) {
    const effect = createExpirePoofEffect({ key, well: this.well })
    if (effect) {
      const effectId = `effect-${++this.effectIdCounter}`
      this.activeEffects.push({ ...effect, id: effectId, startedAt: Date.now() })
      setTimeout(() => {
        this.activeEffects = this.activeEffects.filter((e) => e.id !== effectId)
      }, effect.duration + 100)
    }
  }

  /**
   * Spawn ambient crystals periodically for atmosphere.
   */
  spawnAmbientCrystal() {
    if (this.ambientCrystals.length >= VILLAGE_ELEMENTS.crystals.maxAmbient) return
    const crystal = {
      id: `ambient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color: CRYSTAL_COLORS[Math.floor(Math.random() * CRYSTAL_COLORS.length)],
      x: 10 + Math.random() * 80,
      y: 20 + Math.random() * 60,
      driftX: (Math.random() - 0.5) * 0.5,
      driftY: -0.1 - Math.random() * 0.2,
      life: 10000 + Math.random() * 20000,
      spawnedAt: Date.now(),
    }
    this.ambientCrystals.push(crystal)
  }

  /**
   * Update ambient crystals (drift, fade).
   */
  updateAmbient(dt) {
    const now = Date.now()
    this.ambientCrystals = this.ambientCrystals.filter((c) => {
      c.x += c.driftX * dt
      c.y += c.driftY * dt
      return now - c.spawnedAt < c.life
    })
    // Spawn new ones occasionally
    if (Math.random() < 0.01 * dt) this.spawnAmbientCrystal()
  }

  /**
   * Update all active effects (progress animations).
   */
  updateEffects(dt) {
    this.activeEffects = this.activeEffects.filter((e) => {
      const elapsed = Date.now() - e.startedAt
      return elapsed < e.duration
    })
  }

  /**
   * Get current scene state for rendering.
   */
  getState() {
    return {
      well: {
        slots: this.well.slots,
        crystals: this.well.crystals.map((c) => ({
          id: c.id,
          key: c.key,
          value: c.value,
          color: c.color,
          slotIndex: c.slotIndex,
          animation: c.animation,
        })),
      },
      cave: {
        isOpen: this.cave.isOpen,
        corruptionLevel: this.cave.corruptionLevel,
      },
      ambientCrystals: this.ambientCrystals.map((c) => ({
        id: c.id,
        color: c.color,
        x: c.x,
        y: c.y,
        opacity: Math.max(0, 1 - (Date.now() - c.spawnedAt) / c.life),
      })),
      activeEffects: this.activeEffects.map((e) => ({
        id: e.id,
        type: e.type,
        progress: Math.min(1, (Date.now() - e.startedAt) / e.duration),
        ...e,
      })),
    }
  }

  /**
   * Open the goblin cave (when boss battle starts).
   */
  openCave() {
    this.cave.isOpen = true
    this.cave.corruptionLevel = 0
  }

  /**
   * Update cave corruption level (0-1).
   */
  setCorruptionLevel(level) {
    this.cave.corruptionLevel = Math.max(0, Math.min(1, level))
  }

  /**
   * Reset scene for new game.
   */
  reset() {
    this.well.crystals = []
    this.cave.isOpen = false
    this.cave.corruptionLevel = 0
    this.ambientCrystals = []
    this.activeEffects = []
  }
}

/**
 * Factory for creating the scene.
 */
export function createMemoryVillageScene() {
  return new MemoryVillageScene()
}