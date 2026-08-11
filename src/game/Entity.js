// Base entity class with position, velocity, and common lifecycle.

export class Entity {
  constructor({ x = 0, y = 0, vx = 0, vy = 0, radius = 16, type = 'entity' } = {}) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.radius = radius
    this.type = type
    this.id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    this.alive = true
    this.age = 0
    this.maxAge = Infinity
    // Optional: custom collision tags
    this.tags = new Set()
    // For interpolation (render position = position + velocity * alpha)
    this.prevX = x
    this.prevY = y
  }

  /** Called each fixed timestep. Override in subclasses. */
  update(dt) {
    this.prevX = this.x
    this.prevY = this.y
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.age += dt
    if (this.age >= this.maxAge) this.alive = false
  }

  /** Called each frame with interpolation alpha [0..1]. Override for custom rendering. */
  render(ctx, alpha) {
    // Interpolated position for smooth rendering
    const rx = this.prevX + (this.x - this.prevX) * alpha
    const ry = this.prevY + (this.y - this.prevY) * alpha
    ctx.save()
    ctx.translate(rx, ry)
    this._draw(ctx)
    ctx.restore()
  }

  /** Internal draw - override in subclasses. */
  _draw(ctx) {
    ctx.beginPath()
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2)
    ctx.fillStyle = this.color || '#888'
    ctx.fill()
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  /** Check collision with another entity (circle vs circle). */
  collidesWith(other) {
    const dx = this.x - other.x
    const dy = this.y - other.y
    const dist2 = dx * dx + dy * dy
    const r = this.radius + other.radius
    return dist2 <= r * r
  }

  /** Distance to another entity. */
  distanceTo(other) {
    const dx = this.x - other.x
    const dy = this.y - other.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /** Mark for removal. */
  destroy() {
    this.alive = false
  }
}

export function createEntity(opts) {
  return new Entity(opts)
}