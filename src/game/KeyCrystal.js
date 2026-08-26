// KeyCrystal — the physical manifestation of a Redis key in the world.
// Each key in the store appears as a crystal. Interacting lets the player
// read/write it via the terminal, and visual effects play on mutations.

import { Entity } from './Entity.js'

export class KeyCrystal extends Entity {
  constructor({ x = 0, y = 0, key = 'key', value = '', type = 'string', ttl = null, version = 1 } = {}) {
    super({ x, y, radius: 32, type: 'keycrystal' })
    this.key = key
    this.value = value
    this.dataType = type
    this.ttl = ttl // null = persistent, otherwise ms until expiry
    this.version = version
    this.color = this._colorForType(type)
    this.glowColor = this._glowForType(type)
    this.pulsePhase = Math.random() * Math.PI * 2
    this.pulseSpeed = 2
    this.formationProgress = 0 // 0 = just spawned, 1 = fully formed
    this.formationSpeed = 3
    this.isNew = true
    this.interactionRadius = 50
    this.orbitParticles = []
    this._initOrbitParticles()
  }

  _colorForType(type) {
    const colors = {
      string: '#22d3ee',
      hash: '#fbbf24',
      list: '#34d399',
      set: '#a78bfa',
      zset: '#f87171',
      stream: '#fb923c',
    }
    return colors[type] || '#22d3ee'
  }

  _glowForType(type) {
    const base = this._colorForType(type)
    return base.replace(')', ', 0.3)').replace('rgb', 'rgba').replace('#', 'rgba(').replace(')', ', 0.3)')
  }

  _initOrbitParticles() {
    const count = this.dataType === 'set' ? 5 : this.dataType === 'zset' ? 3 : 0
    for (let i = 0; i < count; i++) {
      this.orbitParticles.push({
        angle: (i / count) * Math.PI * 2,
        radius: this.radius + 10 + Math.random() * 10,
        speed: 0.5 + Math.random() * 0.5,
        size: 3 + Math.random() * 3,
      })
    }
  }

  update(dt) {
    super.update(dt)

    // Formation animation
    if (this.formationProgress < 1) {
      this.formationProgress = Math.min(1, this.formationProgress + this.formationSpeed * dt)
      this.isNew = this.formationProgress < 1
    }

    // Pulse animation
    this.pulsePhase += this.pulseSpeed * dt

    // TTL countdown
    if (this.ttl !== null) {
      this.ttl -= dt * 1000
      if (this.ttl <= 0) {
        this.alive = false
        return
      }
    }

    // Orbit particles for sets/zsets
    for (const p of this.orbitParticles) {
      p.angle += p.speed * dt
    }
  }

  _draw(ctx) {
    const scale = this.formationProgress
    const pulse = Math.sin(this.pulsePhase) * 0.1 + 1
    const r = this.radius * scale * pulse

    ctx.save()
    ctx.scale(scale, scale)

    // Glow
    const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2)
    glowGrad.addColorStop(0, this.glowColor)
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.arc(0, 0, r * 2, 0, Math.PI * 2)
    ctx.fill()

    // Crystal shape - hexagon for string, octagon for hash, etc.
    const sides = this._sidesForType()
    ctx.fillStyle = this.color
    ctx.beginPath()
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(angle) * r
      const y = Math.sin(angle) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()

    // Inner highlight
    ctx.fillStyle = this._lighterColor(this.color)
    ctx.beginPath()
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(angle) * r * 0.5
      const y = Math.sin(angle) * r * 0.5
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()

    // TTL ring
    if (this.ttl !== null) {
      const maxTtl = 60000 // assume 60s max for visual
      const progress = 1 - Math.min(this.ttl / maxTtl, 1)
      ctx.strokeStyle = '#f87171'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
      ctx.stroke()
    }

    // Orbit particles
    for (const p of this.orbitParticles) {
      const x = Math.cos(p.angle) * p.radius
      const y = Math.sin(p.angle) * p.radius
      ctx.fillStyle = this._lighterColor(this.color)
      ctx.beginPath()
      ctx.arc(x, y, p.size * scale, 0, Math.PI * 2)
      ctx.fill()
    }

    // Key label
    if (scale > 0.5) {
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      const label = this.key.length > 12 ? this.key.slice(0, 10) + '..' : this.key
      ctx.fillText(label, 0, r + 20)
    }

    ctx.restore()
  }

  _sidesForType() {
    const sides = {
      string: 6,  // hexagon
      hash: 8,    // octagon
      list: 4,    // square (crate-like)
      set: 12,    // dodecagon
      zset: 10,   // decagon
      stream: 5,  // pentagon
    }
    return sides[this.dataType] || 6
  }

  _lighterColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const lr = Math.min(255, r + 60)
    const lg = Math.min(255, g + 60)
    const lb = Math.min(255, b + 60)
    return `rgb(${lr}, ${lg}, ${lb})`
  }

  /** Called when player interacts with this crystal. */
  onInteract(player) {
    return {
      type: 'key_interact',
      key: this.key,
      value: this.value,
      dataType: this.dataType,
      ttl: this.ttl,
      version: this.version,
    }
  }

  /** Update crystal data from Redis state change. */
  updateFromStore(entry) {
    if (!entry) return
    this.value = entry.value
    this.dataType = entry.type
    this.ttl = entry.expiresAt ? entry.expiresAt - Date.now() : null
    this.version = entry.version
    this.color = this._colorForType(this.dataType)
    this.glowColor = this._glowForType(this.dataType)
    // Re-init orbit particles if type changed
    this.orbitParticles = []
    this._initOrbitParticles()
  }
}

export function createKeyCrystal(opts) {
  return new KeyCrystal(opts)
}