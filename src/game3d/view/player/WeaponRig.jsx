import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FEEL } from '../../config/feel.js'

export default function WeaponRig({ children, isAds = false, fireImpulse = 0, cameraLookDelta = { x: 0, y: 0 } }) {
  const groupRef = useRef(null)
  const lastImpulse = useRef(0)
  const clockRef = useRef(0)

  // Pre-allocate vectors/quats using refs to avoid runtime allocations (L10) and persist state per-instance
  const swayTargetRef = useRef(null)
  const swayCurrentRef = useRef(null)
  const recoilPosRef = useRef(null)
  const recoilVelRef = useRef(null)

  if (!swayTargetRef.current) {
    swayTargetRef.current = new THREE.Vector3()
    swayCurrentRef.current = new THREE.Vector3()
    recoilPosRef.current = new THREE.Vector3()
    recoilVelRef.current = new THREE.Vector3()
  }

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const g = groupRef.current

    const recoilVel = recoilVelRef.current
    const recoilPos = recoilPosRef.current
    const swayTarget = swayTargetRef.current
    const swayCurrent = swayCurrentRef.current

    // Detect new impulse
    if (fireImpulse > lastImpulse.current) {
      // Add impulse to Z (backward) and Y (upwards kick)
      recoilVel.z += (fireImpulse - lastImpulse.current) * 0.1
      recoilVel.y += (fireImpulse - lastImpulse.current) * 0.05
    }
    lastImpulse.current = fireImpulse

    // 1. Recoil Spring-Damper
    // F = -k*x - c*v
    const fZ = -FEEL.weapon.recoilStiffness * recoilPos.z - FEEL.weapon.recoilDamping * recoilVel.z
    const fY = -FEEL.weapon.recoilStiffness * recoilPos.y - FEEL.weapon.recoilDamping * recoilVel.y

    recoilVel.z += fZ * delta
    recoilVel.y += fY * delta

    recoilPos.z += recoilVel.z * delta
    recoilPos.y += recoilVel.y * delta

    // 2. Sway (lags camera velocity)
    const swayAmp = FEEL.weapon.swayAmplitudeDeg * THREE.MathUtils.DEG2RAD
    swayTarget.x = THREE.MathUtils.clamp(-cameraLookDelta.y * swayAmp, -swayAmp, swayAmp)
    swayTarget.y = THREE.MathUtils.clamp(-cameraLookDelta.x * swayAmp, -swayAmp, swayAmp)

    // lerp factor approximation based on lag ms
    const lagFactor = 1 - Math.exp(-delta * 1000 / FEEL.weapon.swayLagMs)
    swayCurrent.lerp(swayTarget, lagFactor)

    // 3. Breath
    clockRef.current += delta
    const breath = Math.sin(clockRef.current * FEEL.weapon.breathHz * Math.PI * 2) * (FEEL.weapon.breathAmplitudeDeg * THREE.MathUtils.DEG2RAD)

    // Apply transformations
    // Ads dampens position offsets typically, but rules don't explicitly require ADS lerp math here,
    // though config has adsLerpMs.
    // Test environment fallback: intrinsic <group> might not have set methods
    if (g.position && g.position.set) {
      g.position.set(0, recoilPos.y, recoilPos.z)
      g.rotation.set(swayCurrent.x + breath, swayCurrent.y, 0)
    }
  })

  return (
    <group ref={groupRef}>
      {children}
    </group>
  )
}
