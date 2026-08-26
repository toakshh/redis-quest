/**
 * Anomaly 3D Entity Component
 * Handles mesh, physics, animation, and FSM integration
 */

import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { use3DGameStore } from '../../stores/use3DGameStore'
import { getAnomalyType } from './anomalyTypes'
import { createAnomalyFSM, updateAnomalyFSM, ANOMALY_STATES } from './anomalyAI'

const COLLISION_GROUPS = {
  WORLD: 0b0001,
  PLAYER: 0b0010,
  ENEMY: 0b0100,
  PROJECTILE: 0b1000,
}

const COLLISION_MASKS = {
  PLAYER: 0b0101,      // World + Enemy
  ENEMY: 0b0011,       // World + Player
  PROJECTILE: 0b0111,  // World + Player + Enemy
}

export function Anomaly({ anomaly, onDeath, onAttack }) {
  const rapier = useRapier()
  const bodyRef = useRef(null)
  const colliderRef = useRef(null)
  const meshRef = useRef(null)
  const fsmRef = useRef(null)
  const animationRef = useRef({ time: 0, phase: 0 })
  const hitFlashRef = useRef(0)

  const { enemies, player, phase: gamePhase } = use3DGameStore.getState()

  // Initialize FSM
  if (!fsmRef.current) {
    fsmRef.current = createAnomalyFSM(anomaly)
  }

  // Initialize physics
  useEffect(() => {
    if (!rapier.world) return

    const type = getAnomalyType(anomaly.typeId)
    const radius = type.stats.radius || 0.5
    const height = type.stats.height || 1.5
    const halfHeight = height * 0.5

    // Dynamic rigid body for physics simulation
    const bodyDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(anomaly.position[0], anomaly.position[1] + halfHeight, anomaly.position[2])
      .setCcdEnabled(true)
      .setLinearDamping(0.8)
      .setAngularDamping(10.0)
      .setGravityScale(1.0)

    const body = rapier.world.createRigidBody(bodyDesc)
    bodyRef.current = body

    // Capsule collider
    const colliderDesc = rapier.ColliderDesc.capsule(halfHeight, radius)
      .setFriction(0.3)
      .setRestitution(0.1)
      .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS)
      .setCollisionGroups(COLLISION_GROUPS.ENEMY)
      .setSolverGroups(COLLISION_MASKS.ENEMY)
      .setActiveCollisionTypes(rapier.ActiveCollisionTypes.DEFAULT)

    const collider = rapier.world.createCollider(colliderDesc, body)
    colliderRef.current = collider

    // Store anomaly ID on collider for raycast identification
    collider.userData = { anomalyId: anomaly.id, type: 'enemy' }

    return () => {
      if (bodyRef.current) rapier.world.removeRigidBody(bodyRef.current)
      if (colliderRef.current) rapier.world.removeCollider(colliderRef.current)
    }
  }, [rapier])

  // Main update loop
  useFrame((state, dt) => {
    if (gamePhase !== 'playing' || !bodyRef.current || !rapier.world) return

    const body = bodyRef.current
    const type = getAnomalyType(anomaly.typeId)
    const fsm = fsmRef.current

    // Update animation time
    animationRef.current.time += dt
    animationRef.current.phase = (animationRef.current.phase + dt * 2) % (Math.PI * 2)

    // Decay hit flash
    if (hitFlashRef.current > 0) {
      hitFlashRef.current = Math.max(0, hitFlashRef.current - dt * 5)
    }

    // Build world context for FSM
    const worldContext = {
      player: player.health > 0 ? {
        position: player.position,
        velocity: player.velocity,
        health: player.health,
      } : null,
      enemies: enemies.active.map(e => ({
        id: e.id,
        position: e.position,
        typeId: e.typeId,
        health: e.health,
      })),
      level: null, // Level geometry reference would go here
      dt,
      time: state.clock.getElapsedTime(),
      noiseEvents: [], // Populated by noise system
      onEnemyAttack: onAttack,
    }

    // Update FSM
    updateAnomalyFSM(anomaly, fsm, worldContext)

    // Apply physics movement
    const desiredVel = anomaly.desiredVelocity || [0, 0, 0]
    const desiredYaw = anomaly.desiredYaw !== undefined ? anomaly.desiredYaw : anomaly.rotationYaw

    // Smooth velocity
    const currentVel = body.linvel()
    const accel = fsm.state === ANOMALY_STATES.CHASE ? 20 : 15
    const nextVelX = currentVel.x + (desiredVel[0] - currentVel.x) * Math.min(1, accel * dt)
    const nextVelZ = currentVel.z + (desiredVel[2] - currentVel.z) * Math.min(1, accel * dt)

    body.setLinvel({ x: nextVelX, y: currentVel.y, z: nextVelZ })

    // Smooth rotation
    const currentRot = body.rotation()
    const targetRot = { x: 0, y: desiredYaw, z: 0, w: 1 }
    // Simple slerp for yaw only
    const yawDiff = desiredYaw - fsm.currentYaw || 0
    const normalizedDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff))
    const nextYaw = (fsm.currentYaw || 0) + normalizedDiff * Math.min(1, 10 * dt)
    fsm.currentYaw = nextYaw

    body.setNextKinematicRotation({ x: 0, y: nextYaw, z: 0, w: 1 })

    // Sync position to store
    const pos = body.translation()
    use3DGameStore.getState().updateEnemy(anomaly.id, {
      position: [pos.x, pos.y - halfHeight, pos.z],
      rotationYaw: nextYaw,
      state: fsm.state,
      threatLevel: fsm.threatLevel,
    })

    // Handle mesh visual updates
    if (meshRef.current) {
      updateMeshVisuals(meshRef.current, anomaly, fsm, type, animationRef.current, hitFlashRef.current)
    }
  })

  // Handle damage
  const takeDamage = (amount, source, knockback = null) => {
    const newHealth = Math.max(0, anomaly.health - amount)
    hitFlashRef.current = 1.0

    use3DGameStore.getState().updateEnemy(anomaly.id, { health: newHealth })

    // Apply knockback
    if (knockback && bodyRef.current) {
      bodyRef.current.setLinvel({
        x: knockback[0],
        y: knockback[1],
        z: knockback[2],
      })
    }

    // Stun
    if (amount > 15) {
      anomaly.stunnedUntil = Date.now() + 1000
    }

    // Death
    if (newHealth <= 0) {
      die(source)
    }
  }

  const die = (source) => {
    const type = getAnomalyType(anomaly.typeId)

    // Death effects
    if (type.behavior?.explodeOnDeath) {
      // Explosion handled by EnemyManager
      if (onAttack) {
        onAttack({
          anomalyId: anomaly.id,
          type: 'explosion',
          position: [...anomaly.position],
          radius: type.behavior.explosionRadius,
          damage: type.behavior.explosionDamage,
        })
      }
    }

    // Split behavior (sludge blob)
    if (type.behavior?.splitsOnDamageThreshold && anomaly.health / anomaly.maxHealth < type.behavior.splitsOnDamageThreshold) {
      // Split logic in EnemyManager
    }

    // Remove from physics
    if (bodyRef.current && rapier.world) {
      rapier.world.removeRigidBody(bodyRef.current)
    }
    if (colliderRef.current && rapier.world) {
      rapier.world.removeCollider(colliderRef.current)
    }

    // Notify store
    use3DGameStore.getState().killEnemy(anomaly.id)

    // Callback
    if (onDeath) {
      onDeath(anomaly, type)
    }
  }

  // Expose damage function globally for raycast system
  useEffect(() => {
    window[`anomaly_${anomaly.id}_damage`] = takeDamage
    return () => { delete window[`anomaly_${anomaly.id}_damage`] }
  }, [anomaly.id])

  // Render mesh
  const mesh = useMemo(() => createAnomalyMesh(anomaly, type), [anomaly.typeId, anomaly.id])

  return (
    <group ref={meshRef} position={anomaly.position} rotation={[0, anomaly.rotationYaw || 0, 0]}>
      {mesh}
      {/* Health bar above enemy */}
      {anomaly.health > 0 && anomaly.health < anomaly.maxHealth && (
        <EnemyHealthBar
          health={anomaly.health}
          maxHealth={anomaly.maxHealth}
          position={[0, (getAnomalyType(anomaly.typeId).stats.height || 1.5) + 0.5, 0]}
        />
      )}
    </group>
  )
}

