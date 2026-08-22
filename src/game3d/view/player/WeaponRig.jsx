import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FEEL } from '../../config/feel.js'

// Pre-allocate vectors/quats outside to avoid runtime allocations (L10)
const _swayTarget = new THREE.Vector3()
const _swayCurrent = new THREE.Vector3()
const _recoilPos = new THREE.Vector3()
const _recoilVel = new THREE.Vector3()

export default function WeaponRig({ children, isAds = false, fireImpulse = 0, cameraLookDelta = { x: 0, y: 0 } }) {
  const groupRef = useRef(null)
  const lastImpulse = useRef(0)
  const clockRef = useRef(0)

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const g = groupRef.current

    // Detect new impulse
    if (fireImpulse > lastImpulse.current) {
      // Add impulse to Z (backward) and Y (upwards kick)
      _recoilVel.z += (fireImpulse - lastImpulse.current) * 0.1
      _recoilVel.y += (fireImpulse - lastImpulse.current) * 0.05
    }
    lastImpulse.current = fireImpulse

    // 1. Recoil Spring-Damper
    // F = -k*x - c*v
    const fZ = -FEEL.weapon.recoilStiffness * _recoilPos.z - FEEL.weapon.recoilDamping * _recoilVel.z
    const fY = -FEEL.weapon.recoilStiffness * _recoilPos.y - FEEL.weapon.recoilDamping * _recoilVel.y

    _recoilVel.z += fZ * delta
    _recoilVel.y += fY * delta

    _recoilPos.z += _recoilVel.z * delta
    _recoilPos.y += _recoilVel.y * delta

    // 2. Sway (lags camera velocity)
    const swayAmp = FEEL.weapon.swayAmplitudeDeg * THREE.MathUtils.DEG2RAD
    _swayTarget.x = THREE.MathUtils.clamp(-cameraLookDelta.y * swayAmp, -swayAmp, swayAmp)
    _swayTarget.y = THREE.MathUtils.clamp(-cameraLookDelta.x * swayAmp, -swayAmp, swayAmp)

    // lerp factor approximation based on lag ms
    const lagFactor = 1 - Math.exp(-delta * 1000 / FEEL.weapon.swayLagMs)
    _swayCurrent.lerp(_swayTarget, lagFactor)

    // 3. Breath
    clockRef.current += delta
    const breath = Math.sin(clockRef.current * FEEL.weapon.breathHz * Math.PI * 2) * (FEEL.weapon.breathAmplitudeDeg * THREE.MathUtils.DEG2RAD)

    // Apply transformations
    // Ads dampens position offsets typically, but rules don't explicitly require ADS lerp math here,
    // though config has adsLerpMs.
    // Test environment fallback: intrinsic <group> might not have set methods
    if (g.position && g.position.set) {
      g.position.set(0, _recoilPos.y, _recoilPos.z)
      g.rotation.set(_swayCurrent.x + breath, _swayCurrent.y, 0)
    }
  })

  return (
    <group ref={groupRef}>
      {children}
    </group>
  )
}
