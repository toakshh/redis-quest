/**
 * LevelGeometry - Modular sci-fi server room geometry for LOOP // NULL_POINTER
 * Procedural floor grids, server racks, glowing cables, terminal pillars, doors, light shafts
 * Uses InstancedMesh for performance, reacts to mission/environment state
 */

import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { use3DGameStore } from '../../stores/use3DGameStore'
import { getMissionData } from './MissionsData'

// --- Geometry & Material Cache ---
const geometryCache = new Map()
const materialCache = new Map()

function getGeometry(key, factory) {
  if (!geometryCache.has(key)) {
    geometryCache.set(key, factory())
  }
  return geometryCache.get(key)
}

function getMaterial(key, factory) {
  if (!materialCache.has(key)) {
    materialCache.set(key, factory())
  }
  return materialCache.get(key)
}

// --- Reusable Materials ---
const materials = {
  floor: () => getMaterial('floor', () => new THREE.MeshStandardMaterial({
    color: 0x0a0a12,
    metalness: 0.8,
    roughness: 0.3,
    emissive: 0x001122,
    emissiveIntensity: 0.1,
  })),

  floorGrid: () => getMaterial('floorGrid', () => new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
  })),

  rackBody: () => getMaterial('rackBody', () => new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0x000818,
    emissiveIntensity: 0.2,
  })),

  rackAccent: () => getMaterial('rackAccent', () => new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    metalness: 0.5,
    roughness: 0.3,
    emissive: 0x003366,
    emissiveIntensity: 0.4,
  })),

  cableGlow: (color = 0x00ffff) => getMaterial(`cableGlow_${color}`, () => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })),

  cableCore: (color = 0x00ffff) => getMaterial(`cableCore_${color}`, () => new THREE.MeshStandardMaterial({
    color: 0x000033,
    metalness: 0.3,
    roughness: 0.7,
    emissive: color,
    emissiveIntensity: 1.5,
  })),

  terminalScreen: () => getMaterial('terminalScreen', () => new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })),

  terminalBody: () => getMaterial('terminalBody', () => new THREE.MeshStandardMaterial({
    color: 0x0d0d1a,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x001100,
    emissiveIntensity: 0.3,
  })),

  doorFrame: () => getMaterial('doorFrame', () => new THREE.MeshStandardMaterial({
    color: 0x2a2a4a,
    metalness: 0.7,
    roughness: 0.3,
  })),

  doorPanel: (locked) => getMaterial(`doorPanel_${locked}`, () => new THREE.MeshStandardMaterial({
    color: locked ? 0xff3344 : 0x00ff88,
    metalness: 0.5,
    roughness: 0.4,
    emissive: locked ? 0x330000 : 0x003300,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: locked ? 0.9 : 0.7,
  })),

  lightShaft: () => getMaterial('lightShaft', () => new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })),

  corruption: () => getMaterial('corruption', () => new THREE.MeshBasicMaterial({
    color: 0x8800ff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })),
}

// --- Geometries ---
const geoms = {
  floorTile: () => getGeometry('floorTile', () => new THREE.PlaneGeometry(4, 4)),
  floorGrid: () => getGeometry('floorGrid', () => new THREE.PlaneGeometry(4, 4, 1, 1)),
  rackMain: () => getGeometry('rackMain', () => new THREE.BoxGeometry(2, 4, 1.2)),
  rackBlade: () => getGeometry('rackBlade', () => new THREE.BoxGeometry(1.8, 0.8, 1.0)),
  rackLight: () => getGeometry('rackLight', () => new THREE.BoxGeometry(1.6, 0.05, 0.05)),
  cableTube: () => getGeometry('cableTube', () => new THREE.CylinderGeometry(0.08, 0.08, 1, 8, 1, true)),
  terminalPillar: () => getGeometry('terminalPillar', () => new THREE.CylinderGeometry(0.4, 0.5, 2.5, 8)),
  terminalScreen: () => getGeometry('terminalScreen', () => new THREE.PlaneGeometry(1.2, 0.8)),
  doorFrame: () => getGeometry('doorFrame', () => new THREE.BoxGeometry(3, 3.5, 0.3)),
  doorPanel: () => getGeometry('doorPanel', () => new THREE.PlaneGeometry(2.6, 3.1)),
  lightShaftCone: () => getGeometry('lightShaftCone', () => new THREE.ConeGeometry(3, 8, 8, 1, true)),
  corruptionPool: () => getGeometry('corruptionPool', () => new THREE.CircleGeometry(5, 32)),
}

// --- Instanced Mesh Components ---

