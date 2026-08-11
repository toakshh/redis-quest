// World — manages all entities, handles spawning/despawning, and coordinates
// with the camera for culling and the event bus for effects.

import { Entity } from './Entity.js'
import { Player } from './Player.js'
import { NPC } from './NPC.js'
import { KeyCrystal } from './KeyCrystal.js'
import { Particle, createCrystalShard, createSpark, createRing, createBeam, createFloatingText } from './Particle.js'
import { Camera } from './Camera.js'
import { createEventBus } from '../engine/EventBus.js'
import { EVENT_TYPES, EFFECT_KINDS } from '../engine/GameEvents.js'

export class World {
  constructor({ eventBus = null, region = null, camera = null } = {}) {
    this.entities = []
    this.toAdd = []
    this.toRemove = []
    this.eventBus = eventBus || createEventBus()
    this.region = region
    this.camera = camera || new Camera({ worldBounds: region ? { x: 0, y: 0, width: region.width, height: region.height } : null })
    this.player = null

    // Effect pools for performance
    this.effectPools = new Map()

    // Spawn crystals from region data / engine state
    this._crystalMap = new Map() // key -> crystal entity
  }

  /** Initialize the world with a player at the region spawn. */
  init() {
    const spawn = this.region?.spawn || { x: 400, y: 300 }
    this.player = new Player({ x: spawn.x, y: spawn.y })
    this.addEntity(this.player)

    if (this.region) {
      this.camera.setWorldBounds({ x: 0, y: 0, width: this.region.width, height: this.region.height })
      this.camera.moveTo(spawn.x, spawn.y)
      this.camera.follow(this.player)
    }

    // Subscribe to visual effect events from the bridge
    this.eventBus.on(EVENT_TYPES.VISUAL_EFFECT_REQUESTED, (ev) => this._handleVisualEffect(ev))

    return this
  }

  /** Add an entity (queued for next frame to avoid iteration issues). */
  addEntity(entity) {
    this.toAdd.push(entity)
  }

  /** Remove an entity (queued). */
  removeEntity(entity) {
    this.toRemove.push(entity)
  }

  /** Fixed timestep update - call from GameLoop.onUpdate. */
  update(dt) {
    // Flush additions/removals
    for (const e of this.toAdd) this.entities.push(e)
    this.toAdd.length = 0

    for (const e of this.toRemove) {
      const i = this.entities.indexOf(e)
      if (i !== -1) this.entities.splice(i, 1)
    }
    this.toRemove.length = 0

    // Update all entities
    for (const entity of this.entities) {
      if (entity.alive) {
        entity.update(dt)
      }
    }

    // Clean up dead entities
    this.entities = this.entities.filter((e) => e.alive)

    // Update camera
    this.camera.update(dt)

    // Player interaction check
    if (this.player) {
      this.player.checkInteractables(this.entities)
    }
  }

  /** Variable timestep render - call from GameLoop.onRender with alpha. */
  render(ctx, alpha) {
    // Clear
    if (this.region) {
      ctx.fillStyle = this.region.palette.ground
      ctx.fillRect(0, 0, this.camera.viewportWidth, this.camera.viewportHeight)
    }

    // Apply camera transform
    this.camera.applyToContext(ctx)

    // Draw grid
    this._drawGrid(ctx)

    // Get visible world rect for culling
    const visible = this.camera.getVisibleWorldRect()
    const cullMargin = 100 // draw slightly off-screen for smooth entry

    // Render entities (back to front: particles, crystals, NPCs, player)
    const layers = [
      (e) => e.type === 'particle',
      (e) => e.type === 'keycrystal',
      (e) => e.type === 'npc',
      (e) => e.type === 'player',
    ]

    for (const filter of layers) {
      for (const entity of this.entities) {
        if (!entity.alive) continue
        if (!filter(entity)) continue

        // Frustum culling
        if (!this.camera.isVisible(entity.x - entity.radius, entity.y - entity.radius, entity.radius * 2, entity.radius * 2)) {
          continue
        }

        entity.render(ctx, alpha)
      }
    }

    this.camera.restoreContext(ctx)

    // Render UI overlay (interaction prompts, etc.) in screen space
    this._renderUI(ctx, alpha)
  }

