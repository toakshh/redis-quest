import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSim } from '../SimProvider.jsx'
import { FLAGS } from '../../sim/entity/EntityStore.js'
import { ARCHETYPE, BODY_RADIUS, BODY_HEIGHT } from '../../sim/entity/archetypes.js'

// Draws every hostile as one instanced mesh per archetype — two draw calls
// for the whole bestiary, regardless of count.
//
// The view reads positions straight out of the entity store's typed arrays
// each frame and never writes to them. All hostile behaviour lives in the
// sim; this file is a camera pointed at it.

const HIDDEN_Y = -9999

function useInstancedArchetype(archetype, count) {
  const ref = useRef(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const { world } = useSim()

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh || !world || typeof mesh.setMatrixAt !== 'function') return
    const e = world.entities
    const { alive, flags, archetype: arch, posX, posY, posZ, health } = e
    const t = state.clock.elapsedTime
    let n = 0

    for (let id = 0; id < e.capacity && n < count; id++) {
      if (alive[id] === 0) continue
      if ((flags[id] & FLAGS.HOSTILE) === 0) continue
      if (arch[id] !== archetype) continue

      // A dead crawler stays in the store for a beat; sink it rather than
      // popping it out, so the kill reads as a collapse.
      const dying = health[id] <= 0
      const h = BODY_HEIGHT[archetype]
      dummy.position.set(posX[id], posY[id] + h * 0.5 - (dying ? h * 0.4 : 0), posZ[id])
      // Idle sway keyed off entity id so bodies do not move in lockstep.
      dummy.rotation.y = Math.sin(t * 1.7 + id) * 0.15
      dummy.scale.set(1, dying ? 0.25 : 1, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(n, dummy.matrix)
      n++
    }

    // Park unused instances far below the floor instead of resizing the
    // buffer — resizing would reallocate every frame.
    dummy.position.set(0, HIDDEN_Y, 0)
    dummy.scale.set(0.001, 0.001, 0.001)
    dummy.rotation.y = 0
    dummy.updateMatrix()
    for (; n < count; n++) mesh.setMatrixAt(n, dummy.matrix)

    mesh.instanceMatrix.needsUpdate = true
  })

  return ref
}

function Crawlers({ count = 32 }) {
  const ref = useInstancedArchetype(ARCHETYPE.CRAWLER, count)
  const r = BODY_RADIUS[ARCHETYPE.CRAWLER]
  const h = BODY_HEIGHT[ARCHETYPE.CRAWLER]
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} castShadow>
      <capsuleGeometry args={[r, Math.max(0.1, h - r * 2), 4, 10]} />
      <meshStandardMaterial
        color="#2a0d0d"
        emissive="#ff2d1a"
        emissiveIntensity={1.4}
        roughness={0.4}
        metalness={0.1}
      />
    </instancedMesh>
  )
}

function Stalkers({ count = 4 }) {
  const ref = useInstancedArchetype(ARCHETYPE.STALKER, count)
  const r = BODY_RADIUS[ARCHETYPE.STALKER]
  const h = BODY_HEIGHT[ARCHETYPE.STALKER]
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} castShadow>
      <capsuleGeometry args={[r, Math.max(0.1, h - r * 2), 4, 12]} />
      {/* THE EVICTOR reads as absence, not aggression — near-black with a
          cold rim so it is visible only as a silhouette against the racks. */}
      <meshStandardMaterial
        color="#05060a"
        emissive="#4fd8ff"
        emissiveIntensity={0.35}
        roughness={0.2}
        metalness={0.8}
      />
    </instancedMesh>
  )
}

export default function Hostiles() {
  return (
    <group name="hostiles">
      <Crawlers />
      <Stalkers />
    </group>
  )
}
