// src/audio/SoundEngine.js
import { useGameStore } from '../store/gameStore'

class SoundEngine {
  constructor() {
    this.ctx = null
    this.bgmGain = null
    this.sfxGain = null
    this.bgmSource = null
    this.bgmBuffers = {} // Store loaded buffers
  }

  async loadAsset(name, url) {
    try {
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer)
        this.bgmBuffers[name] = audioBuffer
    } catch (e) {
        console.error(`Failed to load BGM asset ${name}:`, e)
    }
  }

  async init() {
    if (this.ctx) return
    if (typeof window === 'undefined' || (!window.AudioContext && !window.webkitAudioContext)) return
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.bgmGain = this.ctx.createGain()
    this.sfxGain = this.ctx.createGain()
    
    // Low-pass filter for a "warmer" retro sound
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2000
    this.bgmGain.connect(filter)
    filter.connect(this.ctx.destination)
    this.sfxGain.connect(this.ctx.destination)

    // Load local assets
    await Promise.all([
        this.loadAsset('exploration', '/src/assets/audio/exploration.mp3'),
        this.loadAsset('action', '/src/assets/audio/action.mp3'),
        this.loadAsset('battle', '/src/assets/audio/battle.mp3'),
        this.loadAsset('dungeon', '/src/assets/audio/dungeon.mp3'),
        this.loadAsset('victory', '/src/assets/audio/victory-boss.mp3')
    ])

    const sync = (state) => {
      if (!this.bgmGain || !this.sfxGain) return
      this.bgmGain.gain.value = state.bgmEnabled ? state.bgmVolume * 0.3 : 0
      this.sfxGain.gain.value = state.sfxEnabled ? state.sfxVolume * 0.5 : 0
    }
    useGameStore.subscribe(sync)
    sync(useGameStore.getState())
  }

  playSFX(type) {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.connect(gain)
    gain.connect(this.sfxGain)

    switch(type) {
        // UI Navigation / Buttons
        case 'nav':
            osc.type = 'square'
            osc.frequency.setValueAtTime(400, now)
            gain.gain.setValueAtTime(0.1, now)
            gain.gain.linearRampToValueAtTime(0, now + 0.05)
            osc.start()
            osc.stop(now + 0.05)
            break
        case 'open':
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(600, now)
            osc.frequency.linearRampToValueAtTime(800, now + 0.1)
            gain.gain.setValueAtTime(0.2, now)
            gain.gain.linearRampToValueAtTime(0, now + 0.1)
            osc.start()
            osc.stop(now + 0.1)
            break
        case 'close':
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(800, now)
            osc.frequency.linearRampToValueAtTime(600, now + 0.1)
            gain.gain.setValueAtTime(0.2, now)
            gain.gain.linearRampToValueAtTime(0, now + 0.1)
            osc.start()
            osc.stop(now + 0.1)
            break
        // Gameplay
        case 'interact':
            osc.type = 'sine'
            osc.frequency.setValueAtTime(500, now)
            gain.gain.setValueAtTime(0.3, now)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08)
            osc.start()
            osc.stop(now + 0.08)
            break
        case 'gem':
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(880, now)
            osc.frequency.linearRampToValueAtTime(1760, now + 0.15)
            gain.gain.setValueAtTime(0, now)
            gain.gain.linearRampToValueAtTime(0.4, now + 0.05)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
            osc.start()
            osc.stop(now + 0.3)
            break
        case 'defeat': // More complex "pop" sound
            const noise = this.ctx.createBufferSource()
            const buf = this.ctx.createBuffer(1, 8192, this.ctx.sampleRate)
            const data = buf.getChannelData(0)
            for(let i=0; i<8192; i++) data[i] = Math.random() * 2 - 1
            noise.buffer = buf
            noise.connect(gain)
            gain.gain.setValueAtTime(0.4, now)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
            noise.start()
            noise.stop(now + 0.4)
            break
        case 'victory':
            osc.type = 'square'
            osc.frequency.setValueAtTime(600, now)
            osc.frequency.setValueAtTime(800, now + 0.1)
            osc.frequency.setValueAtTime(1000, now + 0.2)
            osc.frequency.setValueAtTime(1200, now + 0.3)
            gain.gain.setValueAtTime(0.3, now)
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6)
            osc.start()
            osc.stop(now + 0.6)
            break
    }
  }

  playBGM(regionId, intensity = 1) {
    if (!this.ctx || !this.bgmBuffers['exploration']) return
    if (this.bgmSource) this.bgmSource.stop()
    
    // Map regions to the 5 distinct assets
    const map = {
        'memory-village': 'exploration',
        'key-value-kingdom': 'action',
        'pubsub-city': 'battle',
        'ds-dungeons': 'dungeon',
        'cluster-galaxy': 'victory'
    }
    const assetName = map[regionId] || 'exploration'
    
    this.bgmSource = this.ctx.createBufferSource()
    this.bgmSource.buffer = this.bgmBuffers[assetName]
    this.bgmSource.loop = true
    // Modulate speed/pitch based on intensity
    this.bgmSource.playbackRate.value = 1 + (intensity * 0.2)
    
    this.bgmSource.connect(this.bgmGain)
    this.bgmSource.start()
  }
}
export const soundEngine = new SoundEngine()
