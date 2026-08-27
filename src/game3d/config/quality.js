// Auto-degrade ladder (config/quality.js): below a 50 FPS rolling average,
// step down in order — SSAO off → shadows 2048→1024 → DPR −0.2 → particles halved → bloom mips −1 → volumetric fog off.

export const QUALITY_LADDER = [
  { id: 'ssaoOff', apply: (q) => { q.ssao = false } },
  { id: 'shadows1024', apply: (q) => { q.shadowSize = 1024 } },
  { id: 'dprDrop1', apply: (q) => { q.dprMax -= 0.2 } },
  { id: 'particlesHalved', apply: (q) => { q.particlesMultiplier = 0.5 } },
  { id: 'bloomMipsDown', apply: (q) => { q.bloomMips -= 1 } },
  { id: 'fogOff', apply: (q) => { q.volumetricFog = false } },
]

const DEFAULT_SETTINGS = {
  ssao: true,
  shadowSize: 2048,
  dprMax: 2.0,
  particlesMultiplier: 1.0,
  bloomMips: 4, // Assume standard is 4 or whatever
  volumetricFog: true,
}

export function createQualityManager() {
  let degradedSteps = 0

  return {
    get currentSteps() { return degradedSteps },

    // Return true if settings changed this tick
    update(averageFps) {
      if (averageFps < 50 && degradedSteps < QUALITY_LADDER.length) {
        degradedSteps++
        return true
      }
      if (averageFps > 58 && degradedSteps > 0) {
        degradedSteps--
        return true
      }
      return false
    },

    getSettings() {
      // Rebuild settings from default applying up to current tier
      const settings = { ...DEFAULT_SETTINGS }
      for (let i = 0; i < degradedSteps; i++) {
        QUALITY_LADDER[i].apply(settings)
      }
      return settings
    },

    reset() {
      degradedSteps = 0
    }
  }
}
