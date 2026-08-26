import React, { useRef, useState, useEffect } from 'react'
import { Html } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Terminal3D({ position, onToggleTerminal }) {
  const { camera } = useThree()
  const [isNear, setIsNear] = useState(false)
  const meshRef = useRef()

  useFrame(() => {
    if (meshRef.current) {
      const dist = camera.position.distanceTo(meshRef.current.position)
      setIsNear(dist < 3)
    }
  })

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Allow unlocking and opening terminal if near
      if (isNear && (e.key === '`' || e.key === '~' || e.key === 'e' || e.key === 'E')) {
        onToggleTerminal()
        document.exitPointerLock()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isNear, onToggleTerminal])

  return (
    <RigidBody ref={meshRef} type="fixed" position={position} colliders="cuboid" name="terminal">
      {/* Base */}
      <mesh>
        <cylinderGeometry args={[1, 1, 0.2, 16]} />
        <meshStandardMaterial color="#050508" metalness={0.8} />
      </mesh>

      {/* Holographic Screen */}
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[2, 1.5, 0.05]} />
        <meshStandardMaterial color="#00ff9d" emissive="#00ff9d" emissiveIntensity={1.5} transparent opacity={0.6} wireframe />
      </mesh>

      {/* Floating text when near */}
      {isNear && (
        <Html position={[0, 2.5, 0]} center>
           <div className="bg-black/80 px-4 py-2 border border-cyan-400 rounded pointer-events-none select-none text-center">
             <div className="text-cyan-400 font-mono font-bold whitespace-nowrap drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">SYSTEM TERMINAL</div>
             <div className="text-white text-xs mt-1 animate-pulse">Press [E] or [~] to access</div>
           </div>
        </Html>
      )}
    </RigidBody>
  )
}
