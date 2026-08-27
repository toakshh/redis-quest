import React, { useEffect, useRef } from 'react'
import { useRapier, RigidBody, CapsuleCollider } from '@react-three/rapier'
import { FEEL } from '../../config/feel.js'

export default function CharacterController() {
  const { world } = useRapier()
  const controllerRef = useRef(null)

  useEffect(() => {
    // Create Rapier KinematicCharacterController with offset 0.01
    const controller = world.createCharacterController(0.01)
    controller.setApplyImpulsesToDynamicBodies(true)
    controllerRef.current = controller

    return () => {
      // Clean up the controller
      world.removeCharacterController(controller)
      controllerRef.current = null
    }
  }, [world])

  // height is 1.8, radius is 0.4.
  // In Rapier, a Capsule takes halfHeight and radius.
  // Total height = 2 * halfHeight + 2 * radius = 2 * 0.5 + 2 * 0.4 = 1.0 + 0.8 = 1.8.
  // So halfHeight = 0.5, radius = 0.4

  return (
    <RigidBody
      type="kinematicPosition"
      colliders={false}
      // Usually would lock rotations or attach refs here to drive it in useFrame
    >
      <CapsuleCollider args={[0.5, 0.4]} />
    </RigidBody>
  )
}
