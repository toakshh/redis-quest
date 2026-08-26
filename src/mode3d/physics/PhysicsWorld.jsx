import { useEffect, useRef, useState } from 'react'
import { Physics, Rapier } from '@react-three/rapier'

// Collision groups (bitmasks)
export const COLLISION_GROUPS = {
  DEFAULT: 0b0001,
  PLAYER: 0b0010,
  ENEMY: 0b0100,
  WORLD: 0b1000,
  TRIGGER: 0b10000,
  PROJECTILE: 0b100000,
}

// Collision masks - what each group collides with
export const COLLISION_MASKS = {
  PLAYER: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.TRIGGER,
  ENEMY: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ENEMY,
  WORLD: COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.PROJECTILE,
  TRIGGER: COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ENEMY,
  PROJECTILE: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY,
}

export const PHYSICS_MATERIALS = {
  default: { friction: 0.6, restitution: 0.1 },
  player: { friction: 0.0, restitution: 0.0 }, // No friction for smooth movement
  enemy: { friction: 0.4, restitution: 0.1 },
  bouncy: { friction: 0.3, restitution: 0.7 },
  ice: { friction: 0.01, restitution: 0.0 },
}

let RAPIER = null

export async function initRapier() {
  if (RAPIER) return RAPIER
  RAPIER = await Rapier()
  return RAPIER
}

export function PhysicsWorld({ children, gravity = { x: 0, y: -9.81, z: 0 }, timestep = 1/60, maxSubsteps = 4 }) {
  const [rapier, setRapier] = useState(null)

  useEffect(() => {
    initRapier().then(setRapier)
  }, [])

  if (!rapier) {
    return <>{children}</> // Render children without physics while loading
  }

  return (
    <Physics
      world={rapier}
      gravity={gravity}
      timestep={timestep}
      maxSubsteps={maxSubsteps}
      positionIterations={8}
      velocityIterations={4}
    >
      {children}
    </Physics>
  )
}

// Debug drawer for development
export function PhysicsDebug({ enabled = false, world }) {
  const linesRef = useRef(null)

  useEffect(() => {
    if (!enabled || !world || !linesRef.current) return

    const debugRender = world.debugRender()
    const positions = new Float32Array(debugRender.vertices)
    const colors = new Float32Array(debugRender.colors)

    // Update line geometry
    // Implementation depends on drei/three setup
  }, [enabled, world])

  return null
}

// Raycast helper
export function raycast(world, origin, direction, maxToi = 100, groups = COLLISION_GROUPS.DEFAULT) {
  if (!world) return null
  const ray = new RAPIER.Ray({ x: origin[0], y: origin[1], z: origin[2] }, { x: direction[0], y: direction[1], z: direction[2] })
  return world.castRay(ray, maxToi, true, groups)
}

// Kinematic character controller helper
export function createCharacterController(rapier, position, radius = 0.35, halfHeight = 0.6) {
  const bodyDesc = rapier.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(position[0], position[1], position[2])
    .setCcdEnabled(true)

  const body = rapier.world.createRigidBody(bodyDesc)

  const colliderDesc = rapier.ColliderDesc.capsule(halfHeight, radius)
    .setFriction(0.0)
    .setRestitution(0.0)
    .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS)
    .setCollisionGroups(COLLISION_GROUPS.PLAYER)
    .setSolverGroups(COLLISION_MASKS.PLAYER)

  const collider = rapier.world.createCollider(colliderDesc, body)

  return { body, collider }
}

// Dynamic rigid body for props/enemies
export function createDynamicBody(rapier, position, colliderDesc, mass = 1) {
  const bodyDesc = rapier.RigidBodyDesc.dynamic()
    .setTranslation(position[0], position[1], position[2])
    .setMass(mass)
    .setCcdEnabled(true)

  const body = rapier.world.createRigidBody(bodyDesc)
  const collider = rapier.world.createCollider(colliderDesc, body)

  return { body, collider }
}

// Static body for level geometry
export function createStaticBody(rapier, position, colliderDesc) {
  const bodyDesc = rapier.RigidBodyDesc.fixed()
    .setTranslation(position[0], position[1], position[2])

  const body = rapier.world.createRigidBody(bodyDesc)
  const collider = rapier.world.createCollider(colliderDesc, body)

  return { body, collider }
}