/**
 * Ragdoll System - Dynamic physics fragments for anomaly destruction
 * Creates procedural debris with Rapier physics on enemy death
 */

import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'

const FRAGMENT_LIFETIME = 8.0 // seconds before cleanup
const MAX_FRAGMENTS = 50 // Global limit

// Fragment pool for performance
const fragmentPool = []
let activeFragments = 0

export function Ragdoll({ anomaly, position, velocity = [0, 0, 0], impulse = null }) {
  const rapier = useRapier()
  const fragmentsRef = useRef([])
  const cleanupTimerRef = useRef(0)
  const initializedRef = useRef(false)

  // Create fragments based on anomaly type
  useEffect(() => {
    if (!rapier.world || initializedRef.current) return
    initializedRef.current = true

    const type = anomaly.typeId
    const fragmentCount = getFragmentCount(type)
    const fragments = createFragments(rapier, anomaly, position, velocity, impulse, fragmentCount)

    fragmentsRef.current = fragments
    activeFragments += fragments.length
    cleanupTimerRef.current = 0

    // Cleanup old fragments if over limit
    if (activeFragments > MAX_FRAGMENTS) {
      cleanupOldestFragments(rapier, activeFragments - MAX_FRAGMENTS)
    }

    return () => {
      // Cleanup on unmount
      fragments.forEach(f => {
        if (f.body && rapier.world) rapier.world.removeRigidBody(f.body)
        if (f.collider && rapier.world) rapier.world.removeCollider(f.collider)
      })
      activeFragments -= fragments.length
    }
  }, [rapier, anomaly, position])

  // Update fragment lifetimes
  useFrame((_, dt) => {
    if (!rapier.world) return

    cleanupTimerRef.current += dt

    fragmentsRef.current.forEach((fragment, index) => {
      fragment.lifetime += dt

      // Apply gravity and damping
      if (fragment.body) {
        const vel = fragment.body.linvel()
        fragment.body.setLinvel({
          x: vel.x * 0.99,
          y: vel.y - 9.81 * dt,
          z: vel.z * 0.99,
        })

        // Add slight rotation
        const angVel = fragment.body.angvel()
        fragment.body.setAngvel({
          x: angVel.x * 0.98,
          y: angVel.y * 0.98,
          z: angVel.z * 0.98,
        })
      }

      // Fade out near end of life
      if (fragment.lifetime > FRAGMENT_LIFETIME * 0.7) {
        fragment.alpha = Math.max(0, 1 - (fragment.lifetime - FRAGMENT_LIFETIME * 0.7) / (FRAGMENT_LIFETIME * 0.3))
      }

      // Remove expired
      if (fragment.lifetime >= FRAGMENT_LIFETIME) {
        if (fragment.body && rapier.world) rapier.world.removeRigidBody(fragment.body)
        if (fragment.collider && rapier.world) rapier.world.removeCollider(fragment.collider)
        fragmentsRef.current.splice(index, 1)
        activeFragments--
      }
    })
  })

  // Render fragments
  const fragmentMeshes = useMemo(() => {
    return fragmentsRef.current.map((fragment, i) => (
      <FragmentMesh
        key={`${anomaly.id}_frag_${i}`}
        fragment={fragment}
        anomalyType={anomaly.typeId}
      />
    ))
  }, [fragmentsRef.current, anomaly.typeId, anomaly.id])

  return <group>{fragmentMeshes}</group>
}

/**
 * Determine fragment count based on anomaly type
 */
function getFragmentCount(typeId) {
  const counts = {
    stampeder: 8,
    siegeDrone: 12,
    sludgeBlob: 6, // splits instead
    phantomConsumer: 10,
    nullPointer: 30,
  }
  return counts[typeId] || 6
}

/**
 * Create physics fragments for ragdoll
 */
