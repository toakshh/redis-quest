// Juice & Polish system: screen shake, hit pause, particle pooling, flash, color grading

import { eventBus, EVENTS } from '../engine/EventBus.js'

// Particle pool for high-performance rendering
class ParticlePool {
  constructor(maxParticles = 500) {
    this.maxParticles = maxParticles
    this.particles = new Array(maxParticles)
    this.active = new Set()
    this.free = new Set()
    for (let i = 0; i < maxParticles; i++) {
      this.free.add(i)
      this.particles[i] = this.createParticle()
    }
  }

  createParticle() {
    return {
      x: 0, y: 0,
      vx: 0, vy: 0,
      ax: 0, ay: 0,
      color: '#22d3ee',
      size: 4,
      life: 1000,
      maxLife: 1000,
      alpha: 1,
      shape: 'circle', // 'circle' | 'square' | 'line' | 'text'
      rotation: 0,
      rotationSpeed: 0,
      text: '',
      // For trails
      trailPoints: [],
      connect: false,
    }
  }

  // Acquire a particle from pool
  acquire(config = {}) {
    if (this.free.size === 0) return null // Pool exhausted
    const index = this.free.values().next().value
    this.free.delete(index)
    this.active.add(index)

    const p = this.particles[index]
    // Reset and apply config
    p.x = config.x || 0
    p.y = config.y || 0
    p.vx = config.vx || (Math.random() - 0.5) * 4
    p.vy = config.vy || (Math.random() - 0.5) * 4
    p.ax = config.ax || 0
    p.ay = config.ay || 0.02 // gravity
    p.color = config.color || '#22d3ee'
    p.size = config.size || 4
    p.life = config.life || 1000
    p.maxLife = p.life
    p.alpha = 1
    p.shape = config.shape || 'circle'
    p.rotation = 0
    p.rotationSpeed = config.rotationSpeed || 0
    p.text = config.text || ''
    p.trailPoints = []
    p.connect = config.connect || false
    return index
  }

  // Release particle back to pool
  release(index) {
    if (this.active.has(index)) {
      this.active.delete(index)
      this.free.add(index)
    }
  }

  // Update all active particles
  update(deltaMs) {
    for (const index of this.active) {
      const p = this.particles[index]
      p.life -= deltaMs
      if (p.life <= 0) {
        this.release(index)
        continue
      }
      // Physics
      p.vx += p.ax
      p.vy += p.ay
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.rotationSpeed
      p.alpha = p.life / p.maxLife

      // Trail points for connect effect
      if (p.connect) {
        p.trailPoints.push({ x: p.x, y: p.y })
        if (p.trailPoints.length > 10) p.trailPoints.shift()
      }
    }
  }

  // Render all active particles to canvas context
  render(ctx) {
    for (const index of this.active) {
      const p = this.particles[index]
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)

      switch (p.shape) {
        case 'circle': {
          ctx.beginPath()
          ctx.arc(0, 0, p.size * p.alpha, 0, Math.PI * 2)
          ctx.fillStyle = p.color
          ctx.fill()
          break
        }
        case 'square': {
          const s = p.size * p.alpha
          ctx.fillStyle = p.color
          ctx.fillRect(-s/2, -s/2, s, s)
          break
        }
        case 'line': {
          ctx.beginPath()
          ctx.moveTo(-p.size, 0)
          ctx.lineTo(p.size, 0)
          ctx.strokeStyle = p.color
          ctx.lineWidth = 2
          ctx.stroke()
          break
        }
        case 'text': {
          ctx.font = `${p.size}px monospace`
          ctx.fillStyle = p.color
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(p.text || '0', 0, 0)
          break
        }
        case 'star': {
          const s = p.size * p.alpha
          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI / 5) - Math.PI / 2
            const x = Math.cos(angle) * s
            const y = Math.sin(angle) * s
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.fillStyle = p.color
          ctx.fill()
          break
        }
        case 'cube': {
          const s = p.size * p.alpha
          // Isometric cube projection
          ctx.beginPath()
          ctx.moveTo(0, -s)
          ctx.lineTo(s * 0.866, -s * 0.5)
          ctx.lineTo(s * 0.866, s * 0.5)
          ctx.lineTo(0, s)
          ctx.lineTo(-s * 0.866, s * 0.5)
          ctx.lineTo(-s * 0.866, -s * 0.5)
          ctx.closePath()
          ctx.strokeStyle = p.color
          ctx.lineWidth = 1.5
          ctx.stroke()
          break
        }
      }

      // Connect trail lines
      if (p.connect && p.trailPoints.length > 1) {
        ctx.beginPath()
        ctx.moveTo(p.trailPoints[0].x - p.x, p.trailPoints[0].y - p.y)
        for (let i = 1; i < p.trailPoints.length; i++) {
          ctx.lineTo(p.trailPoints[i].x - p.x, p.trailPoints[i].y - p.y)
        }
        ctx.strokeStyle = p.color
        ctx.globalAlpha = p.alpha * 0.5
        ctx.lineWidth = 1
        ctx.stroke()
      }