  _drawGrid(ctx) {
    if (!this.region) return

    const { grid, accent } = this.region.palette
    const spacing = 100
    const view = this.camera.getVisibleWorldRect()

    ctx.strokeStyle = grid
    ctx.lineWidth = 1

    // Vertical lines
    const startX = Math.floor(view.x / spacing) * spacing
    for (let x = startX; x < view.x + view.width; x += spacing) {
      ctx.beginPath()
      ctx.moveTo(x, view.y)
      ctx.lineTo(x, view.y + view.height)
      ctx.stroke()
    }

    // Horizontal lines
    const startY = Math.floor(view.y / spacing) * spacing
    for (let y = startY; y < view.y + view.height; y += spacing) {
      ctx.beginPath()
      ctx.moveTo(view.x, y)
      ctx.lineTo(view.x + view.width, y)
      ctx.stroke()
    }

    // Center crosshair (subtle)
    ctx.strokeStyle = accent
    ctx.lineWidth = 1
    ctx.setLineDash([10, 10])
    ctx.beginPath()
    ctx.moveTo(0, -this.region.height)
    ctx.lineTo(0, this.region.height)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-this.region.width, 0)
    ctx.lineTo(this.region.width, 0)
    ctx.stroke()
    ctx.setLineDash([])
  }

  _renderUI(ctx, alpha) {
    // Interaction prompt for player
    if (this.player && this.player.showInteractPrompt && this.player.currentInteractable) {
      const vp = this.camera.worldToViewport(this.player.currentInteractable.x, this.player.currentInteractable.y)
      ctx.save()
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 16px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('▼', vp.x, vp.y - this.player.currentInteractable.radius - 20)
      ctx.restore()
    }
  }

  /** Handle visual effect events from the RedisGameBridge. */
  _handleVisualEffect(ev) {
    const { effect, command, args, key, error } = ev.payload

    // Find the target crystal if applicable
    const crystal = key ? this._crystalMap.get(key) : null

    switch (effect) {
      case EFFECT_KINDS.CRYSTAL_FORM:
        this._spawnCrystalFormation(crystal, key, args)
        break
      case EFFECT_KINDS.CRYSTAL_PULSE:
        this._spawnCrystalPulse(crystal)
        break
      case EFFECT_KINDS.COUNTER_PULSE:
        this._spawnCounterPulse(crystal)
        break
      case EFFECT_KINDS.RETRIEVE_BEAM:
        this._spawnRetrieveBeam(crystal)
        break
      case EFFECT_KINDS.SHATTER:
        this._spawnShatter(crystal)
        break
      case EFFECT_KINDS.POOF:
        this._spawnPoof(crystal)
        break
      case EFFECT_KINDS.COUNTDOWN_HALO:
        if (crystal) crystal.ttl = 60000 // visual TTL
        break
      case EFFECT_KINDS.CANCEL_HALO:
        if (crystal) crystal.ttl = null
        break
      case EFFECT_KINDS.FIELD_FLASH:
        this._spawnFieldFlash(crystal)
        break
      case EFFECT_KINDS.QUEUE_SLIDE:
        this._spawnQueueSlide(crystal)
        break
      case EFFECT_KINDS.QUEUE_POP:
        this._spawnQueuePop(crystal)
        break
      case EFFECT_KINDS.ORBIT_JOIN:
        this._spawnOrbitJoin(crystal)
        break
      case EFFECT_KINDS.ORBIT_LEAVE:
        this._spawnOrbitLeave(crystal)
        break
      case EFFECT_KINDS.LEADERBOARD_MOVE:
        this._spawnLeaderboardMove(crystal)
        break
      case EFFECT_KINDS.RADIO_WAVE:
        this._spawnRadioWave(crystal, args)
        break
      case EFFECT_KINDS.CRYSTAL_MOVE:
        this._spawnCrystalMove(crystal, args)
        break
      case EFFECT_KINDS.ERROR_RIPPLE:
        this._spawnErrorRipple(error)
        break
      default:
        // COMMAND_ECHO - subtle feedback
        break
    }
  }

  // ---- Effect implementations ----

  _spawnCrystalFormation(crystal, key, args) {
    if (crystal) {
      crystal.formationProgress = 0
      crystal.isNew = true
    } else if (key) {
      // Create new crystal at a position derived from the key hash
      const { x, y } = this._positionForKey(key)
      const value = args[1] || ''
      const newCrystal = new KeyCrystal({ x, y, key, value, type: 'string' })
      this.addEntity(newCrystal)
      this._crystalMap.set(key, newCrystal)
    }
    // Particles
    if (crystal) {
      for (let i = 0; i < 12; i++) {
        this.addEntity(createCrystalShard({
          x: crystal.x, y: crystal.y,
          color: crystal.color,
          life: 0.5 + Math.random() * 0.5,
        }))
      }
      this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: crystal.color, maxRadius: 80 }))
    }
  }

  _spawnCrystalPulse(crystal) {
    if (!crystal) return
    this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: crystal.color, maxRadius: 60, lineWidth: 2 }))
    this.addEntity(createFloatingText({ x: crystal.x, y: crystal.y - crystal.radius, text: 'SET', color: crystal.color }))
    for (let i = 0; i < 6; i++) {
      this.addEntity(createSpark({ x: crystal.x, y: crystal.y, color: crystal.color }))
    }
  }

  _spawnCounterPulse(crystal) {
    if (!crystal) return
    this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: '#fbbf24', maxRadius: 50, lineWidth: 3 }))
    this.addEntity(createFloatingText({ x: crystal.x, y: crystal.y - crystal.radius, text: 'INCR', color: '#fbbf24' }))
  }

  _spawnRetrieveBeam(crystal) {
    if (!crystal || !this.player) return
    this.addEntity(createBeam({ x: crystal.x, y: crystal.y, targetX: this.player.x, targetY: this.player.y, color: crystal.color }))
  }

  _spawnShatter(crystal) {
    if (!crystal) return
    // Emit many shards
    for (let i = 0; i < 20; i++) {
      this.addEntity(createCrystalShard({
        x: crystal.x, y: crystal.y,
        color: crystal.color,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300 - 100,
        life: 0.8 + Math.random() * 0.5,
      }))
    }
    this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: crystal.color, maxRadius: 100, lineWidth: 4 }))
    this.camera.shake(5, 200)
  }

  _spawnPoof(crystal) {
    if (!crystal) return
    for (let i = 0; i < 15; i++) {
      this.addEntity(createParticle({
        x: crystal.x, y: crystal.y,
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 100 - 50,
        color: '#64748b',
        radius: 4 + Math.random() * 4,
        life: 0.5 + Math.random() * 0.5,
        gravity: 50,
      }))
    }
    this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: '#64748b', maxRadius: 60, lineWidth: 2 }))
  }

  _spawnFieldFlash(crystal) {
    if (!crystal) return
    this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: '#fbbf24', maxRadius: 40, lineWidth: 2 }))
    this.addEntity(createFloatingText({ x: crystal.x, y: crystal.y - crystal.radius, text: 'HSET', color: '#fbbf24' }))
  }

  _spawnQueueSlide(crystal) {
    if (!crystal) return
    this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: '#34d399', maxRadius: 50, lineWidth: 2 }))
    this.addEntity(createFloatingText({ x: crystal.x, y: crystal.y - crystal.radius, text: 'PUSH', color: '#34d399' }))
  }

  _spawnQueuePop(crystal) {
    if (!crystal) return
    this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: '#f87171', maxRadius: 40, lineWidth: 2 }))
    this.addEntity(createFloatingText({ x: crystal.x, y: crystal.y - crystal.radius, text: 'POP', color: '#f87171' }))
  }

  _spawnOrbitJoin(crystal) {
    if (!crystal) return
    this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: '#a78bfa', maxRadius: 60, lineWidth: 3 }))
    this.addEntity(createFloatingText({ x: crystal.x, y: crystal.y - crystal.radius, text: 'SADD', color: '#a78bfa' }))
  }

  _spawnOrbitLeave(crystal) {
    if (!crystal) return
    this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: '#a78bfa', maxRadius: 40, lineWidth: 2 }))
    this.addEntity(createFloatingText({ x: crystal.x, y: crystal.y - crystal.radius, text: 'SREM', color: '#a78bfa' }))
  }

  _spawnLeaderboardMove(crystal) {
    if (!crystal) return
    this.addEntity(createRing({ x: crystal.x, y: crystal.y, color: '#f87171', maxRadius: 70, lineWidth: 3 }))
    this.addEntity(createFloatingText({ x: crystal.x, y: crystal.y - crystal.radius, text: 'ZADD', color: '#f87171' }))
  }

  _spawnRadioWave(crystal, args) {
    if (!crystal) return
    const channel = args?.[1] || 'channel'
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.addEntity(createRing({
          x: crystal.x, y: crystal.y,
          color: '#fb923c',
          maxRadius: 150 + i * 50,
          life: 1.5,
          lineWidth: 2,
        }))
      }, i * 100)
    }
    this.addEntity(createFloatingText({ x: crystal.x, y: crystal.y - crystal.radius - 30, text: `PUB ${channel}`, color: '#fb923c', fontSize: 12 }))
  }

  _spawnCrystalMove(crystal, args) {
    if (!crystal) return
    const newKey = args?.[1]
    if (newKey) {
      // Animate to new position
      const { x, y } = this._positionForKey(newKey)
      this.addEntity(createBeam({ x: crystal.x, y: crystal.y, targetX: x, targetY: y, color: crystal.color, life: 0.5 }))
      this.addEntity(createFloatingText({ x: crystal.x, y: crystal.y - crystal.radius, text: 'RENAME', color: crystal.color }))
    }
  }

  _spawnErrorRipple(error) {
    if (!this.player) return
    this.addEntity(createRing({ x: this.player.x, y: this.player.y, color: '#f87171', maxRadius: 80, lineWidth: 4 }))
    this.addEntity(createFloatingText({ x: this.player.x, y: this.player.y - 40, text: `ERR: ${error}`, color: '#f87171', fontSize: 12, life: 2 }))
    this.camera.shake(8, 300)
  }

  /** Deterministic position for a key based on its hash. */
  _positionForKey(key) {
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i)
      hash |= 0
    }
    const rng = (n) => {
      n = (n ^ 61) ^ (n >>> 16)
      n = n + (n << 3)
      n = n ^ (n >>> 4)
      n = n * 0x27d4eb2d
      n = n ^ (n >>> 15)
      return n >>> 0
    }
    const h = rng(Math.abs(hash))
    const margin = 200
    return {
      x: margin + (h % (this.region?.width - margin * 2 || 1000)),
      y: margin + ((h >>> 16) % (this.region?.height - margin * 2 || 1000)),
    }
  }

  /** Sync crystals with the Redis store (call after state changes). */
  syncWithStore(store) {
    // Remove crystals for deleted keys
    for (const [key, crystal] of this._crystalMap) {
      if (!store.has(key)) {
        crystal.alive = false
        this._crystalMap.delete(key)
      }
    }

    // Update or create crystals for existing keys
    for (const [key, entry] of store) {
      let crystal = this._crystalMap.get(key)
      if (crystal) {
        crystal.updateFromStore(entry)
      } else {
        const { x, y } = this._positionForKey(key)
        crystal = new KeyCrystal({ x, y, key, value: entry.value, type: entry.type, ttl: entry.expiresAt ? entry.expiresAt - Date.now() : null, version: entry.version })
        this.addEntity(crystal)
        this._crystalMap.set(key, crystal)
      }
    }
  }

  /** Get player entity. */
  getPlayer() {
    return this.player
  }

  /** Get camera. */
  getCamera() {
    return this.camera
  }
}

export function createWorld(opts) {
  return new World(opts)
}