/**
 * Create procedural anomaly mesh based on type
 */
function createAnomalyMesh(anomaly, type) {
  const visuals = type.visuals || {}
  const baseColor = visuals.baseColor || 0xff0000
  const emissiveColor = visuals.emissiveColor || 0xffffff
  const emissiveIntensity = visuals.emissiveIntensity || 0.5
  const scale = visuals.scale || 1.0
  const meshType = visuals.meshType || 'basic'

  const materials = useMemo(() => ({
    body: {
      color: baseColor,
      metalness: 0.3,
      roughness: 0.7,
      emissive: emissiveColor,
      emissiveIntensity,
      transparent: false,
    },
    glow: {
      color: emissiveColor,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    },
  }), [baseColor, emissiveColor, emissiveIntensity])

  switch (meshType) {
    case 'stampeder':
      return createStampederMesh(materials, scale)
    case 'siegeDrone':
      return createSiegeDroneMesh(materials, scale)
    case 'sludgeBlob':
      return createSludgeBlobMesh(materials, scale)
    case 'phantomConsumer':
      return createPhantomConsumerMesh(materials, scale)
    case 'nullPointer':
      return createNullPointerMesh(materials, scale)
    default:
      return createBasicMesh(materials, scale)
  }
}

function createStampederMesh(materials, scale) {
  return (
    <group scale={scale}>
      {/* Core body - spiked sphere */}
      <mesh geometry={new THREE.IcosahedronGeometry(0.5, 1)} castShadow receiveShadow>
        <meshStandardMaterial {...materials.body} />
      </mesh>
      {/* Spikes */}
      <mesh geometry={new THREE.IcosahedronGeometry(0.7, 0)} castShadow>
        <meshStandardMaterial {...materials.body} {...materials.glow} />
      </mesh>
      {/* Inner glow */}
      <mesh geometry={new THREE.SphereGeometry(0.3, 16, 16)}>
        <meshBasicMaterial {...materials.glow} />
      </mesh>
    </group>
  )
}

