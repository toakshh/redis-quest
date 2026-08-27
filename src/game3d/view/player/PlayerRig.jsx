import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { FEEL } from '../../config/feel.js'
import * as THREE from 'three'

export default function PlayerRig({ isSprinting = false, velocity = { x: 0, z: 0 } }) {
  const { camera } = useThree()
  const clockRef = useRef(0)

  useFrame((state, delta) => {
    // 1. FOV Lerp
    const targetFov = isSprinting ? FEEL.camera.fovSprint : FEEL.camera.fovDefault
    const fovLerpFactor = 1 - Math.exp(-delta * 1000 / FEEL.camera.fovLerpMs) // Frame-rate independent lerp approx
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, fovLerpFactor)
    camera.updateProjectionMatrix()

    // 2. Head Bob
    // We only bob if moving. The absolute speed gives a weighting to the bob.
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
    const isMoving = speed > 0.1

    if (isMoving) {
      clockRef.current += delta
      const bob = Math.sin(clockRef.current * FEEL.camera.headBobHz * Math.PI * 2) * FEEL.camera.headBobAmplitude
      // Apply bob to local Y position (we assume the rig is placed appropriately or modifying the camera position)
      // Standard practice: rig local Y rests at 0, bob applies an offset.
      camera.position.y = bob
    } else {
      // Lerp back to center
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0, fovLerpFactor)
      clockRef.current = 0
    }

    // 3. Strafe Roll
    // Assume velocity.x is lateral velocity in local space. If it's global, we'd need to inverse transform it.
    // The contract just says "velocity", we'll use velocity.x for strafing simple approximation.
    const rollTarget = -velocity.x * (FEEL.camera.strafeRollDeg * THREE.MathUtils.DEG2RAD)
    // We apply roll to camera's local Z rotation
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, rollTarget, fovLerpFactor)
  })

  return <PointerLockControls />
}
