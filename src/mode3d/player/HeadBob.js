import { useFrame } from '@react-three/fiber'
import { use3DGameStore } from '../../stores/use3DGameStore'

// Head bob + recoil spring system
export function HeadBob({ camera }) {
  const { player, advanceHeadBob } = use3DGameStore.getState()
  const bobRef = useRef({ x: 0, y: 0, z: 0 })
  const recoilRef = useRef({ pitch: 0, yaw: 0, x: 0, y: 0, z: 0 })
  const lastPosRef = useRef([0, 0, 0])

  useFrame((state, dt) => {
    if (!camera) return

    const { position, velocity, sprinting, crouching, grounded, recoilOffset, headBobPhase } = player
    const speed = Math.hypot(velocity[0], velocity[2])

    // --- HEAD BOB ---
    let bobX = 0, bobY = 0, bobZ = 0

    if (grounded && speed > 0.1) {
      const newPhase = headBobPhase + dt * (sprinting ? 14 : crouching ? 6 : 10) * (speed / 5)
      advanceHeadBob(newPhase)

      const amplitude = sprinting ? 0.06 : crouching ? 0.02 : 0.04
      const verticalAmp = sprinting ? 0.04 : crouching ? 0.015 : 0.025

      bobX = Math.sin(newPhase) * amplitude * 0.5
      bobY = Math.abs(Math.sin(newPhase * 2)) * verticalAmp
      bobZ = Math.cos(newPhase) * amplitude * 0.3
    } else {
      // Smooth return to center
      bobX = lerp(bobRef.current.x, 0, dt * 10)
      bobY = lerp(bobRef.current.y, 0, dt * 10)
      bobZ = lerp(bobRef.current.z, 0, dt * 10)
    }

    // --- RECOIL SPRING ---
    // Decay recoil
    const recoilDecay = 15 // per second
    recoilRef.current.pitch = lerp(recoilRef.current.pitch, 0, dt * recoilDecay)
    recoilRef.current.yaw = lerp(recoilRef.current.yaw, 0, dt * recoilDecay)
    recoilRef.current.x = lerp(recoilRef.current.x, 0, dt * recoilDecay)
    recoilRef.current.y = lerp(recoilRef.current.y, 0, dt * recoilDecay)
    recoilRef.current.z = lerp(recoilRef.current.z, 0, dt * recoilDecay)

    // Apply external recoil kick
    if (recoilOffset[0] !== 0 || recoilOffset[1] !== 0) {
      recoilRef.current.pitch += recoilOffset[1]
      recoilRef.current.yaw += recoilOffset[0]
      // Clear the offset after applying
      use3DGameStore.getState().player.recoilOffset = [0, 0]
    }

    // --- APPLY TO CAMERA ---
    // Position offset (head bob + recoil positional)
    camera.position.x += bobX + recoilRef.current.x
    camera.position.y += bobY + recoilRef.current.y
    camera.position.z += bobZ + recoilRef.current.z

    // Rotation offset (recoil angular)
    camera.rotation.x += recoilRef.current.pitch
    camera.rotation.y += recoilRef.current.yaw

    bobRef.current = { x: bobX, y: bobY, z: bobZ }
  })

  return null
}

// Spring utility for recoil
export function recoilSpring(current, target, stiffness = 150, damping = 15) {
  // Critically damped spring
  return current + (target - current) * 0.1 // Simplified
}

function lerp(a, b, t) {
  return a + (b - a) * Math.min(1, t)
}

// Hook for external systems to trigger recoil
export function useRecoil() {
  const { recoilKick } = use3DGameStore.getState()
  return (amount = 1) => recoilKick(amount)
}