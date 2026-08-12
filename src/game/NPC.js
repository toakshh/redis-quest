// NPC entity with dialogue, quests, and patrol behavior.

import { Entity } from './Entity.js'

export class NPC extends Entity {
  constructor({ x = 0, y = 0, name = 'Villager', dialogue = [], patrolPoints = [], type = 'npc' } = {}) {
    super({ x, y, radius: 24, type })
    this.name = name
    this.dialogue = dialogue
    this.dialogueIndex = 0
    this.patrolPoints = patrolPoints
    this.patrolIndex = 0
    this.patrolSpeed = 50
    this.waitTimer = 0
    this.waitDuration = 2 // seconds at each point
    this.color = '#a78bfa'
    this.glowColor = 'rgba(167, 139, 250, 0.3)'
    this.facing = 1
    this.isPatrolling = patrolPoints.length > 1
    this.state = 'idle' // idle, patrolling, waiting, talking
    this.interactionRadius = 70
    this.canGiveQuest = false
    this.questGiven = false
  }

  update(dt) {
    super.update(dt)

    if (this.isPatrolling && this.state !== 'talking') {
      this._updatePatrol(dt)
    }

    // Bobbing animation
    this.age += dt
  }

  _updatePatrol(dt) {
    if (this.patrolPoints.length < 2) return

    const target = this.patrolPoints[this.patrolIndex]
    const dx = target.x - this.x
    const dy = target.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 10) {
      // Arrived at patrol point
      this.state = 'waiting'
      this.waitTimer += dt
      this.vx = 0
      this.vy = 0
      if (this.waitTimer >= this.waitDuration) {
        this.waitTimer = 0
        this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length
        this.state = 'patrolling'
      }
    } else {
      this.state = 'patrolling'
      this.vx = (dx / dist) * this.patrolSpeed
      this.vy = (dy / dist) * this.patrolSpeed
      this.facing = dx > 0 ? 1 : -1
    }
  }

  _draw(ctx) {
    const bob = Math.sin(this.age * 2) * 3

    ctx.save()
    ctx.translate(0, bob)
    ctx.scale(this.facing, 1)

    // Glow
    const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 2)
    glowGrad.addColorStop(0, this.glowColor)
    glowGrad.addColorStop(1, 'rgba(167, 139, 250, 0)')
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2)
    ctx.fill()

    // Body
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.ellipse(0, 0, this.radius, this.radius * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()

    // Hat / head decoration
    ctx.fillStyle = '#8b5cf6'
    ctx.beginPath()
    ctx.arc(0, -this.radius * 0.8, this.radius * 0.5, 0, Math.PI * 2)
    ctx.fill()

    // Eyes
    ctx.fillStyle = '#0d141f'
    ctx.beginPath()
    ctx.arc(6 * this.facing, -this.radius * 0.6, 3, 0, Math.PI * 2)
    ctx.fill()

    // Quest marker
    if (this.canGiveQuest && !this.questGiven) {
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 20px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('!', 0, -this.radius - 15)
    }

    // Name label
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(this.name, 0, -this.radius - 30)

    ctx.restore()
  }

  /** Called when player interacts with this NPC. */
  onInteract(player) {
    this.state = 'talking'
    this.vx = 0
    this.vy = 0
    // Face the player
    this.facing = player.x > this.x ? 1 : -1

    const line = this.dialogue[this.dialogueIndex % this.dialogue.length]
    this.dialogueIndex++

    return {
      type: 'dialogue',
      npc: this.name,
      text: line,
      canGiveQuest: this.canGiveQuest && !this.questGiven,
    }
  }

  /** Mark quest as given. */
  giveQuest() {
    this.questGiven = true
    this.canGiveQuest = false
  }
}

export function createNPC(opts) {
  return new NPC(opts)
}