/** Floor grid with animated scanline */
export function FloorGrid({ roomCount = 25, tileSize = 4 }) {
  const { environment, phase } = use3DGameStore.getState()
  const meshRef = useRef(null)
  const timeRef = useRef(0)
  const scanlineRef = useRef(0)

  useFrame((state, dt) => {
    if (phase !== 'playing') return
    timeRef.current += dt
    scanlineRef.current = (scanlineRef.current + dt * 0.5) % 1

    if (meshRef.current && meshRef.current.material) {
      meshRef.current.material.opacity = 0.1 + Math.sin(timeRef.current * 2) * 0.05
      // Animate grid lines via UV offset in shader would be better, but this works
    }
  })

  const count = roomCount * roomCount
  const dummy = useRef(new THREE.Object3D()).current

  return (
    <instancedMesh
      ref={meshRef}
      count={count}
      geometry={geoms.floorGrid()}
      material={materials.floorGrid()}
      instanceMatrix={new THREE.InstancedBufferAttribute(new Float32Array(count * 16), 16)}
      instanceColor={new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)}
      frustumCulled={false}
    >
      <group dispose={null} />
    </instancedMesh>
  )
}

/** Server rack row with blinking lights */
export function ServerRackRow({
  position = [0, 0, 0],
  count = 8,
  spacing = 2.5,
  corruption = 0,
  active = true,
}) {
  const { environment } = use3DGameStore.getState()
  const rackRefs = useRef([])
  const timeRef = useRef(0)
  const baseCorruption = corruption || (environment.globalCorruption / 100)

  useFrame((state, dt) => {
    timeRef.current += dt
    rackRefs.current.forEach((rack, i) => {
      if (!rack) return
      // Animate rack lights
      const lightMeshes = rack.userData.lightMeshes
      if (lightMeshes) {
        lightMeshes.forEach((lm, li) => {
          const flicker = Math.sin(timeRef.current * 8 + i * 2 + li) * 0.3 + 0.7
          const corrFlicker = baseCorruption > 0.3 ? (Math.random() * 0.5) : 0
          lm.material.emissiveIntensity = (0.4 + flicker + corrFlicker) * (active ? 1 : 0.3)
        })
      }
    })
  })

  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => (
        <ServerRack
          key={i}
          ref={(el) => { rackRefs.current[i] = el }}
          position={[i * spacing, 0, 0]}
          index={i}
          corruption={baseCorruption}
          active={active}
        />
      ))}
    </group>
  )
}

function ServerRack({ position, index, corruption, active }) {
  const groupRef = useRef(null)
  const lightMeshesRef = useRef([])

  useEffect(() => {
    if (!groupRef.current) return
    // Collect light meshes for animation
    const lights = []
    groupRef.current.traverse((child) => {
      if (child.isMesh && child.material?.emissive) {
        lights.push(child)
      }
    })
    lightMeshesRef.current = lights
    groupRef.current.userData.lightMeshes = lights
  }, [])

  const rackColor = corruption > 0.5 ? 0x440066 : 0x1a1a2e
  const accentColor = corruption > 0.5 ? 0xaa00ff : 0x00ffff

  return (
    <group ref={groupRef} position={position}>
      {/* Main rack body */}
      <mesh geometry={geoms.rackMain()} material={materials.rackBody()} castShadow receiveShadow />
      {/* Blades */}
      {Array.from({ length: 4 }).map((_, b) => (
        <mesh
          key={b}
          position={[0, -1.2 + b * 0.9, 0.65]}
          geometry={geoms.rackBlade()}
          material={materials.rackBody()}
          castShadow
          receiveShadow
        />
      ))}
      {/* Status lights */}
      {Array.from({ length: 12 }).map((_, l) => (
        <mesh
          key={l}
          position={[0, -1.7 + l * 0.28, 0.7]}
          geometry={geoms.rackLight()}
          material={
            l % 3 === 0
              ? new THREE.MeshBasicMaterial({
                  color: accentColor,
                  emissive: accentColor,
                  emissiveIntensity: 0.8,
                  transparent: true,
                  opacity: 0.9,
                })
              : new THREE.MeshBasicMaterial({
                  color: 0x00ff88,
                  emissive: 0x00ff88,
                  emissiveIntensity: 0.6,
                  transparent: true,
                  opacity: 0.7,
                })
          }
        />
      ))}
      {/* Corruption veins */}
      {corruption > 0.3 && (
        <mesh
          geometry={geoms.rackMain()}
          material={materials.corruption()}
          scale={[1.01, 1.01, 1.01]}
        />
      )}
    </group>
  )
}

