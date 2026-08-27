// Particle system for visual effects (crystal formation, shatter, beams, etc.)

import { Entity } from './Entity.js'

export class Particle extends Entity {
  constructor({ x = 0, y = 0, vx = 0, vy = 0, radius = 4, color = '#fff', life = 1, gravity = 0, fade = true } = {}) {
    super({ x, y, vx, vy, radius, type: 'particle' })
    this.color = color
    this.maxLife = life
    this.life = life
    this.gravity = gravity
    this.fade = fade
    this.startRadius = radius
    this.grow = false
  }

  update(dt) {
    super.update(dt)
    this.vy += this.gravity * dt
    this.life -= dt

    const progress = 1 - this.life / this.maxLife

    if (this.fade) {
      // Particles shrink as they fade
      this.radius = this.startRadius * (1 - progress)
    }

    if (this.grow) {
      this.radius = this.startRadius * (1 + progress)
    }

    if (this.life <= 0) this.alive = false
  }

  _draw(ctx) {
    const alpha = this.fade ? this.life / this.maxLife : 1
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(0.5, this.radius), 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

// Specialized particle types

export class CrystalShard extends Particle {
  constructor(opts) {
    super({ ...opts, radius: opts.radius || 6, life: opts.life || 0.8, gravity: 200 })
    this.rotation = Math.random() * Math.PI * 2
    this.rotationSpeed = (Math.random() - 0.5) * 10
    this.color = opts.color || '#22d3ee'
  }

  _draw(ctx) {
    const alpha = this.life / this.maxLife
    ctx.globalAlpha = alpha
    ctx.save()
    ctx.rotate(this.rotation)
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.moveTo(0, -this.radius)
    ctx.lineTo(this.radius * 0.7, this.radius * 0.5)
    ctx.lineTo(-this.radius * 0.7, this.radius * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    ctx.globalAlpha = 1
  }
}

export class SparkParticle extends Particle {
  constructor(opts) {
    super({ ...opts, radius: opts.radius || 2, life: opts.life || 0.3, gravity: 0 })
    this.color = opts.color || '#fbbf24'
    this.lineLength = opts.lineLength || 8
  }

  _draw(ctx) {
    const alpha = this.life / this.maxLife
    ctx.globalAlpha = alpha
    ctx.strokeStyle = this.color
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-this.lineLength / 2, 0)
    ctx.lineTo(this.lineLength / 2, 0)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

export class RingParticle extends Particle {
  constructor(opts) {
    super({ ...opts, radius: opts.radius || 10, life: opts.life || 0.5, gravity: 0 })
    this.color = opts.color || '#22d3ee'
    this.maxRadius = opts.maxRadius || 50
    this.lineWidth = opts.lineWidth || 3
  }

  update(dt) {
    super.update(dt)
    const progress = 1 - this.life / this.maxLife
    this.radius = this.startRadius + (this.maxRadius - this.startRadius) * progress
  }

  _draw(ctx) {
    const alpha = (1 - this.life / this.maxLife) // inverse fade - ring grows and fades
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.strokeStyle = this.color
    ctx.lineWidth = this.lineWidth
    ctx.beginPath()
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

export class BeamParticle extends Particle {
  constructor({ x = 0, y = 0, targetX, targetY, color = '#22d3ee', life = 0.2, width = 4 } = {}) {
    const dx = targetX - x
    const dy = targetY - y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)

    super({ x, y, radius: dist / 2, life, color })
    this.targetX = targetX
    this.targetY = targetY
    this.angle = angle
    this.width = width
    this.segments = Math.max(1, Math.floor(dist / 20))
  }

  _draw(ctx) {
    const alpha = this.life / this.maxLife
    ctx.globalAlpha = alpha
    ctx.strokeStyle = this.color
    ctx.lineWidth = this.width
    ctx.lineCap = 'round'
    ctx.shadowColor = this.color
    ctx.shadowBlur = 10

    ctx.beginPath()
    ctx.moveTo(0, 0)

    // Jagged beam
    for (let i = 1; i <= this.segments; i++) {
      const t = i / this.segments
      const x = Math.cos(this.angle) * this.radius * 2 * t
      const y = Math.sin(this.angle) * this.radius * 2 * t
      const jitter = (Math.random() - 0.5) * 10 * (1 - t)
      ctx.lineTo(x + jitter, y + jitter)
    }
    ctx.stroke()

    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
}

export class FloatingText extends Particle {
  constructor({ x = 0, y = 0, text = '+1', color = '#fbbf24', life = 1.5, fontSize = 16, velocityY = -30 } = {}) {
    super({ x, y, vx: 0, vy: velocityY, radius: fontSize, life, color })
    this.text = text
    this.fontSize = fontSize
    this.gravity = 0
  }

  update(dt) {
    super.update(dt)
    this.vy *= 0.98 // slight slowdown
  }

  _draw(ctx) {
    const alpha = this.life / this.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.font = `bold ${this.fontSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.text, 0, 0)
    ctx.globalAlpha = 1
  }
}

export function createParticle(opts) {
  return new Particle(opts)
}

export function createCrystalShard(opts) {
  return new CrystalShard(opts)
}

export function createSpark(opts) {
  return new SparkParticle(opts)
}

export function createRing(opts) {
  return new RingParticle(opts)
}

export function createBeam(opts) {
  return new BeamParticle(opts)
}

export function createFloatingText(opts) {
  return new FloatingText(opts)
}