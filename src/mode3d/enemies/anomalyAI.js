import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { use3DGameStore } from '../../stores/use3DGameStore'
import { getAnomalyType } from './anomalyTypes'
import { COLLISION_GROUPS, COLLISION_MASKS } from '../physics/PhysicsWorld'

// FSM States
const STATES = {
  PATROL: 'patrol',
  ALERT: 'alert',
  CHASE: 'chase',
  ATTACK: 'attack',
  STUNNED: 'stunned',
  DEATH: 'death',
}

const STATE_TRANSITIONS = {
  [STATES.PATROL]: { ALERT: (ctx) => ctx.distanceToPlayer < ctx.type.senseRadius && ctx.hasLOS },
  [STATES.ALERT]: { CHASE: (ctx) => ctx.distanceToPlayer < ctx.type.senseRadius * 1.5, PATROL: (ctx) => ctx.distanceToPlayer > ctx.type.senseRadius * 2 },
  [STATES.CHASE]: { ATTACK: (ctx) => ctx.distanceToPlayer <= ctx.type.attackRange && ctx.attackCooldown <= 0, ALERT: (ctx) => ctx.distanceToPlayer > ctx.type.senseRadius * 1.5 || !ctx.hasLOS },
  [STATES.ATTACK]: { CHASE: (ctx) => ctx.distanceToPlayer > ctx.type.attackRange || ctx.attackCooldown > 0, STUNNED: (ctx) => ctx.health <= 0 },
  [STATES.STUNNED]: { CHASE: (ctx) => ctx.stunTimer <= 0, DEATH: (ctx) => ctx.health <= 0 },
  [STATES.DEATH]: {},
}

export function anomalyAI(anomaly, dt, playerPosition, rapier) {
  const { id, type, position, health, state, target, lastAttack, stunTimer, splitCooldown } = anomaly
  const anomalyType = getAnomalyType(type)

  // Build context for transitions
  const dx = playerPosition[0] - position[0]
  const dz = playerPosition[2] - position[2]
  const distanceToPlayer = Math.hypot(dx, dz)
  const hasLOS = checkLineOfSight(position, playerPosition, rapier)

  const ctx = {
    id,
    type: anomalyType,
    position,
    health,
    state,
    distanceToPlayer,
    hasLOS,
    attackCooldown: (lastAttack ? Date.now() - lastAttack : Infinity) / 1000,
    stunTimer: stunTimer || 0,
    splitCooldown: splitCooldown || 0,
  }

  // Decrement timers
  if (ctx.stunTimer > 0) ctx.stunTimer -= dt
  if (ctx.splitCooldown > 0) ctx.splitCooldown -= dt

  // State transitions
  const transitions = STATE_TRANSITIONS[state] || {}
  for (const [nextState, condition] of Object.entries(transitions)) {
    if (condition(ctx)) {
      return { ...anomaly, state: nextState }
    }
  }

  // State behaviors
  let newAnomaly = { ...anomaly, ...ctx }

  switch (state) {
    case STATES.PATROL:
      newAnomaly = patrolBehavior(newAnomaly, dt, rapier)
      break
    case STATES.ALERT:
      newAnomaly = alertBehavior(newAnomaly, dt, playerPosition, rapier)
      break
    case STATES.CHASE:
      newAnomaly = chaseBehavior(newAnomaly, dt, playerPosition, rapier)
      break
    case STATES.ATTACK:
      newAnomaly = attackBehavior(newAnomaly, dt, playerPosition)
      break
    case STATES.STUNNED:
      newAnomaly = stunnedBehavior(newAnomaly, dt)
      break
    case STATES.DEATH:
      newAnomaly = deathBehavior(newAnomaly, dt)
      break
  }

  return newAnomaly
}

function checkLineOfSight(from, to, rapier) {
  if (!rapier?.world) return true
  const dir = { x: to[0] - from[0], y: to[1] - from[1], z: to[2] - from[2] }
  const dist = Math.hypot(dir.x, dir.y, dir.z)
  if (dist === 0) return true
  dir.x /= dist; dir.y /= dist; dir.z /= dist
  const ray = new rapier.RAPIER.Ray(from, dir)
  const hit = rapier.world.castRay(ray, dist, true, COLLISION_GROUPS.WORLD)
  return hit === null || hit.toi >= dist - 0.5
}