/** Glowing cable runs along ceiling/floor */
export function CableRun({
  start = [0, 0, 0],
  end = [10, 0, 0],
  color = 0x00ffff,
  segments = 10,
  sag = 0.3,
  animated = true,
}) {
  const pointsRef = useRef(null)
  const lineRef = useRef(null)
  const timeRef = useRef(0)

  useEffect(() => {
    // Generate curved cable path
    const points = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const x = THREE.MathUtils.lerp(start[0], end[0], t)
      const y = THREE.MathUtils.lerp(start[1], end[1], t) + Math.sin(t * Math.PI) * sag
      const z = THREE.MathUtils.lerp(start[2], end[2], t)
      points.push(new THREE.Vector3(x, y, z))
    }
    pointsRef.current = points

    const curve = new THREE.CatmullRomCurve3(points)
    const geometry = new THREE.TubeGeometry(curve, segments * 4, 0.06, 8, false)
    if (lineRef.current) {
      lineRef.current.geometry.dispose()
      lineRef.current.geometry = geometry
    }
  }, [start, end, segments, sag])

  useFrame((state, dt) => {
    if (!animated) return
    timeRef.current += dt
    if (lineRef.current && lineRef.current.material) {
      lineRef.current.material.emissiveIntensity = 1.5 + Math.sin(timeRef.current * 3) * 0.3
      lineRef.current.material.opacity = 0.6 + Math.sin(timeRef.current * 2) * 0.1
    }
  })

  return (
    <mesh
      ref={lineRef}
      geometry={geoms.cableTube()}
      material={materials.cableCore(color)}
    />
  )
}

/** Terminal pillar with holographic display */
export function TerminalPillar({
  position = [0, 0, 0],
  rotation = 0,
  active = true,
  corruption = 0,
  displayText = 'READY',
}) {
  const { environment } = use3DGameStore.getState()
  const timeRef = useRef(0)
  const screenRef = useRef(null)
  const baseCorruption = corruption || (environment.globalCorruption / 100)

  useFrame((state, dt) => {
    timeRef.current += dt
    if (screenRef.current && screenRef.current.material) {
      const flicker = baseCorruption > 0.4 ? (Math.random() * 0.3) : 0
      screenRef.current.material.opacity = active ? (0.9 + flicker) : 0.2
      screenRef.current.material.emissiveIntensity = active ? (1.0 + flicker) : 0.1
      // Rotate screen to face player (billboard)
      const playerPos = state.camera.position
      const dir = new THREE.Vector3().subVectors(
        new THREE.Vector3(...position),
        playerPos
      ).normalize()
      screenRef.current.rotation.y = Math.atan2(dir.x, dir.z)
    }
  })

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Pillar body */}
      <mesh
        geometry={geoms.terminalPillar()}
        material={materials.terminalBody()}
        castShadow
        receiveShadow
      />
      {/* Holographic screen */}
      <mesh
        ref={screenRef}
        position={[0, 1.5, 0.6]}
        geometry={geoms.terminalScreen()}
        material={materials.terminalScreen()}
      />
      {/* Keyboard/shelf */}
      <mesh
        position={[0, 0.8, 0.5]}
        geometry={new THREE.BoxGeometry(1.0, 0.1, 0.4)}
        material={materials.rackBody()}
        castShadow
      />
      {/* Base glow ring */}
      <mesh
        position={[0, 0.05, 0]}
        geometry={new THREE.RingGeometry(0.6, 0.8, 32)}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.cableGlow(active ? 0x00ff88 : 0x666666)}
      />
      {/* Corruption effect */}
      {baseCorruption > 0.3 && (
        <group>
          <mesh
            geometry={geoms.terminalPillar()}
            material={materials.corruption()}
            scale={[1.05, 1.05, 1.05]}
          />
          {Array.from({ length: 3 }).map((_, i) => (
            <mesh
              key={i}
              position={[0, 1.2 + Math.sin(timeRef.current + i) * 0.3, 0]}
              geometry={new THREE.SphereGeometry(0.08, 8, 8)}
              material={materials.cableGlow(0xaa00ff)}
            />
          ))}
        </group>
      )}
    </group>
  )
}

