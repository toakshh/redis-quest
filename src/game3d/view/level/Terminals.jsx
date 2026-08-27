import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSim } from '../SimProvider.jsx'

// Wall terminals: the diegetic place where the player is taught a command.
// Standing near one arms the console with that terminal's lesson, which is
// how a non-technical player meets EXPIRE without ever reading a manual
// (the Interaction Ladder, plan §8).

export const TERMINAL_RANGE_M = 3.2

function TerminalPost({ terminal, active }) {
  const glow = useRef(null)

  useFrame((state) => {
    if (!glow.current) return
    const t = state.clock.elapsedTime
    // Idle terminals breathe slowly; the one in range pulses hard so it reads
    // as interactive from across the room.
    glow.current.intensity = active
      ? 26 + Math.sin(t * 9) * 8
      : 9 + Math.sin(t * 1.6) * 2.5
  })

  const [x, y, z] = terminal.position

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.9, 1.8, 0.5]} />
        {/* Rough and barely metallic: a polished slab catches the player's
            own flashlight at point-blank range and reads as a white box. */}
        <meshStandardMaterial color="#151d26" roughness={0.85} metalness={0.15} />
      </mesh>
      {/* The screen face. */}
      <mesh position={[0, 1.35, 0.26]}>
        <planeGeometry args={[0.66, 0.44]} />
        {/* toneMapped stays on: an untone-mapped emissive at this intensity
            blows out to flat white the moment the player walks up to it. */}
        <meshStandardMaterial
          color={active ? '#1d7a63' : '#123f36'}
          emissive={active ? '#4fe0b4' : '#125a4a'}
          emissiveIntensity={active ? 1.2 : 0.5}
        />
      </mesh>
      <pointLight ref={glow} position={[0, 1.4, 0.6]} color="#7dffd4" distance={9} decay={2} />
    </group>
  )
}

export default function Terminals({ onNearestChange }) {
  const { world } = useSim()
  const nearest = useRef(null)
  const [activeId, setActiveId] = React.useState(null)
  const terminals = (world.level && world.level.terminals) || []

  useFrame(() => {
    const e = world.entities
    const id = world.playerId
    if (id == null || id < 0) return
    const px = e.posX[id]
    const pz = e.posZ[id]

    let found = null
    let bestD2 = TERMINAL_RANGE_M * TERMINAL_RANGE_M
    for (const t of terminals) {
      const dx = t.position[0] - px
      const dz = t.position[2] - pz
      const d2 = dx * dx + dz * dz
      if (d2 <= bestD2) { bestD2 = d2; found = t }
    }

    // Only notify on an actual change — this runs 60×/second and setState on
    // every frame would re-render the whole HUD tree.
    const foundId = found ? found.id : null
    if (nearest.current !== foundId) {
      nearest.current = foundId
      setActiveId(foundId)
      if (onNearestChange) onNearestChange(found)
    }
  })

  return (
    <group name="terminals">
      {terminals.map((t) => (
        <TerminalPost key={t.id} terminal={t} active={t.id === activeId} />
      ))}
    </group>
  )
}