function createFragments(rapier, anomaly, position, velocity, impulse, count) {
  const fragments = []
  const type = anomaly.typeId
  const visuals = getAnomalyVisuals(type)

  for (let i = 0; i < count; i++) {
    // Random fragment properties
    const size = 0.15 + Math.random() * 0.25
    const mass = 0.5 + Math.random() * 1.5

    // Position offset from center
    const offset = [
      (Math.random() - 0.5) * 1.5,
      Math.random() * 1.0,
      (Math.random() - 0.5) * 1.5,
    ]

    const fragPos = [
      position[0] + offset[0],
      position[1] + offset[1] + 0.5,
      position[2] + offset[2],
    ]

    // Create rigid body
    const bodyDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(fragPos[0], fragPos[1], fragPos[2])
      .setCcdEnabled(true)
      .setMass(mass)
      .setLinearDamping(0.1)
      .setAngularDamping(0.5)

    const body = rapier.world.createRigidBody(bodyDesc)

    // Initial velocity - base + explosion + random
    const initVel = [
      velocity[0] + (Math.random() - 0.5) * 8 + (impulse?.[0] || 0),
      velocity[1] + Math.random() * 10 + 5 + (impulse?.[1] || 0),
      velocity[2] + (Math.random() - 0.5) * 8 + (impulse?.[2] || 0),
    ]
    body.setLinvel({ x: initVel[0], y: initVel[1], z: initVel[2] })

    // Random angular velocity
    body.setAngvel({
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 10,
    })

    // Create collider - random shape
    const shapeType = Math.random()
    let colliderDesc

    if (shapeType < 0.4) {
      // Box
      colliderDesc = rapier.ColliderDesc.cuboid(size * 0.5, size * 0.5, size * 0.5)
    } else if (shapeType < 0.7) {
      // Cylinder
      colliderDesc = rapier.ColliderDesc.cylinder(size * 0.5, size * 0.3)
    } else if (shapeType < 0.9) {
      // Capsule
      colliderDesc = rapier.ColliderDesc.capsule(size * 0.5, size * 0.25)
    } else {
      // Convex hull (irregular)
      const points = generateConvexPoints(size)
      colliderDesc = rapier.ColliderDesc.convexHull(points)
    }

    colliderDesc
      .setFriction(0.6)
      .setRestitution(0.3)
      .setCollisionGroups(0b1000) // DEBRIS group
      .setSolverGroups(0b0111)   // Collides with WORLD, PLAYER, ENEMY

    const collider = rapier.world.createCollider(colliderDesc, body)

    fragments.push({
      body,
      collider,
      size,
      color: visuals.baseColor,
      emissive: visuals.emissiveColor,
      alpha: 1.0,
      lifetime: 0,
      rotation: new THREE.Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      ),
      rotationSpeed: new THREE.Euler(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      ),
    })
  }

  return fragments
}

/**
 * Clean up oldest fragments when over limit
 */
function cleanupOldestFragments(rapier, count) {
  // This would need a global fragment registry
  // For now, fragments self-cleanup via lifetime
}

/**
 * Generate random convex hull points
 */
function generateConvexPoints(size) {
  const points = []
  const count = 8 + Math.floor(Math.random() * 8)

  for (let i = 0; i < count; i++) {
    const phi = Math.acos(2 * Math.random() - 1)
    const theta = Math.random() * Math.PI * 2
    const r = size * (0.5 + Math.random() * 0.5)

    points.push({
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
    })
  }

  return points
}

/**
 * Get visual properties for anomaly type
 */
function getAnomalyVisuals(typeId) {
  const visuals = {
    stampeder: { baseColor: 0xff6600, emissiveColor: 0xff3300 },
    siegeDrone: { baseColor: 0x444466, emissiveColor: 0x0088ff },
    sludgeBlob: { baseColor: 0x221133, emissiveColor: 0x8800ff },
    phantomConsumer: { baseColor: 0x111122, emissiveColor: 0xff0088 },
    nullPointer: { baseColor: 0x000000, emissiveColor: 0xff0044 },
  }
  return visuals[typeId] || { baseColor: 0xff0000, emissiveColor: 0xffffff }
}

/**
 * Individual fragment mesh component
 */
