import React, { useMemo } from 'react'
import { RigidBody } from '@react-three/rapier'
import Terminal3D from './Terminal3D.jsx'
import * as THREE from 'three'

// Simple procedural-style generation for the server datacenter level
export default function Level({ size = 50, onToggleTerminal }) {
  // Generate some random servers and blocks
  const servers = useMemo(() => {
    const arr = []
    for (let i = 0; i < 40; i++) {
      arr.push({
        position: [
          (Math.random() - 0.5) * size,
          1.5,
          (Math.random() - 0.5) * size
        ],
        scale: [1, 3 + Math.random() * 2, 1],
        color: Math.random() > 0.8 ? '#8a2be2' : '#050508',
        emissive: Math.random() > 0.5 ? '#00ff9d' : '#8a2be2',
        emissiveIntensity: Math.random() * 2
      })
    }
    return arr
  }, [size])

  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[size * 1.5, 1, size * 1.5]} />
          <meshStandardMaterial color="#020204" roughness={0.1} metalness={0.8} />
          {/* A glowing grid lines effect */}
          <gridHelper args={[size * 1.5, size * 1.5, '#00ff9d', '#003322']} position={[0, 0.51, 0]} />
        </mesh>
      </RigidBody>

      {/* Walls */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, 5, -size * 0.75]}>
          <boxGeometry args={[size * 1.5, 10, 1]} />
          <meshStandardMaterial color="#010102" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, 5, size * 0.75]}>
          <boxGeometry args={[size * 1.5, 10, 1]} />
          <meshStandardMaterial color="#010102" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[-size * 0.75, 5, 0]}>
          <boxGeometry args={[1, 10, size * 1.5]} />
          <meshStandardMaterial color="#010102" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[size * 0.75, 5, 0]}>
          <boxGeometry args={[1, 10, size * 1.5]} />
          <meshStandardMaterial color="#010102" />
        </mesh>
      </RigidBody>

      {/* Servers */}
      {servers.map((s, i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid" position={s.position}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={s.scale} />
            <meshStandardMaterial
              color={s.color}
              emissive={s.emissive}
              emissiveIntensity={s.emissiveIntensity}
              roughness={0.2}
              metalness={0.9}
              wireframe={Math.random() > 0.9}
            />
          </mesh>
        </RigidBody>
      ))}

      {/* Floating Holographic Terminals */}
      <Terminal3D position={[0, 0.1, -10]} onToggleTerminal={onToggleTerminal} />
    </group>
  )
}
