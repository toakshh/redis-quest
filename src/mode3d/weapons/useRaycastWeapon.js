import { useRef } from 'react'
import { useRapier } from '@react-three/rapier'
import { use3DGameStore } from '../../stores/use3DGameStore'
import { COLLISION_GROUPS, COLLISION_MASKS } from '../physics/PhysicsWorld'

export function useRaycastWeapon() {
  const rapier = useRapier()
  const { player, recoilKick } = use3DGameStore.getState()
  const lastFireRef = useRef(0)

  // Perform a raycast from camera position in camera direction
  const raycast = (maxDistance = 50, filterGroups = COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.WORLD) => {
    if (!rapier.world) return null

    const cam = player // camera position/rotation stored in player
    const origin = { x: cam.position[0], y: cam.position[1], z: cam.position[2] }
    const yaw = cam.rotationYaw
    const pitch = cam.pitch

    // Direction vector from yaw/pitch
    const dir = {
      x: -Math.sin(yaw) * Math.cos(pitch),
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * Math.cos(pitch),
    }

    const ray = new rapier.RAPIER.Ray(origin, dir)
    const hit = rapier.world.castRay(ray, maxDistance, true, filterGroups)

    return hit ? {
      distance: hit.toi,
      point: {
        x: origin.x + dir.x * hit.toi,
        y: origin.y + dir.y * hit.toi,
        z: origin.z + dir.z * hit.toi,
      },
      normal: hit.normal,
      collider: hit.collider,
      body: hit.collider?.parent(),
    } : null
  }

  // Fire hitscan weapon (plasma cutter)
  const fireHitscan = (config = {}) => {
    const {
      damage = 25,
      range = 50,
      spread = 0,
      ammoCost = 1,
      heatGain = 8,
      recoil = 1,
      tracerColor = 0x00ffff,
    } = config

    const now = Date.now()
    const weapon = player.weapons.plasma

    // Check ammo and cooldown
    if (weapon.ammo < ammoCost) return { hit: false, reason: 'no_ammo' }
    if (weapon.heat >= 100) return { hit: false, reason: 'overheated' }
    if (now - weapon.lastFire < 100) return { hit: false, reason: 'cooldown' } // 10 ROF cap

    // Apply costs
    use3DGameStore.getState().firePlasma()
    recoilKick(recoil)

    // Apply spread
    let spreadX = 0, spreadY = 0
    if (spread > 0) {
      spreadX = (Math.random() - 0.5) * spread
      spreadY = (Math.random() - 0.5) * spread
    }

    const hit = raycast(range)

    if (hit && hit.body) {
      // Check if hit an enemy
      const enemyId = hit.body.userData?.enemyId
      if (enemyId) {
        // Apply damage through store (triggers anomalyAI)
        use3DGameStore.getState().updateEnemy(enemyId, {
          health: Math.max(0, (use3DGameStore.getState().enemies.active.find(e => e.id === enemyId)?.health || 100) - damage),
          lastHit: now,
          hitPoint: hit.point,
        })

        return { hit: true, enemyId, damage, point: hit.point, distance: hit.distance }
      }

      // Hit world geometry
      return { hit: true, world: true, point: hit.point, distance: hit.distance }
    }

    return { hit: false, reason: 'miss' }
  }

  // Fire projectile weapon (cyberdeck)
  const fireProjectile = (command, config = {}) => {
    const {
      speed = 30,
      lifetime = 5,
      damage = 0,
      chargeCost = 1,
    } = config

    const weapon = player.weapons.cyberdeck
    if (weapon.charges < chargeCost) return null
    if (Date.now() < weapon.cooldown) return null

    use3DGameStore.getState().fireCyberDeck(command)

    const cam = player
    const origin = { x: cam.position[0], y: cam.position[1], z: cam.position[2] }
    const yaw = cam.rotationYaw
    const pitch = cam.pitch

    const direction = {
      x: -Math.sin(yaw) * Math.cos(pitch),
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * Math.cos(pitch),
    }

    return {
      command,
      origin,
      direction,
      speed,
      lifetime,
      damage,
      spawnTime: Date.now(),
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    }
  }

  return { raycast, fireHitscan, fireProjectile }
}

// Visual tracer effect for hitscan
export function createTracer(scene, origin, target, color = 0x00ffff, duration = 0.1) {
  // Implementation would create a line mesh or use drei <Line>
  // This is a placeholder for the visual effect
}