function FragmentMesh({ fragment, anomalyType }) {
  const meshRef = useRef(null)

  useFrame((_, dt) => {
    if (!fragment.body || !meshRef.current) return

    // Sync position from physics
    const pos = fragment.body.translation()
    const rot = fragment.body.rotation()

    meshRef.current.position.set(pos.x, pos.y, pos.z)
    meshRef.current.quaternion.set(rot.x, rot.y, rot.z, rot.w)

    // Update visual rotation for non-physics rotation
    fragment.rotation.x += fragment.rotationSpeed.x * dt
    fragment.rotation.y += fragment.rotationSpeed.y * dt
    fragment.rotation.z += fragment.rotationSpeed.z * dt
  })

  // Create geometry based on collider shape approximation
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(fragment.size, fragment.size, fragment.size)
    // Randomize vertices slightly for organic look
    const positions = geo.attributes.position
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i,
        positions.getX(i) + (Math.random() - 0.5) * fragment.size * 0.2,
        positions.getY(i) + (Math.random() - 0.5) * fragment.size * 0.2,
        positions.getZ(i) + (Math.random() - 0.5) * fragment.size * 0.2
      )
    }
    positions.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [fragment.size])

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: fragment.color,
      emissive: fragment.emissive,
      emissiveIntensity: 0.5,
      metalness: 0.4,
      roughness: 0.6,
      transparent: true,
      opacity: fragment.alpha,
      depthWrite: fragment.alpha >= 1.0,
    })
  }, [fragment.color, fragment.emissive, fragment.alpha])

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
    />
  )
}

/**
 * Gibs - larger structural pieces for boss deaths
 */
export function Gibs({ anomaly, position, onComplete }) {
  const rapier = useRapier()
  const gibsRef = useRef([])
  const timerRef = useRef(0)

  useEffect(() => {
    if (!rapier.world) return

    const gibCount = anomaly.typeId === 'nullPointer' ? 15 : 8
    const gibs = []

    for (let i = 0; i < gibCount; i++) {
      const size = 0.5 + Math.random() * 1.0
      const mass = 5 + Math.random() * 15

      const gibPos = [
        position[0] + (Math.random() - 0.5) * 3,
        position[1] + Math.random() * 2 + 1,
        position[2] + (Math.random() - 0.5) * 3,
      ]

      const bodyDesc = rapier.RigidBodyDesc.dynamic()
        .setTranslation(gibPos[0], gibPos[1], gibPos[2])
        .setMass(mass)
        .setCcdEnabled(true)

      const body = rapier.world.createRigidBody(bodyDesc)

      // Explosive impulse
      const impulse = [
        (Math.random() - 0.5) * 30,
        Math.random() * 20 + 10,
        (Math.random() - 0.5) * 30,
      ]
      body.setLinvel({ x: impulse[0], y: impulse[1], z: impulse[2] })
      body.setAngvel({
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 20,
        z: (Math.random() - 0.5) * 20,
      })

      const colliderDesc = rapier.ColliderDesc.cuboid(size * 0.5, size * 0.3, size * 0.5)
        .setFriction(0.5)
        .setRestitution(0.2)
        .setCollisionGroups(0b1000)
        .setSolverGroups(0b0111)

      const collider = rapier.world.createCollider(colliderDesc, body)

      gibs.push({
        body,
        collider,
        size,
        geometry: new THREE.BoxGeometry(size, size * 0.6, size),
        lifetime: 0,
      })
    }

    gibsRef.current = gibs

    return () => {
      gibs.forEach(g => {
        if (g.body && rapier.world) rapier.world.removeRigidBody(g.body)
        if (g.collider && rapier.world) rapier.world.removeCollider(g.collider)
      })
    }
  }, [rapier, anomaly, position])

  useFrame((_, dt) => {
    if (!rapier.world) return

    timerRef.current += dt
    let allDead = true

    gibsRef.current.forEach((gib, i) => {
      gib.lifetime += dt
      if (gib.lifetime < 15) allDead = false

      if (gib.body) {
        const pos = gib.body.translation()
        const rot = gib.body.rotation()
        gib.meshPosition = pos
        gib.meshRotation = rot
      }

      // Cleanup
      if (gib.lifetime >= 15) {
        if (gib.body && rapier.world) rapier.world.removeRigidBody(gib.body)
        if (gib.collider && rapier.world) rapier.world.removeCollider(gib.collider)
        gibsRef.current.splice(i, 1)
      }
    })

    if (allDead && gibsRef.current.length === 0 && onComplete) {
      onComplete()
    }
  })

  return (
    <group>
      {gibsRef.current.map((gib, i) => (
        gib.meshPosition && (
          <GibMesh
            key={`${anomaly.id}_gib_${i}`}
            position={gib.meshPosition}
            rotation={gib.meshRotation}
            size={gib.size}
            anomalyType={anomaly.typeId}
            alpha={Math.max(0, 1 - gib.lifetime / 15)}
          />
        )
      ))}
    </group>
  )
}

