import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSim } from '../SimProvider.jsx'

// Import FLAGS, though hardcoding HOSTILE=1 is also fine if we don't want to rely on the module execution in tests easily.
// FLAGS = { HOSTILE: 1 }
const HOSTILE_FLAG = 1

export default function EnemyInstances({ geometry, material, count = 400 }) {
  const { world } = useSim()
  const meshRef = useRef(null)

  // Use a dummy object to compute matrix transformations
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    if (!meshRef.current || !world) return

    const { alive, flags, posX, posY, posZ, yaw } = world.entities
    let instanceIdx = 0

    // Iterate the exact capacity to avoid GC, map live hostiles to instance matrices
    const capacity = world.entities.capacity
    for (let i = 0; i < capacity; i++) {
        // Must be alive AND have the hostile flag
        // In this implementation we assume all enemies use the same mesh for now.
        if (alive[i] && (flags[i] & HOSTILE_FLAG)) {
            dummy.position.set(posX[i], posY[i], posZ[i])
            dummy.rotation.y = yaw[i]
            dummy.updateMatrix()
            meshRef.current.setMatrixAt(instanceIdx, dummy.matrix)
            instanceIdx++
        }
    }

    // Hide any unused instances by pushing them far away or scaling to 0
    dummy.position.set(0, -9999, 0)
    dummy.scale.set(0, 0, 0)
    dummy.updateMatrix()
    while (instanceIdx < count) {
        meshRef.current.setMatrixAt(instanceIdx, dummy.matrix)
        instanceIdx++
    }

    // Inform three.js the buffer changed
    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.count = count // or instanceIdx to just not draw the rest
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false} // Since instances move, updating bounding box manually is better or don't cull
    />
  )
}