      ctx.restore()
    }
  }

  // Burst particles at position
  burst(x, y, count, config = {}) {
    const indices = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const speed = config.speed || 3
      const index = this.acquire({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ...config,
      })
      if (index !== null) indices.push(index)
    }
    return indices
  }

  // Get active count
  getActiveCount() {
    return this.active.size
  }

  clear() {
    for (const index of this.active) {
      this.free.add(index)
    }
    this.active.clear()
  }
}

// Main Juice System
export class JuiceSystem {
  constructor() {
    this.particlePool = new ParticlePool(500)

    // Screen shake state
    this.shakeIntensity = 0
    this.shakeDuration = 0
    this.shakeTime = 0
    this.shakeOffset = { x: 0, y: 0 }

    // Hit pause state
    this.hitPauseFrames = 0
    this.hitPauseTimer = 0

    // Flash state
    this.flashColor = null
    this.flashDuration = 0
    this.flashTime = 0
    this.flashAlpha = 0

    // Color grading / post-processing
    this.colorGrade = {
      saturation: 1,
      contrast: 1,
      brightness: 1,
      hueRotate: 0,
      vignette: 0,
    }
    this.colorGradeTarget = { ...this.colorGrade }
    this.colorGradeSpeed = 5 // per second

    // Micro-animations queue
    this.microAnimations = []

    // Event listeners
    this._boundHandlers = {
      shake: this._onShake.bind(this),
      hitPause: this._onHitPause.bind(this),
      particles: this._onParticles.bind(this),
      flash: this._onFlash.bind(this),
    }
    this._attachListeners()
  }

  _attachListeners() {
    eventBus.on(EVENTS.SCREEN_SHAKE, this._boundHandlers.shake)
    eventBus.on(EVENTS.HIT_PAUSE, this._boundHandlers.hitPause)
    eventBus.on(EVENTS.PARTICLE_BURST, this._boundHandlers.particles)
    eventBus.on(EVENTS.FLASH, this._boundHandlers.flash)
  }

  _detachListeners() {
    eventBus.off(EVENTS.SCREEN_SHAKE, this._boundHandlers.shake)
    eventBus.off(EVENTS.HIT_PAUSE, this._boundHandlers.hitPause)
    eventBus.off(EVENTS.PARTICLE_BURST, this._boundHandlers.particles)
    eventBus.off(EVENTS.FLASH, this._boundHandlers.flash)
  }

