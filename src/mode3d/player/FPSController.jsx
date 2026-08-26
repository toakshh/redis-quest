import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useKeyboardControls } from './useKeyboardControls'
import { useMouseLook } from './useMouseLook'
import { useStaminaSystem } from './StaminaSystem'
import { use3DGameStore } from '../../stores/use3DGameStore'
import { COLLISION_GROUPS, COLLISION_MASKS } from '../physics/PhysicsWorld'

const PLAYER_HEIGHT = 1.7
const CAPSULE_RADIUS = 0.35
const CAPSULE_HALF_HEIGHT = 0.6
const WALK_SPEED = 4.5
const SPRINT_SPEED = 7.5
const CROUCH_SPEED = 2.2
const JUMP_VELOCITY = 6.5
const GRAVITY = -18
const FALL_DAMAGE_THRESHOLD = 12
const FALL_DAMAGE_MULTIPLIER = 4

export function FPSController({ camera, onLand, onDamage }) {
  const rapier = useRapier()
  const bodyRef = useRef(null)
  const colliderRef = useRef(null)
  const raycastDownRef = useRef(null)

  const { update: updateKeyboard } = useKeyboardControls()
  const { pointerLocked, requestPointerLock, exitPointerLock } = useMouseLook()
  const { update: updateStamina } = useStaminaSystem()

  const {
    player,
    setPlayerPosition,
    setPlayerVelocity,
    setGrounded,
    playerDamage,
    setPaused,
    phase,
  } = use3DGameStore.getState()

  // Initialize physics body
  useEffect(() => {
    if (!rapier.world) return

    // Create kinematic character controller
    const bodyDesc = rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(player.position[0], player.position[1], player.position[2])
      .setCcdEnabled(true)

    const body = rapier.world.createRigidBody(bodyDesc)
    bodyRef.current = body

    const colliderDesc = rapier.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS)
      .setFriction(0.0)
      .setRestitution(0.0)
      .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS)
      .setCollisionGroups(COLLISION_GROUPS.PLAYER)
      .setSolverGroups(COLLISION_MASKS.PLAYER)

    const collider = rapier.world.createCollider(colliderDesc, body)
    colliderRef.current = collider

    return () => {
      if (bodyRef.current) rapier.world.removeRigidBody(bodyRef.current)
      if (colliderRef.current) rapier.world.removeCollider(colliderRef.current)
    }
  }, [rapier])

  // Handle pointer lock on canvas click
  useEffect(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return

    const onClick = () => {
      if (phase === 'playing' && !pointerLocked) {
        requestPointerLock()
      }
    }

    canvas.addEventListener('click', onClick)
    return () => canvas.removeEventListener('click', onClick)
  }, [phase, pointerLocked, requestPointerLock])

  // Handle escape to pause
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && phase === 'playing') {
        exitPointerLock()
        setPaused(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, exitPointerLock, setPaused])

  // Main physics update loop
  useFrame((state, dt) => {
    if (phase !== 'playing' || !bodyRef.current || !rapier.world) return

    const body = bodyRef.current
    const { velocity, grounded, fallStartY, fallVelocity } = player

    // 1. Get keyboard input
    const { moveInput, sprinting, crouching, jumpPressed } = updateKeyboard(dt, grounded)

    // 2. Compute desired velocity
    let moveSpeed = WALK_SPEED
    if (sprinting) moveSpeed = SPRINT_SPEED
    else if (crouching) moveSpeed = CROUCH_SPEED

    // Convert local move input to world space using yaw
    const yaw = player.rotationYaw
    const forwardX = -Math.sin(yaw)
    const forwardZ = -Math.cos(yaw)
    const rightX = Math.cos(yaw)
    const rightZ = -Math.sin(yaw)

    const desiredVelX = (forwardX * moveInput.z + rightX * moveInput.x) * moveSpeed
    const desiredVelZ = (forwardZ * moveInput.z + rightZ * moveInput.x) * moveSpeed

    // 3. Handle jumping
    let newVelY = velocity[1]
    if (grounded) {
      if (jumpPressed) {
        newVelY = JUMP_VELOCITY
        setGrounded(false)
        updateStamina(dt, sprinting, true, false)
      }
    } else {
      // Apply gravity
      newVelY += GRAVITY * dt

      // Track fall for fall damage
      const fallDist = player.position[1] - (fallStartY || player.position[1])
      if (fallDist > 0 && newVelY < fallVelocity) {
        use3DGameStore.getState().player.fallVelocity = newVelY
      }
    }

    // 4. Apply horizontal velocity with acceleration
    const accel = grounded ? 30 : 10 // Air control reduced
    const currentVelX = velocity[0]
    const currentVelZ = velocity[2]

    const nextVelX = currentVelX + (desiredVelX - currentVelX) * Math.min(1, accel * dt)
    const nextVelZ = currentVelZ + (desiredVelZ - currentVelZ) * Math.min(1, accel * dt)

    // 5. Compute next position
    const nextPos = [
      player.position[0] + nextVelX * dt,
      player.position[1] + newVelY * dt,
      player.position[2] + nextVelZ * dt,
    ]

    // 6. Ground check via raycast
    let isGrounded = false
    if (rapier.world && colliderRef.current) {
      const rayOrigin = { x: nextPos[0], y: nextPos[1] + CAPSULE_HALF_HEIGHT, z: nextPos[2] }
      const rayDir = { x: 0, y: -1, z: 0 }
      const maxToi = CAPSULE_HALF_HEIGHT + 0.1

      const hit = rapier.world.castRay(rayOrigin, rayDir, maxToi, true, COLLISION_GROUPS.WORLD)
      isGrounded = hit !== null && hit.toi < maxToi
    }

    // 7. Handle landing / fall damage
    if (!grounded && isGrounded) {
      const impactSpeed = Math.abs(player.fallVelocity || newVelY)
      if (impactSpeed > FALL_DAMAGE_THRESHOLD) {
        const damage = (impactSpeed - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_MULTIPLIER
        playerDamage(damage)
        onDamage?.(damage, 'fall')
      }
      onLand?.()
      use3DGameStore.getState().player.fallStartY = null
      use3DGameStore.getState().player.fallVelocity = 0
    }

    if (!grounded && isGrounded) {
      use3DGameStore.getState().player.fallStartY = player.position[1]
    }

    // 8. Update physics body
    body.setNextKinematicTranslation({ x: nextPos[0], y: nextPos[1], z: nextPos[2] })

    // 9. Update store
    setPlayerPosition(nextPos)
    setPlayerVelocity([nextVelX, newVelY, nextVelZ])
    setGrounded(isGrounded)

    // 10. Stamina update
    updateStamina(dt, sprinting, false, false)
  })

  // Sync camera to body (handled by HeadBob, but position base is here)
  useEffect(() => {
    if (camera && bodyRef.current) {
      const pos = bodyRef.current.translation()
      camera.position.set(pos.x, pos.y + 0.1, pos.z) // Eye level offset
    }
  }, [camera])

  return null
}

// Helper hook to get player body for other systems
export function usePlayerBody() {
  return use3DGameStore(state => ({
    position: state.player.position,
    rotation: state.player.rotationYaw,
    velocity: state.player.velocity,
    grounded: state.player.grounded,
  }))
}