function createSiegeDroneMesh(materials, scale) {
  return (
    <group scale={scale}>
      {/* Main chassis */}
      <mesh geometry={new THREE.OctahedronGeometry(0.6, 0)} castShadow receiveShadow>
        <meshStandardMaterial {...materials.body} />
      </mesh>
      {/* Engine nacelles */}
      <mesh position={[-0.5, 0, 0]} geometry={new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8)} castShadow>
        <meshStandardMaterial {...materials.body} />
      </mesh>
      <mesh position={[0.5, 0, 0]} geometry={new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8)} castShadow>
        <meshStandardMaterial {...materials.body} />
      </mesh>
      {/* Sensor array */}
      <mesh position={[0, 0.5, 0.4]} geometry={new THREE.ConeGeometry(0.1, 0.3, 8)} castShadow>
        <meshStandardMaterial {...materials.glow} />
      </mesh>
      {/* Shield indicator */}
      <mesh geometry={new THREE.SphereGeometry(0.9, 16, 16)}>
        <meshBasicMaterial {...materials.glow} opacity={0.1} />
      </mesh>
    </group>
  )
}

function createSludgeBlobMesh(materials, scale) {
  return (
    <group scale={scale}>
      {/* Amorphous body - metaball approximation */}
      <mesh geometry={new THREE.SphereGeometry(0.8, 12, 12)} castShadow receiveShadow>
        <meshStandardMaterial {...materials.body} />
      </mesh>
      {/* Corruption particles */}
      <mesh geometry={new THREE.SphereGeometry(1.0, 8, 8)}>
        <meshBasicMaterial {...materials.glow} opacity={0.2} />
      </mesh>
      {/* Inner corruption */}
      <mesh geometry={new THREE.SphereGeometry(0.4, 8, 8)}>
        <meshBasicMaterial {...materials.glow} opacity={0.5} />
      </mesh>
    </group>
  )
}

