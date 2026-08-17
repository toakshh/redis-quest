// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Engine3D } from './Engine3D.js'

describe('Engine3D & 3D Shooting Game Mechanics', () => {
  let mockContainer

  beforeEach(() => {
    mockContainer = document.createElement('div')
    Object.defineProperty(mockContainer, 'clientWidth', { value: 800 })
    Object.defineProperty(mockContainer, 'clientHeight', { value: 600 })
  })

  it('initializes Engine3D with arena, player, boss, and conveyor belt', () => {
    const engine3D = new Engine3D(mockContainer)
    expect(engine3D).toBeDefined()
    expect(engine3D.playerGroup).toBeDefined()
    expect(engine3D.bossGroup).toBeDefined()
    expect(engine3D.conveyorGroup).toBeDefined()
    expect(engine3D.apiGateShield).toBeDefined()
    engine3D.dispose()
  })

  it('fires SET blaster laser shot projectile', () => {
    const engine3D = new Engine3D(mockContainer)
    engine3D.castSetCommand({ x: 0, y: 0, z: -10 })
    expect(engine3D.projectiles.length).toBe(1)
    expect(engine3D.projectiles[0].type).toBe('SET')
    engine3D.dispose()
  })

  it('fires DEL green purge shot and strips boss shield', () => {
    const engine3D = new Engine3D(mockContainer)
    expect(engine3D.bossShieldActive).toBe(true)

    engine3D.stripBossShield()
    expect(engine3D.bossShieldActive).toBe(false)
    engine3D.dispose()
  })

  it('deploys EXPIRE API Gate Shield Barrier', () => {
    const engine3D = new Engine3D(mockContainer)
    expect(engine3D.apiGateActive).toBe(false)

    engine3D.castExpireCommand()
    expect(engine3D.apiGateActive).toBe(true)
    expect(engine3D.apiGateTimer).toBe(8.0)
    expect(engine3D.apiGateShield.visible).toBe(true)
    engine3D.dispose()
  })

  it('triggers onBossDamage callback when boss takes damage without shield', () => {
    const engine3D = new Engine3D(mockContainer)
    const damageHandler = vi.fn()
    engine3D.onBossDamage = damageHandler

    engine3D.stripBossShield()
    const hitSuccess = engine3D.damageBoss(25)

    expect(hitSuccess).toBe(true)
    expect(damageHandler).toHaveBeenCalledWith(25)
    engine3D.dispose()
  })

  it('disposes existing boss geometries when initBoss is re-invoked', () => {
    const engine3D = new Engine3D(mockContainer)
    const spyDispose = vi.spyOn(engine3D.bossMesh.geometry, 'dispose')

    engine3D.initBoss('entropy-spectre')
    expect(spyDispose).toHaveBeenCalled()
    engine3D.dispose()
  })
})
