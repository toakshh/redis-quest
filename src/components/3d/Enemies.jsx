import React, { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { useCombatStore } from '../../store/combatStore'
import * as THREE from 'three'

function Enemy({ id, position, health }) {
  const rigidBody = useRef()
  const { camera } = useThree()

  // Basic follow player AI
  const enemyPos = new THREE.Vector3()
  const playerPos = new THREE.Vector3()
  const moveDir = new THREE.Vector3()

  useFrame(() => {
    if (!rigidBody.current) return

    // Simplistic AI: Move towards the camera (player)
    enemyPos.copy(rigidBody.current.translation())
    playerPos.copy(camera.position)

    // Ignore Y axis for chasing so they don't fly up/down weirdly
    playerPos.y = enemyPos.y

    const dist = enemyPos.distanceTo(playerPos)
    if (dist > 1.5 && dist < 30) {
      moveDir.subVectors(playerPos, enemyPos).normalize().multiplyScalar(3) // speed 3
      const currentVel = rigidBody.current.linvel()
      rigidBody.current.setLinvel({ x: moveDir.x, y: currentVel.y, z: moveDir.z })

      // Look at player
      // We can compute a rotation quaternion and apply it
      const lookMatrix = new THREE.Matrix4().lookAt(enemyPos, playerPos, new THREE.Vector3(0,1,0))
      const quat = new THREE.Quaternion().setFromRotationMatrix(lookMatrix)
      rigidBody.current.setRotation(quat)
    }
  })

  // Color changes based on health
  const color = health > 50 ? '#ff007b' : '#ff0000'

  return (
    <RigidBody
      ref={rigidBody}
      position={position}
      type="dynamic"
      colliders="capsule"
      enabledRotations={[false, false, false]}
      name="enemy"
      userData={{ id }}
    >
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[0.5, 1, 4, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} wireframe={health < 50} />
      </mesh>
    </RigidBody>
  )
}

export default function Enemies() {
  const enemies = useCombatStore(state => state.enemies)
  const spawnEnemy = useCombatStore(state => state.spawnEnemy)

  // Spawn some initial enemies
  useEffect(() => {
    if (enemies.length === 0) {
      spawnEnemy([10, 2, -10])
      spawnEnemy([-10, 2, -20])
      spawnEnemy([15, 2, 5])
      spawnEnemy([-5, 2, 15])
    }
  }, [enemies.length, spawnEnemy])

  return (
    <group>
      {enemies.map(e => (
        <Enemy key={e.id} {...e} />
      ))}
    </group>
  )
}