function createPhantomConsumerMesh(materials, scale) {
  return (
    <group scale={scale}>
      {/* Humanoid silhouette */}
      <mesh geometry={new THREE.CapsuleGeometry(0.2, 1.2, 4, 8)} castShadow receiveShadow>
        <meshStandardMaterial {...materials.body} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.0, 0]} geometry={new THREE.SphereGeometry(0.25, 8, 8)} castShadow>
        <meshStandardMaterial {...materials.body} />
      </mesh>
      {/* Glitch fragments */}
      <mesh geometry={new THREE.BoxGeometry(0.1, 1.5, 0.1)} position={[0.4, 0, 0]}>
        <meshBasicMaterial {...materials.glow} opacity={0.4} />
      </mesh>
      <mesh geometry={new THREE.BoxGeometry(0.1, 1.5, 0.1)} position={[-0.4, 0, 0]}>
        <meshBasicMaterial {...materials.glow} opacity={0.4} />
      </mesh>
      {/* Phasing effect */}
      <mesh geometry={new THREE.SphereGeometry(1.2, 16, 16)}>
        <meshBasicMaterial {...materials.glow} opacity={0.15} />
      </mesh>
    </group>
  )
}

function createNullPointerMesh(materials, scale) {
  return (
    <group scale={scale}>
      {/* Core polyhedron - shifting geometry */}
      <mesh geometry={new THREE.DodecahedronGeometry(1.0, 1)} castShadow receiveShadow>
        <meshStandardMaterial {...materials.body} />
      </mesh>
      {/* Outer rotating shell */}
      <mesh geometry={new THREE.IcosahedronGeometry(1.5, 0)}>
        <meshBasicMaterial {...materials.glow} opacity={0.15} wireframe />
      </mesh>
      {/* Void particles */}
      <mesh geometry={new THREE.SphereGeometry(2.0, 12, 12)}>
        <meshBasicMaterial {...materials.glow} opacity={0.08} />
      </mesh>
      {/* Central singularity */}
      <mesh geometry={new THREE.SphereGeometry(0.3, 16, 16)}>
        <meshBasicMaterial { ...materials.glow, color: 0xffffff, opacity: 1.0 } />
      </mesh>
    </group>
  )
}

function createBasicMesh(materials, scale) {
  return (
    <group scale={scale}>
      <mesh geometry={new THREE.CapsuleGeometry(0.4, 1.0, 4, 8)} castShadow receiveShadow>
        <meshStandardMaterial {...materials.body} />
      </mesh>
    </group>
  )
}

/**
 * Update mesh visuals based on state
 */
function updateMeshVisuals(mesh, anomaly, fsm, type, animation, hitFlash) {
  const visuals = type.visuals || {}
  const baseEmissive = visuals.emissiveIntensity || 0.5
  const glitchFreq = visuals.glitchFrequency || 0.1

  // Traverse materials
  mesh.traverse((child) => {
    if (child.isMesh && child.material) {
      const mat = child.material

      // Hit flash
      if (hitFlash > 0) {
        mat.emissiveIntensity = baseEmissive + hitFlash * 2
        mat.color.setHex(0xffffff)
      } else {
        mat.emissiveIntensity = baseEmissive
        mat.color.setHex(visuals.baseColor || 0xff0000)
      }

      // Glitch effect
      if (glitchFreq > 0 && Math.random() < glitchFreq * 0.01) {
        mat.emissiveIntensity = baseEmissive * (1 + Math.random() * 0.5)
      }

      // State-based effects
      if (fsm.state === ANOMALY_STATES.ALERT || fsm.state === ANOMALY_STATES.CHASE) {
        mat.emissiveIntensity = baseEmissive * 1.5
      }

      // Boss phase effects
      if (type.isBoss && fsm.currentPhase > 0) {
        mat.emissiveIntensity = baseEmissive * (1 + fsm.currentPhase * 0.5)
      }
    }
  })

  // Rotation animations
  mesh.rotation.y = animation.phase * 0.5
  mesh.children.forEach((child, i) => {
    if (child.isMesh && child.geometry.type === 'IcosahedronGeometry') {
      child.rotation.y = -animation.phase * 0.3
      child.rotation.x = animation.phase * 0.2
    }
  })
}

/**
 * Simple health bar component
 */
function EnemyHealthBar({ health, maxHealth, position }) {
  const percent = health / maxHealth

  return (
    <group position={position} scale={0.5}>
      <mesh geometry={new THREE.PlaneGeometry(1.2, 0.15)} position={[0, 0, 0.1]}>
        <meshBasicMaterial color={0x000000} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh
        geometry={new THREE.PlaneGeometry(1.0 * percent, 0.1)}
        position={[-0.6 * (1 - percent), 0, 0.11]}
      >
        <meshBasicMaterial
          color={percent > 0.5 ? 0x00ff00 : percent > 0.25 ? 0xffaa00 : 0xff0000}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export default Anomaly