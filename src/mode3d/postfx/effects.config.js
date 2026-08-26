/**
 * Post-processing effect presets for LOOP // NULL_POINTER
 * Chromatic aberration, vignette, bloom, noise, DOF, SSAO configurations
 */

export const EFFECT_PRESETS = {
  /** Normal baseline - clean, stable simulation */
  NORMAL: {
    chromaticOffset: 0.0,
    vignetteDarkness: 0.15,
    bloomIntensity: 0.4,
    bloomThreshold: 0.85,
    noiseOpacity: 0.02,
    dofFocusDistance: 50,
    dofFocalLength: 50,
    ssaoRadius: 0.3,
    ssaoIntensity: 0.8,
  },

  /** Low sanity - reality fraying at edges */
  LOW_SANITY: {
    chromaticOffset: 0.008,
    vignetteDarkness: 0.35,
    bloomIntensity: 0.85,
    bloomThreshold: 0.65,
    noiseOpacity: 0.12,
    dofFocusDistance: 15,
    dofFocalLength: 35,
    ssaoRadius: 0.5,
    ssaoIntensity: 1.4,
  },

  /** Critical sanity - hallucinations, visual corruption */
  CRITICAL_SANITY: {
    chromaticOffset: 0.025,
    vignetteDarkness: 0.6,
    bloomIntensity: 1.6,
    bloomThreshold: 0.45,
    noiseOpacity: 0.28,
    dofFocusDistance: 8,
    dofFocalLength: 20,
    ssaoRadius: 0.8,
    ssaoIntensity: 2.2,
  },

  /** Loop transition - temporal distortion, reverse-time feel */
  LOOP_TRANSITION: {
    chromaticOffset: 0.04,
    vignetteDarkness: 0.8,
    bloomIntensity: 2.5,
    bloomThreshold: 0.3,
    noiseOpacity: 0.45,
    dofFocusDistance: 3,
    dofFocalLength: 12,
    ssaoRadius: 1.2,
    ssaoIntensity: 3.0,
  },

  /** Damage flash - brief high-intensity hit reaction */
  DAMAGE_FLASH: {
    chromaticOffset: 0.015,
    vignetteDarkness: 0.5,
    bloomIntensity: 2.0,
    bloomThreshold: 0.2,
    noiseOpacity: 0.35,
    dofFocusDistance: 10,
    dofFocalLength: 25,
    ssaoRadius: 0.6,
    ssaoIntensity: 1.8,
  },
}

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Interpolate between two effect preset objects
 * @param {Object} from - Source preset
 * @param {Object} to - Target preset
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {Object} Interpolated effect parameters
 */
export function lerpEffects(from, to, t) {
  const clampedT = Math.max(0, Math.min(1, t))
  const result = {}

  for (const key of Object.keys(from)) {
    if (typeof from[key] === 'number' && typeof to[key] === 'number') {
      result[key] = lerp(from[key], to[key], clampedT)
    } else {
      result[key] = clampedT < 0.5 ? from[key] : to[key]
    }
  }

  return result
}

/**
 * Get effect preset by name with optional override
 * @param {string} name - Preset name (NORMAL, LOW_SANITY, CRITICAL_SANITY, LOOP_TRANSITION, DAMAGE_FLASH)
 * @param {Object} overrides - Optional parameter overrides
 * @returns {Object} Effect preset with overrides applied
 */
export function getEffectPreset(name, overrides = {}) {
  const preset = EFFECT_PRESETS[name] || EFFECT_PRESETS.NORMAL
  return { ...preset, ...overrides }
}

/**
 * Compute current effect state based on game conditions
 * @param {Object} state - Game state { sanity, damageFlash, isLooping, loopProgress }
 * @returns {Object} Computed effect parameters
 */
export function computeEffectsFromState(state) {
  const { sanity = 100, damageFlash = 0, isLooping = false, loopProgress = 0 } = state

  // Base preset selection based on sanity
  let basePreset
  if (sanity > 70) basePreset = EFFECT_PRESETS.NORMAL
  else if (sanity > 30) basePreset = EFFECT_PRESETS.LOW_SANITY
  else basePreset = EFFECT_PRESETS.CRITICAL_SANITY

  // Apply loop transition overlay
  if (isLooping) {
    return lerpEffects(basePreset, EFFECT_PRESETS.LOOP_TRANSITION, loopProgress)
  }

  // Apply damage flash overlay
  if (damageFlash > 0) {
    return lerpEffects(basePreset, EFFECT_PRESETS.DAMAGE_FLASH, damageFlash)
  }

  return basePreset
}

export default {
  EFFECT_PRESETS,
  lerp,
  lerpEffects,
  getEffectPreset,
  computeEffectsFromState,
}