function GibMesh({ position, rotation, size, anomalyType, alpha }) {
  const visuals = getAnomalyVisuals(anomalyType)

  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[size, size * 0.6, size]} />
      <meshStandardMaterial
        color={visuals.baseColor}
        emissive={visuals.emissive}
        emissiveIntensity={0.3 * alpha}
        metalness={0.5}
        roughness={0.5}
        transparent
        opacity={alpha}
        depthWrite={alpha >= 1.0}
      />
    </mesh>
  )
}

/**
 * Explosion debris burst for immediate visual feedback
 */
export function ExplosionDebris({ position, intensity = 1, count = 20, color = 0xff6600 }) {
  const rapier = useRapier()
  const particlesRef = useRef([])

  useEffect(() => {
    if (!rapier.world) return

    const particles = []

    for (let i = 0; i < count; i++) {
      const size = 0.05 + Math.random() * 0.1
      const mass = 0.1

      const bodyDesc = rapier.RigidBodyDesc.dynamic()
        .setTranslation(position[0], position[1] + 0.5, position[2])
        .setMass(mass)
        .setCcdEnabled(true)

      const body = rapier.world.createRigidBody(bodyDesc)

      // Radial burst
      const angle = Math.random() * Math.PI * 2
      const elevation = Math.random() * Math.PI * 0.5
      const speed = 10 + Math.random() * 20 * intensity

      body.setLinvel({
        x: Math.cos(angle) * Math.cos(elevation) * speed,
        y: Math.sin(elevation) * speed,
        z: Math.sin(angle) * Math.cos(elevation) * speed,
      })

      const colliderDesc = rapier.ColliderDesc.ball(size)
        .setFriction(0.3)
        .setRestitution(0.5)
        .setCollisionGroups(0b1000)
        .setSolverGroups(0b0111)

      const collider = rapier.world.createCollider(colliderDesc, body)

      particles.push({
        body,
        collider,
        size,
        color,
        lifetime: 0,
      })
    }

    particlesRef.current = particles

    return () => {
      particles.forEach(p => {
        if (p.body && rapier.world) rapier.world.removeRigidBody(p.body)
        if (p.collider && rapier.world) rapier.world.removeCollider(p.collider)
      })
    }
  }, [rapier, position, count, intensity])

  useFrame((_, dt) => {
    if (!rapier.world) return

    particlesRef.current.forEach((p, i) => {
      p.lifetime += dt

      if (p.body) {
        const vel = p.body.linvel()
        p.body.setLinvel({
          x: vel.x * 0.98,
          y: vel.y - 9.81 * dt,
          z: vel.z * 0.98,
        })
      }

      if (p.lifetime > 3.0) {
        if (p.body && rapier.world) rapier.world.removeRigidBody(p.body)
        if (p.collider && rapier.world) rapier.world.removeCollider(p.collider)
        particlesRef.current.splice(i, 1)
      }
    })
  })

  return (
    <group>
      {particlesRef.current.map((p, i) => {
        if (!p.body) return null
        const pos = p.body.translation()
        const alpha = Math.max(0, 1 - p.lifetime / 3.0)
        return (
          <mesh
            key={`${position}_${i}`}
            position={pos}
            scale={p.size}
          >
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial
              color={p.color}
              transparent
              opacity={alpha}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export default Ragdoll