/** Blast door with lock state */
export function BlastDoor({
  position = [0, 0, 0],
  rotation = 0,
  locked = true,
  doorId = 'main',
}) {
  const { environment } = use3DGameStore.getState()
  const isLocked = locked && environment.doors[doorId]?.locked !== false
  const panelRef = useRef(null)
  const timeRef = useRef(0)

  useFrame((state, dt) => {
    timeRef.current += dt
    if (panelRef.current && panelRef.current.material) {
      panelRef.current.material.emissiveIntensity = isLocked
        ? 0.5 + Math.sin(timeRef.current * 3) * 0.2
        : 0.8
      panelRef.current.material.opacity = isLocked ? 0.9 : 0.3
    }
  })

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Door frame */}
      <mesh
        geometry={geoms.doorFrame()}
        material={materials.doorFrame()}
        castShadow
        receiveShadow
      />
      {/* Door panel */}
      <mesh
        ref={panelRef}
        position={[0, 0, 0.16]}
        geometry={geoms.doorPanel()}
        material={materials.doorPanel(isLocked)}
      />
      {/* Lock indicator */}
      <mesh
        position={[0, 1.2, 0.2]}
        geometry={new THREE.OctahedronGeometry(0.15, 0)}
        material={new THREE.MeshBasicMaterial({
          color: isLocked ? 0xff3344 : 0x00ff88,
          emissive: isLocked ? 0xff3344 : 0x00ff88,
          emissiveIntensity: 1.0,
        })}
      />
      {/* Frame lights */}
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            i < 2 ? -1.2 : 1.2,
            i % 2 === 0 ? 1.0 : -1.0,
            0.16,
          ]}
          geometry={new THREE.BoxGeometry(0.1, 0.1, 0.1)}
          material={new THREE.MeshBasicMaterial({
            color: isLocked ? 0xff3344 : 0x00ff88,
            emissive: isLocked ? 0xff3344 : 0x00ff88,
            emissiveIntensity: 1.0,
          })}
        />
      ))}
    </group>
  )
}

/** Volumetric light shaft from ceiling */
export function LightShaft({
  position = [0, 0, 0],
  rotation = 0,
  color = 0xffffff,
  intensity = 1.0,
  flicker = false,
  animated = true,
}) {
  const coneRef = useRef(null)
  const timeRef = useRef(0)

  useFrame((state, dt) => {
    if (!animated) return
    timeRef.current += dt
    if (coneRef.current) {
      coneRef.current.rotation.y = timeRef.current * 0.05
      if (flicker) {
        coneRef.current.material.opacity = 0.08 + Math.sin(timeRef.current * 4) * 0.03
        coneRef.current.scale.y = 1 + Math.sin(timeRef.current * 2) * 0.05
      }
    }
  })

  return (
    <mesh
      ref={coneRef}
      position={position}
      rotation={[0, rotation, 0]}
      geometry={geoms.lightShaftCone()}
      material={materials.lightShaft()}
      scale={[1, intensity, 1]}
    />
  )
}

/** Corruption zone visual */
export function CorruptionZone({
  position = [0, 0, 0],
  radius = 5,
  intensity = 1.0,
}) {
  const { environment } = use3DGameStore.getState()
  const poolRef = useRef(null)
  const particleRefs = useRef([])
  const timeRef = useRef(0)

  useEffect(() => {
    // Create particle meshes
    if (!poolRef.current) return
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2
      const r = radius * (0.3 + Math.random() * 0.7)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 8, 8),
        materials.cableGlow(0xaa00ff)
      )
      mesh.position.set(
        Math.cos(angle) * r,
        0.1 + Math.random() * 0.5,
        Math.sin(angle) * r
      )
      mesh.userData = { angle, radius: r, speed: 0.2 + Math.random() * 0.3 }
      particleRefs.current.push(mesh)
      poolRef.current.add(mesh)
    }
  }, [])

  useFrame((state, dt) => {
    timeRef.current += dt
    particleRefs.current.forEach((p) => {
      if (!p) return
      p.userData.angle += dt * p.userData.speed
      p.position.x = Math.cos(p.userData.angle) * p.userData.radius
      p.position.z = Math.sin(p.userData.angle) * p.userData.radius
      p.position.y = 0.1 + Math.sin(timeRef.current * 2 + p.userData.angle) * 0.3
      p.material.opacity = 0.3 + Math.sin(timeRef.current * 3 + p.userData.angle) * 0.2
      p.scale.setScalar(0.5 + Math.sin(timeRef.current * 1.5 + p.userData.angle) * 0.3)
    })
    if (poolRef.current) {
      poolRef.current.material.opacity = 0.2 * intensity * (environment.globalCorruption / 100)
    }
  })

  return (
    <group position={position}>
      <mesh
        ref={poolRef}
        position={[0, 0.01, 0]}
        geometry={geoms.corruptionPool()}
        material={materials.corruption()}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    </group>
  )
}

