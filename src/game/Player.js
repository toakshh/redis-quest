// Player entity with movement, interaction, and visual state.

import { Entity } from './Entity.js'

export class Player extends Entity {
  constructor({ x = 0, y = 0 } = {}) {
    super({ x, y, radius: 20, type: 'player' })
    this.speed = 300 // world units per second
    this.targetVx = 0
    this.targetVy = 0
    this.acceleration = 2000
    this.friction = 0.9
    this.color = '#22d3ee'
    this.glowColor = 'rgba(34, 211, 238, 0.3)'

    // Interaction state
    this.nearbyInteractables = []
    this.currentInteractable = null
    this.interactRange = 60
    this.showInteractPrompt = false

    // Visual state
    this.facing = 1 // 1 = right, -1 = left
    this.moveAnimTime = 0
    this.idleAnimTime = 0
    this.isMoving = false

    // Stats
    this.xp = 0
    this.level = 1
    this.maxHealth = 100
    this.health = 100
  }

  /** Set movement input direction (-1 to 1 each axis). */
  setInput(dx, dy) {
    this.targetVx = dx * this.speed
    this.targetVy = dy * this.speed
    this.isMoving = dx !== 0 || dy !== 0
    if (dx !== 0) this.facing = dx > 0 ? 1 : -1
  }

  update(dt) {
    // Smooth acceleration toward target velocity
    this.vx += (this.targetVx - this.vx) * Math.min(this.acceleration * dt, 1)
    this.vy += (this.targetVy - this.vy) * Math.min(this.acceleration * dt, 1)

    // Apply friction when no input
    if (this.targetVx === 0 && this.targetVy === 0) {
      this.vx *= this.friction
      this.vy *= this.friction
      if (Math.abs(this.vx) < 1) this.vx = 0
      if (Math.abs(this.vy) < 1) this.vy = 0
    }

    super.update(dt)

    // Animation timers
    if (this.isMoving) {
      this.moveAnimTime += dt * 8
      this.idleAnimTime = 0
    } else {
      this.idleAnimTime += dt * 2
      this.moveAnimTime = 0
    }
  }

  _draw(ctx) {
    const bob = this.isMoving ? Math.sin(this.moveAnimTime) * 2 : Math.sin(this.idleAnimTime) * 1
    const squash = this.isMoving ? 0.9 : 1

    ctx.save()
    ctx.scale(this.facing * squash, 1 / squash)
    ctx.translate(0, bob)

    // Glow
    const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 2)
    glowGrad.addColorStop(0, this.glowColor)
    glowGrad.addColorStop(1, 'rgba(34, 211, 238, 0)')
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2)
    ctx.fill()

    // Body
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.ellipse(0, 0, this.radius * squash, this.radius / squash, 0, 0, Math.PI * 2)
    ctx.fill()

    // Core highlight
    ctx.fillStyle = '#67e8f9'
    ctx.beginPath()
    ctx.arc(-4 * this.facing, -4, this.radius * 0.3, 0, Math.PI * 2)
    ctx.fill()

    // Eyes
    ctx.fillStyle = '#0d141f'
    ctx.beginPath()
    ctx.arc(6 * this.facing, -3, 3, 0, Math.PI * 2)
    ctx.fill()

    // Interaction indicator
    if (this.showInteractPrompt) {
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('▼', 0, -this.radius - 10)
    }

    ctx.restore()
  }

  /** Check nearby interactables and return the closest one in range. */
  checkInteractables(entities) {
    this.nearbyInteractables = []
    let closest = null
    let closestDist = Infinity

    for (const entity of entities) {
      if (!entity.alive || entity === this) continue
      if (entity.type === 'keycrystal' || entity.type === 'npc' || entity.type === 'interactive') {
        const dist = this.distanceTo(entity)
        if (dist <= this.interactRange) {
          this.nearbyInteractables.push(entity)
          if (dist < closestDist) {
            closestDist = dist
            closest = entity
          }
        }
      }
    }

    this.currentInteractable = closest
    this.showInteractPrompt = closest !== null
    return closest
  }

  /** Try to interact with the current nearby interactable. */
  interact() {
    if (this.currentInteractable && this.currentInteractable.alive) {
      return this.currentInteractable.onInteract(this)
    }
    return null
  }

  /** Gain XP and handle level up. */
  gainXp(amount) {
    this.xp += amount
    const xpForNext = this.level * 100
    if (this.xp >= xpForNext) {
      this.levelUp()
    }
  }

  levelUp() {
    this.level++
    this.xp = 0
    this.maxHealth += 20
    this.health = this.maxHealth
    // Emit level up event - will be handled by the game system
    return { type: 'levelup', level: this.level }
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount)
    if (this.health <= 0) {
      this.alive = false
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount)
  }
}

export function createPlayer(opts) {
  return new Player(opts)
}