function patrolBehavior(anomaly, dt, rapier) {
  const { type, position } = anomaly
  // Simple wandering: pick random nearby point every few seconds
  if (!anomaly.patrolTarget || Math.hypot(anomaly.patrolTarget[0] - position[0], anomaly.patrolTarget[2] - position[2]) < 1) {
    const angle = Math.random() * Math.PI * 2
    const radius = 5 + Math.random() * 10
    anomaly.patrolTarget = [
      position[0] + Math.cos(angle) * radius,
      position[1],
      position[2] + Math.sin(angle) * radius,
    ]
    anomaly.patrolTimer = 3 + Math.random() * 5
  }

  anomaly.patrolTimer = (anomaly.patrolTimer || 0) - dt

  return moveTowards(anomaly, anomaly.patrolTarget, type.speed * 0.3, dt, rapier)
}

function alertBehavior(anomaly, dt, playerPosition, rapier) {
  // Face player, prepare to chase
  anomaly.lastKnownPlayerPos = [...playerPosition]
  return moveTowards(anomaly, playerPosition, anomaly.type.speed * 0.5, dt, rapier)
}

function chaseBehavior(anomaly, dt, playerPosition, rapier) {
  const { type } = anomaly
  anomaly.lastKnownPlayerPos = [...playerPosition]
  return moveTowards(anomaly, playerPosition, type.speed, dt, rapier)
}

function attackBehavior(anomaly, dt, playerPosition) {
  const { type } = anomaly
  anomaly.lastAttack = Date.now()
  // Damage applied externally via weapon hit detection
  // Just signal attack occurred
  return { ...anomaly, attacking: true }
}

function stunnedBehavior(anomaly, dt) {
  // Play hit animation, wait for stunTimer to expire
  return { ...anomaly, velocity: [0, anomaly.velocity?.[1] || 0, 0] }
}

function deathBehavior(anomaly, dt) {
  // Ragdoll handled by Anomaly.jsx
  return anomaly
}

function moveTowards(anomaly, target, speed, dt, rapier) {
  const { position } = anomaly
  const dx = target[0] - position[0]
  const dz = target[2] - position[2]
  const dist = Math.hypot(dx, dz)

  if (dist < 0.5) {
    return { ...anomaly, velocity: [0, anomaly.velocity?.[1] || 0, 0] }
  }

  const vx = (dx / dist) * speed
  const vz = (dz / dist) * speed

  // Simple collision avoidance via raycast
  if (rapier?.world) {
    const nextPos = { x: position[0] + vx * dt, y: position[1], z: position[2] + vz * dt }
    const ray = new rapier.RAPIER.Ray(position, { x: vx, y: 0, z: vz })
    const hit = rapier.world.castRay(ray, speed * dt + 0.5, true, COLLISION_GROUPS.WORLD)
    if (hit && hit.toi < speed * dt) {
      // Slide along wall
      const slideX = -vz * 0.5
      const slideZ = vx * 0.5
      return { ...anomaly, velocity: [slideX, anomaly.velocity?.[1] || 0, slideZ] }
    }
  }

  return { ...anomaly, velocity: [vx, anomaly.velocity?.[1] || 0, vz] }
}

// Hook for EnemyManager to use
export function useAnomalyAI() {
  const rapier = useRapier()
  const { enemies, updateEnemy } = use3DGameStore.getState()
  const playerPos = use3DGameStore.getState().player.position

  useFrame((_, dt) => {
    if (!rapier.world) return
    enemies.active.forEach(anomaly => {
      if (anomaly.health <= 0 && anomaly.state !== STATES.DEATH) return
      const updated = anomalyAI(anomaly, dt, playerPos, rapier)
      if (updated !== anomaly) updateEnemy(anomaly.id, updated)
    })
  })

  return null
}

// Need useRapier import
import { useRapier } from '@react-three/rapier'