import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { use3DGameStore } from '../../stores/use3DGameStore'
import { useRaycastWeapon } from './useRaycastWeapon'

export function PlasmaCutter({ camera }) {
  const { fireHitscan } = useRaycastWeapon()
  const { player, firePlasma } = use3DGameStore.getState()
  const muzzleFlashRef = useRef(0)
  const lastFireRef = useRef(0)

  useFrame((state, dt) => {
    // Decay muzzle flash
    if (muzzleFlashRef.current > 0) {
      muzzleFlashRef.current = Math.max(0, muzzleFlashRef.current - dt * 20)
    }

    // Decay heat
    const weapon = use3DGameStore.getState().player.weapons.plasma
    if (weapon.heat > 0) {
      use3DGameStore.setState(s => ({
        player: {
          ...s.player,
          weapons: {
            ...s.player.weapons,
            plasma: { ...weapon, heat: Math.max(0, weapon.heat - dt * 15) },
          },
        },
      }))
    }
  })

  const fire = () => {
    const weapon = use3DGameStore.getState().player.weapons.plasma
    if (weapon.ammo <= 0 || weapon.heat >= 100) return false

    const result = fireHitscan({
      damage: 25 * (use3DGameStore.getState().player.damageMultiplier || 1),
      range: 50,
      spread: weapon.heat > 50 ? 0.01 : 0,
      heatGain: 8,
      recoil: 1.2,
    })

    if (result.hit) {
      muzzleFlashRef.current = 1
      lastFireRef.current = Date.now()

      // Spawn impact effect
      if (result.point) {
        spawnImpactEffect(result.point, result.normal, result.enemyId ? 'enemy' : 'world')
      }
    }

    return result.hit
  }

  const spawnImpactEffect = (point, normal, type) => {
    // Emit particles, decal, sound
    // This would integrate with the particle system
    console.log(`Impact at ${point.x}, ${point.y}, ${point.z} (${type})`)
  }

  // Input handler - called from FPSController or input system
  const handleFire = (isFiring) => {
    if (isFiring) fire()
  }

  // Expose fire method for input system
  useEffect(() => {
    window.plasmaCutterFire = fire
    return () => { delete window.plasmaCutterFire }
  }, [])

  return null // Visual mesh handled separately
}

// Visual mesh component
export function PlasmaCutterMesh({ position, rotation }) {
  const { player } = use3DGameStore.getState()
  const weapon = player.weapons.plasma
  const heatIntensity = weapon.heat / 100

  return (
    <group position={position} rotation={rotation}>
      {/* Weapon body - procedural or loaded GLTF */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.8, 8]} />
        <meshStandardMaterial
          color={0x1a1a2e}
          metalness={0.8}
          roughness={0.3}
          emissive={heatIntensity > 0.5 ? 0xff4400 : 0x001133}
          emissiveIntensity={heatIntensity * 0.5}
        />
      </mesh>

      {/* Barrel */}
      <mesh position={[0, 0, -0.4]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.5, 8]} />
        <meshStandardMaterial color={0x0a0a1a} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Heat indicator rings */}
      <mesh position={[0, 0, -0.2]}>
        <ringGeometry args={[0.06, 0.08, 16]} />
        <meshBasicMaterial
          color={0x00ffff}
          transparent
          opacity={heatIntensity * 0.5}
          side={2}
        />
      </mesh>

      {/* Ammo counter (holographic) */}
      <mesh position={[0.12, 0, 0.2]} rotation={[0, -Math.PI/2, 0]} scale={0.02}>
        <textGeometry
          text={weapon.ammo.toString().padStart(3, '0')}
          args={{ font: null, size: 1, height: 0.1 }}
        />
        <meshBasicMaterial color={weapon.ammo < 10 ? 0xff4444 : 0x00ffff} transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// Hook for external fire trigger
export function usePlasmaCutter() {
  const fire = () => {
    if (window.plasmaCutterFire) return window.plasmaCutterFire()
    return false
  }
  return { fire }
}