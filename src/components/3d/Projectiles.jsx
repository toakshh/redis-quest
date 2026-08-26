import React, { useEffect, useRef } from 'react'
import { RigidBody } from '@react-three/rapier'
import { useCombatStore } from '../../store/combatStore'

function Projectile({ id, position, direction, speed }) {
  const rigidBody = useRef()
  const removeProjectile = useCombatStore(state => state.removeProjectile)
  const damageEnemy = useCombatStore(state => state.damageEnemy)

  useEffect(() => {
    // Destroy after 3 seconds to prevent memory leaks
    const timeout = setTimeout(() => {
      removeProjectile(id)
    }, 3000)
    return () => clearTimeout(timeout)
  }, [id, removeProjectile])

  useEffect(() => {
    if (rigidBody.current) {
      // Apply initial velocity
      rigidBody.current.setLinvel({
        x: direction[0] * speed,
        y: direction[1] * speed,
        z: direction[2] * speed,
      })
    }
  }, [direction, speed])

  const handleCollision = (e) => {
    // Check what we hit
    // If it's an enemy, damage it
    if (e.other.rigidBodyObject && e.other.rigidBodyObject.name === 'enemy') {
      const enemyId = e.other.rigidBodyObject.userData?.id
      if (enemyId) damageEnemy(enemyId, 25)
    }

    // Create explosion effect here later

    // Remove the projectile on contact
    removeProjectile(id)
  }

  return (
    <RigidBody
      ref={rigidBody}
      position={position}
      type="dynamic"
      gravityScale={0}
      colliders="ball"
      sensor
      onIntersectionEnter={handleCollision}
      name="projectile"
    >
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#00ff9d" />
      </mesh>
      {/* Light emitted by the projectile */}
      <pointLight color="#00ff9d" intensity={1} distance={5} />
    </RigidBody>
  )
}

export default function Projectiles() {
  const projectiles = useCombatStore((state) => state.projectiles)

  return (
    <group>
      {projectiles.map((p) => (
        <Projectile key={p.id} {...p} />
      ))}
    </group>
  )
}