/** Complete level composition for a mission */
export function LevelGeometry({ missionId }) {
  const { environment, phase } = use3DGameStore.getState()
  const missionData = getMissionData(missionId)
  const rooms = missionData?.environment?.rooms || {}
  const doors = missionData?.environment?.doors || {}

  // Determine active corruption zones
  const corruptionZones = environment.corruptionZones || []

  return (
    <group>
      {/* Floor tiles */}
      <FloorTiles rooms={rooms} />

      {/* Server rack rows per room */}
      {Object.entries(rooms).map(([roomId, room]) => (
        <group key={roomId} position={room.center}>
          <ServerRackRow
            count={Math.max(2, Math.floor(room.size[0] / 3))}
            spacing={2.5}
            corruption={room.corruption / 100}
            active={room.corruption < 80}
          />
          <TerminalPillar
            position={[0, 0, -room.size[2] / 2 + 2]}
            active={room.corruption < 90}
            corruption={room.corruption / 100}
            displayText={room.corruption > 50 ? 'CORRUPTED' : 'ONLINE'}
          />
          {/* Cable runs between racks */}
          <CableRun
            start={[-room.size[0] / 2 + 1, 3.5, -room.size[2] / 2 + 1]}
            end={[room.size[0] / 2 - 1, 3.5, -room.size[2] / 2 + 1]}
            color={room.corruption > 50 ? 0xaa00ff : 0x00ffff}
          />
          <CableRun
            start={[-room.size[0] / 2 + 1, 3.5, room.size[2] / 2 - 1]}
            end={[room.size[0] / 2 - 1, 3.5, room.size[2] / 2 - 1]}
            color={room.corruption > 50 ? 0xaa00ff : 0x00ffff}
          />
        </group>
      ))}

      {/* Doors */}
      {Object.entries(doors).map(([doorId, door]) => (
        <BlastDoor
          key={doorId}
          position={door.position || [0, 0, 0]}
          rotation={door.rotation || 0}
          locked={door.locked}
          doorId={doorId}
        />
      ))}

      {/* Light shafts from ceiling */}
      {Object.values(rooms).slice(0, 3).map((room, i) => (
        <LightShaft
          key={i}
          position={[room.center[0], 4.5, room.center[2]]}
          color={room.corruption > 50 ? 0xaa44ff : 0xffffff}
          intensity={room.corruption > 50 ? 0.5 : 1.0}
          flicker={room.corruption > 50}
        />
      ))}

      {/* Corruption zones */}
      {corruptionZones.map((zone, i) => (
        <CorruptionZone
          key={i}
          position={zone.position}
          radius={zone.radius}
          intensity={zone.intensity}
        />
      ))}

      {/* Global corruption fog planes */}
      {environment.globalCorruption > 30 && (
        <group>
          {Array.from({ length: 3 }).map((_, i) => (
            <mesh
              key={i}
              position={[0, 0.5 + i * 1.5, 0]}
              geometry={new THREE.PlaneGeometry(100, 100)}
              rotation={[-Math.PI / 2, 0, 0]}
              material={new THREE.MeshBasicMaterial({
                color: 0x440066,
                transparent: true,
                opacity: 0.03 * (environment.globalCorruption / 100),
                depthWrite: false,
              })}
            />
          ))}
        </group>
      )}
    </group>
  )
}

/** Floor tiles with instanced grid */
function FloorTiles({ rooms }) {
  const tileRef = useRef(null)
  const timeRef = useRef(0)
  const totalTiles = useMemo(() => {
    let count = 0
    Object.values(rooms).forEach(room => {
      count += Math.ceil(room.size[0] / 4) * Math.ceil(room.size[2] / 4)
    })
    return Math.max(count, 100)
  }, [rooms])

  useFrame((state, dt) => {
    timeRef.current += dt
    if (tileRef.current && tileRef.current.material) {
      tileRef.current.material.emissiveIntensity = 0.1 + Math.sin(timeRef.current * 0.5) * 0.02
    }
  })

  // Simplified: single large floor plane with grid texture
  return (
    <mesh
      ref={tileRef}
      position={[0, 0, 0]}
      geometry={new THREE.PlaneGeometry(200, 200, 50, 50)}
      material={materials.floor()}
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
    />
  )
}

// --- Cleanup on unmount ---
useEffect(() => {
  return () => {
    geometryCache.forEach(g => g.dispose())
    materialCache.forEach(m => m.dispose())
    geometryCache.clear()
    materialCache.clear()
  }
}, [])

export default LevelGeometry