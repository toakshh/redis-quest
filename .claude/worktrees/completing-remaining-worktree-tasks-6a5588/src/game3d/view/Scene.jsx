import React, { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SimProvider } from './SimProvider.jsx'
import LevelGeometry from './level/LevelGeometry.jsx'
import Terminals from './level/Terminals.jsx'
import Hostiles from './entities/Hostiles.jsx'
import PlayerController from './player/PlayerController.jsx'

// Everything that lives inside the GL canvas.
//
// SimProvider sits here rather than outside <Canvas> on purpose: R3F renders
// into its own reconciler, and keeping the provider inside means the scene
// components get the world through ordinary React context with no bridging.
// The DOM-side HUD receives the same world by prop instead.

// Owns the pointer-lock handshake and reports the state upward, so the HUD
// can show a "click to play" prompt and the player controller can ignore
// mouse deltas while the cursor is free.
function PointerLock({ requested, onChange }) {
  const { gl } = useThree()

  useEffect(() => {
    const el = gl.domElement
    function handleChange() {
      onChange(document.pointerLockElement === el)
    }
    document.addEventListener('pointerlockchange', handleChange)
    return () => document.removeEventListener('pointerlockchange', handleChange)
  }, [gl, onChange])

  useEffect(() => {
    const el = gl.domElement
    if (!requested) {
      if (document.pointerLockElement === el) document.exitPointerLock()
      return
    }
    if (document.pointerLockElement !== el && el.requestPointerLock) {
      // Chrome rejects the request if it is not user-gesture adjacent; the
      // promise rejection is harmless and must not surface as an error.
      const result = el.requestPointerLock()
      if (result && typeof result.catch === 'function') result.catch(() => {})
    }
  }, [gl, requested])

  return null
}

// The player's flashlight. Parented to the camera so it always points where
// they look, which is what makes a facility this dark navigable at all — and
// it is the horror-genre answer rather than a lighting cheat: what you can
// see is exactly the cone you chose to point somewhere.
//
// The light follows the camera per-frame rather than being re-parented to it.
// Parenting would mean mutating the scene graph (and adding the camera to the
// scene so its children are traversed), which behaves differently across the
// real renderer and the test reconciler. Copying a position each frame is
// cheap, has no ordering hazards, and works identically everywhere.
const FLASHLIGHT_DIR = new THREE.Vector3()

function Flashlight() {
  const lightRef = useRef(null)
  const targetRef = useRef(null)

  useEffect(() => {
    const light = lightRef.current
    const target = targetRef.current
    if (light && target) light.target = target
  }, [])

  useFrame(({ camera }) => {
    const light = lightRef.current
    const target = targetRef.current
    // Guarded: under a mocked <Canvas> these are DOM nodes, not three objects.
    if (!light || !target || !camera || !camera.getWorldDirection) return
    if (!light.position || !light.position.copy) return

    light.position.copy(camera.position)
    camera.getWorldDirection(FLASHLIGHT_DIR)
    target.position.copy(camera.position).addScaledVector(FLASHLIGHT_DIR, 10)
  })

  return (
    <>
      <spotLight
        ref={lightRef}
        color="#e8f4ff"
        intensity={150}
        distance={34}
        angle={0.62}
        penumbra={0.55}
        decay={2}
      />
      <object3D ref={targetRef} />
    </>
  )
}

export default function Scene({
  runtime,
  world,
  level,
  active,
  locked,
  lockRequested,
  onLockChange,
  onNearestTerminal,
  onFire,
}) {
  const amb = level.ambient || {}

  return (
    <SimProvider runtime={runtime} world={world}>
      <color attach="background" args={[amb.fogColor || '#05070a']} />
      <fog attach="fog" args={[amb.fogColor || '#05070a', amb.fogNear ?? 4, amb.fogFar ?? 34]} />
      <ambientLight intensity={amb.ambientIntensity ?? 0.12} />

      <PointerLock requested={lockRequested} onChange={onLockChange} />
      <Flashlight />
      <LevelGeometry level={level} />
      <Terminals onNearestChange={onNearestTerminal} />
      <Hostiles />
      <PlayerController active={active} locked={locked} onFire={onFire} />
    </SimProvider>
  )
}