  _onShake({ intensity = 5, duration = 300 }) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity)
    this.shakeDuration = Math.max(this.shakeDuration, duration)
    this.shakeTime = 0
  }

  _onHitPause({ frames = 4 }) {
    this.hitPauseFrames = Math.max(this.hitPauseFrames, frames)
    this.hitPauseTimer = 0
  }

  _onParticles({ x, y, color = '#22d3ee', count = 10, ...config }) {
    this.particlePool.burst(x, y, count, { color, ...config })
  }

  _onFlash({ color = '#ffffff', duration = 100 }) {
    this.flashColor = color
    this.flashDuration = duration
    this.flashTime = 0
    this.flashAlpha = 1
  }

  // Update all juice effects
  update(deltaMs) {
    const deltaSec = deltaMs / 1000

    // Screen shake
    if (this.shakeTime < this.shakeDuration) {
      this.shakeTime += deltaMs
      const progress = this.shakeTime / this.shakeDuration
      const currentIntensity = this.shakeIntensity * (1 - progress) * (1 - progress) // ease out quad
      this.shakeOffset.x = (Math.random() - 0.5) * 2 * currentIntensity
      this.shakeOffset.y = (Math.random() - 0.5) * 2 * currentIntensity
    } else {
      this.shakeOffset = { x: 0, y: 0 }
      this.shakeIntensity = 0
      this.shakeDuration = 0
    }

    // Hit pause
    if (this.hitPauseTimer < this.hitPauseFrames) {
      this.hitPauseTimer++
      return true // Signal to skip game update
    }

    // Flash
    if (this.flashTime < this.flashDuration) {
      this.flashTime += deltaMs
      this.flashAlpha = 1 - (this.flashTime / this.flashDuration)
    } else {
      this.flashColor = null
      this.flashAlpha = 0
    }

    // Color grade interpolation
    for (const key of Object.keys(this.colorGrade)) {
      const current = this.colorGrade[key]
      const target = this.colorGradeTarget[key]
      if (Math.abs(current - target) > 0.001) {
        this.colorGrade[key] += (target - current) * this.colorGradeSpeed * deltaSec
      } else {
        this.colorGrade[key] = target
      }
    }

    // Particle pool
    this.particlePool.update(deltaMs)

    // Micro-animations
    for (let i = this.microAnimations.length - 1; i >= 0; i--) {
      const anim = this.microAnimations[i]
      anim.elapsed += deltaMs
      if (anim.elapsed >= anim.duration) {
        if (anim.onComplete) anim.onComplete()
        this.microAnimations.splice(i, 1)
      } else {
        anim.progress = anim.elapsed / anim.duration
        if (anim.onUpdate) anim.onUpdate(anim.progress)
      }
    }

    return false // Don't skip game update
  }

  // Render juice effects to canvas
  render(ctx, canvasWidth, canvasHeight) {
    // Screen shake: translate context
    if (this.shakeOffset.x !== 0 || this.shakeOffset.y !== 0) {
      ctx.translate(this.shakeOffset.x, this.shakeOffset.y)
    }

    // Particles
    this.particlePool.render(ctx)

    // Flash overlay
    if (this.flashAlpha > 0 && this.flashColor) {
      ctx.save()
      ctx.globalAlpha = this.flashAlpha
      ctx.fillStyle = this.flashColor
      ctx.fillRect(-this.shakeOffset.x, -this.shakeOffset.y, canvasWidth, canvasHeight)
      ctx.restore()
    }

    // Color grading (apply via CSS filter on canvas or post-process)
    // This is applied externally via CSS filter on the game canvas
  }

  // Get CSS filter string for color grading
  getColorGradeFilter() {
    const { saturation, contrast, brightness, hueRotate, vignette } = this.colorGrade
    return `saturate(${saturation}) contrast(${contrast}) brightness(${brightness}) hue-rotate(${hueRotate}deg)`
  }

  // Set color grade target (for transitions)
  setColorGrade(target, speed = 5) {
    this.colorGradeTarget = { ...this.colorGradeTarget, ...target }
    this.colorGradeSpeed = speed
  }

  // Reset color grade to default
  resetColorGrade() {
    this.colorGradeTarget = {
      saturation: 1,
      contrast: 1,
      brightness: 1,
      hueRotate: 0,
      vignette: 0,
    }
  }

  // Trigger screen shake programmatically
  shake(intensity, duration) {
    this._onShake({ intensity, duration })
  }

  // Trigger hit pause
  hitPause(frames) {
    this._onHitPause({ frames })
  }

  // Trigger particle burst
  burst(x, y, count, config) {
    this._onParticles({ x, y, count, ...config })
  }

  // Trigger flash
  flash(color, duration) {
    this._onFlash({ color, duration })
  }

  // Add micro-animation
  addMicroAnimation({ duration, onUpdate, onComplete }) {
    this.microAnimations.push({
      duration,
      elapsed: 0,
      progress: 0,
      onUpdate,
      onComplete,
    })
  }

  // Xp fountain animation (special)
  xpFountain(x, y, amount) {
    // Burst of golden particles rising up
    this.particlePool.burst(x, y, 20, {
      color: '#fbbf24',
      size: 6,
      life: 1500,
      vy: -4,
      ay: -0.01, // float up
      shape: 'star',
      rotationSpeed: 0.02,
    })
    // Text particles showing +XP
    for (let i = 0; i < 3; i++) {
      this.particlePool.acquire({
        x: x + (Math.random() - 0.5) * 30,
        y: y - 20,
        vx: (Math.random() - 0.5) * 1,
        vy: -2,
        ay: -0.005,
        color: '#fbbf24',
        size: 16,
        life: 1000,
        shape: 'text',
        text: `+${Math.floor(amount / 3)}`,
      })
    }
    // Screen flash gold
    this.flash('rgba(251, 191, 36, 0.3)', 150)
  }

  // Victory screen animation
  victoryFlash() {
    this.flash('rgba(52, 211, 153, 0.4)', 500)
    this.shake(8, 400)
    this.setColorGrade({ saturation: 1.5, brightness: 1.2, contrast: 1.1 }, 10)
    setTimeout(() => this.resetColorGrade(), 1000)
  }

  // Error feedback animation
  errorFeedback() {
    this.flash('rgba(251, 113, 133, 0.3)', 100)
    this.shake(5, 200)
    this.hitPause(3)
    this.setColorGrade({ saturation: 0.5, hueRotate: 10 }, 15)
    setTimeout(() => this.resetColorGrade(), 300)
  }

  // Command success micro-animation
  commandSuccess() {
    this.addMicroAnimation({
      duration: 200,
      onUpdate: (progress) => {
        // Could trigger UI pulse
      },
    })
  }

  // Cleanup
  destroy() {
    this._detachListeners()
    this.particlePool.clear()
    this.microAnimations = []
  }
}

export const juiceSystem = new JuiceSystem()