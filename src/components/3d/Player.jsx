import React, { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { PointerLockControls, useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import { useCombatStore } from '../../store/combatStore'
import { useGameStore } from '../../store/gameStore'

const SPEED = 8
const SPRINT_MULTIPLIER = 1.5
const JUMP_FORCE = 6

export default function Player() {
  const rigidBody = useRef()
  const [, getKeys] = useKeyboardControls()
  const { camera } = useThree()

  const fireProjectile = useCombatStore(state => state.fireProjectile)
  const lastFireRef = useRef(0)

  const direction = new THREE.Vector3()
  const frontVector = new THREE.Vector3()
  const sideVector = new THREE.Vector3()

  useEffect(() => {
    const handleMouseDown = (e) => {
      if (document.pointerLockElement) {
        // Fire projectile
        if (e.button === 0) { // Left click
          const engine = useGameStore.getState().engine
          let cooldown = 500 // default 500ms

          if (engine && engine.store && engine.store.has('weapon:cooldown')) {
             const val = Number(engine.store.get('weapon:cooldown').value)
             if (!isNaN(val)) cooldown = val
          }

          const now = Date.now()
          if (now - lastFireRef.current < cooldown) {
             // Rate limited
             return
          }
          lastFireRef.current = now

          const dir = new THREE.Vector3(0, 0, -1)
          dir.applyEuler(camera.rotation)

          // Start slightly ahead of the camera to prevent shooting oneself
          const origin = camera.position.clone().add(dir.clone().multiplyScalar(1.5))

          fireProjectile([origin.x, origin.y, origin.z], [dir.x, dir.y, dir.z])
        }
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [camera, fireProjectile])

  useFrame(() => {
    if (!rigidBody.current) return

    const keys = getKeys()
    const velocity = rigidBody.current.linvel()
    const translation = rigidBody.current.translation()

    // Move camera to player position (eye level)
    camera.position.set(translation.x, translation.y + 0.8, translation.z)

    // Calculate movement relative to camera look direction
    frontVector.set(0, 0, Number(keys.backward) - Number(keys.forward))
    sideVector.set(Number(keys.left) - Number(keys.right), 0, 0)

    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(SPEED * (keys.sprint ? SPRINT_MULTIPLIER : 1))
      .applyEuler(camera.rotation)

    // Lock Y movement to physics (falling)
    rigidBody.current.setLinvel({ x: direction.x, y: velocity.y, z: direction.z })

    // Jumping
    if (keys.jump && Math.abs(velocity.y) < 0.1) {
      rigidBody.current.setLinvel({ x: velocity.x, y: JUMP_FORCE, z: velocity.z })
    }
  })

  return (
    <>
      <PointerLockControls />
      <RigidBody
        ref={rigidBody}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[0, 2, 0]}
        enabledRotations={[false, false, false]}
        name="player"
      >
        <CapsuleCollider args={[0.4, 0.4]} />
      </RigidBody>
    </>
  )
}

