import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Renders the level directly from the SAME collider list the sim collides
// against. This is deliberate: a separate art mesh and physics mesh is how
// you get a wall you can see but walk through. One source, no drift.
//
// Nothing here is loaded from disk — the facility is built from boxes at
// runtime. That keeps the 3D chunk free of a .glb dependency, so the mode is
// playable from a clean checkout with no asset pipeline.

const WALL_IDS = new Set([
  'wall_north', 'wall_south', 'wall_east', 'wall_west',
  'partition_n_west', 'partition_n_east', 'partition_s_west', 'partition_s_east',
  'backroom_divider',
])

function boxProps(c) {
  const [hx, hy, hz] = c.args
  return { position: c.position, args: [hx * 2, hy * 2, hz * 2] }
}

// A single flickering point light. Flicker is driven by a cheap sine/noise
// blend rather than Math.random per frame so it reads as a failing ballast
// rather than TV static.
function FacilityLight({ light }) {
  const ref = useRef(null)
  const seed = useMemo(() => light.position[0] * 0.37 + light.position[2] * 0.11, [light])

  useFrame((state) => {
    if (!ref.current || !light.flicker) return
    const t = state.clock.elapsedTime
    const n = Math.sin(t * 11 + seed) * Math.sin(t * 3.7 + seed * 2.1)
    const dip = n > 0.72 ? 0.25 : 1
    ref.current.intensity = light.intensity * dip * (1 - light.flicker * 0.35 * (0.5 + 0.5 * n))
  })

  return (
    <pointLight
      ref={ref}
      position={light.position}
      color={light.color}
      intensity={light.intensity}
      distance={light.distance}
      decay={2}
    />
  )
}

export default function LevelGeometry({ level }) {
  const racks = level.racks || []

  const shell = useMemo(
    () => level.colliders.filter((c) => !String(c.id || '').startsWith('rack_')),
    [level],
  )

  // One instanced draw for every rack instead of ~24 separate meshes.
  const rackRef = useRef(null)
  const rackGeom = useMemo(() => {
    const [hx, hy, hz] = racks.length ? racks[0].args : [1, 1, 1]
    return new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2)
  }, [racks])

  React.useLayoutEffect(() => {
    // Guarded rather than assumed: under a mocked <Canvas> (the integration
    // gate) this ref is a DOM node, not a THREE.InstancedMesh.
    if (!rackRef.current || typeof rackRef.current.setMatrixAt !== 'function') return
    const dummy = new THREE.Object3D()
    racks.forEach((r, i) => {
      dummy.position.set(r.position[0], r.position[1], r.position[2])
      dummy.updateMatrix()
      rackRef.current.setMatrixAt(i, dummy.matrix)
    })
    rackRef.current.instanceMatrix.needsUpdate = true
  }, [racks])

  return (
    <group name="level-geometry">
      {shell.map((c) => {
        const isFloor = c.id === 'floor'
        const isCeiling = c.id === 'ceiling'
        const isWall = WALL_IDS.has(c.id)
        const { position, args } = boxProps(c)
        return (
          <mesh key={c.id} position={position} receiveShadow>
            <boxGeometry args={args} />
            <meshStandardMaterial
              color={isFloor ? '#2b333d' : isCeiling ? '#0a0d12' : '#39434f'}
              roughness={isFloor ? 0.85 : 0.95}
              metalness={isWall ? 0.25 : 0.05}
            />
          </mesh>
        )
      })}

      {racks.length > 0 && (
        <instancedMesh
          ref={rackRef}
          args={[rackGeom, undefined, racks.length]}
          castShadow
          frustumCulled={false}
        >
          <meshStandardMaterial
            color="#2a3540"
            roughness={0.6}
            metalness={0.45}
            emissive="#0e3a4a"
            emissiveIntensity={0.9}
          />
        </instancedMesh>
      )}

      {(level.lights || []).map((l) => (
        <FacilityLight key={l.id} light={l} />
      ))}
    </group>
  )
}
