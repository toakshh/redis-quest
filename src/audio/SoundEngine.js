// src/audio/SoundEngine.js
import { useGameStore } from '../store/gameStore'

class SoundEngine {
  constructor() {
    this.ctx = null
    this.bgmGain = null
    this.sfxGain = null
    this.bgmNode = null
  }

  init() {
    if (this.ctx) return
    if (typeof window === 'undefined' || (!window.AudioContext && !window.webkitAudioContext)) {
        return
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.bgmGain = this.ctx.createGain()
    this.sfxGain = this.ctx.createGain()
    this.bgmGain.connect(this.ctx.destination)
    this.sfxGain.connect(this.ctx.destination)

    // Sync from store
    const sync = (state) => {
      if (!this.bgmGain || !this.sfxGain) return
      this.bgmGain.gain.value = state.bgmEnabled ? state.bgmVolume : 0
      this.sfxGain.gain.value = state.sfxEnabled ? state.sfxVolume : 0
    }
    
    // Subscribe to store changes
    useGameStore.subscribe(sync)
    // Initial sync
    sync(useGameStore.getState())
  }

  playSFX(type) {
    if (!this.ctx) return
    if (!useGameStore.getState().sfxEnabled) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.connect(gain)

    // Use sfxGain for SFX control
    gain.connect(this.sfxGain)

    // Simple synth logic for different sounds
    switch(type) {
        case 'gem': // Rising chime
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(440, now)
            osc.frequency.linearRampToValueAtTime(880, now + 0.1)
            gain.gain.setValueAtTime(0, now)
            gain.gain.linearRampToValueAtTime(0.3, now + 0.05)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
            osc.start()
            osc.stop(now + 0.4)
            break
        case 'defeat': // Explosion
            osc.type = 'sawtooth'
            osc.frequency.setValueAtTime(100, now)
            osc.frequency.exponentialRampToValueAtTime(20, now + 0.5)
            gain.gain.setValueAtTime(0.5, now)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
            osc.start()
            osc.stop(now + 0.5)
            break
        case 'click':
            osc.type = 'square'
            osc.frequency.setValueAtTime(600, now)
            gain.gain.setValueAtTime(0.1, now)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
            osc.start()
            osc.stop(now + 0.05)
            break
        case 'shuffle':
            osc.type = 'square'
            osc.frequency.setValueAtTime(200, now)
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1)
            gain.gain.setValueAtTime(0.2, now)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
            osc.start()
            osc.stop(now + 0.1)
            break
        case 'victory': // Celebratory fanfare
            osc.type = 'square'
            osc.frequency.setValueAtTime(440, now)
            osc.frequency.setValueAtTime(554, now + 0.1)
            osc.frequency.setValueAtTime(659, now + 0.2)
            osc.frequency.setValueAtTime(880, now + 0.3)
            gain.gain.setValueAtTime(0.3, now)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6)
            osc.start()
            osc.stop(now + 0.6)
            break
    }
  }

  playBGM() {
    if (!this.ctx) return
    if (this.bgmNode || !useGameStore.getState().bgmEnabled) return
    
    // Simple procedural 8-bit loop
    const osc = this.ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(110, this.ctx.currentTime)
    osc.connect(this.bgmGain)
    osc.start()
    this.bgmNode = osc
  }
}

export const soundEngine = new SoundEngine()
