import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  EffectComposer,
  SSAO,
  Bloom,
  ChromaticAberration,
  Glitch,
  Noise,
  Vignette,
  SMAA
} from '@react-three/postprocessing'
import { GlitchMode } from 'postprocessing'
import { useSim } from '../SimProvider.jsx'

export default function PostChain() {
  const { world, runtime } = useSim()

  const caRef = useRef(null)
  const glitchRef = useRef(null)
  const noiseRef = useRef(null)
  const vignetteRef = useRef(null)

  // Track previous eviction count to trigger short glitches
  const lastEvictions = useRef(0)
  const glitchUntil = useRef(0)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // 1. Chromatic Aberration ∝ damage + latency
    // In our sim, world.latencyP99Ms is tracked. Hit stop / damage flashes might be hard to read directly unless we look at hitStopUntilMs.
    const isHitStopped = world.hitStopUntilMs && world.clock() < world.hitStopUntilMs
    // CA amplitude based on latency, up to max at ~100ms
    const latencyFactor = Math.min((world.latencyP99Ms || 0) / 100, 1)
    const caOffset = isHitStopped ? 0.05 : 0.002 + (latencyFactor * 0.015)

    if (caRef.current && caRef.current.offset) {
      caRef.current.offset.x = caOffset
      caRef.current.offset.y = caOffset
    }

    // 2. Glitch on eviction events
    const evictions = runtime.engine.stats?.evictedKeys || 0
    if (evictions > lastEvictions.current) {
      // Eviction happened! Start a quick glitch
      glitchUntil.current = t + 0.3 // 300ms glitch
      lastEvictions.current = evictions
    }
    if (glitchRef.current) {
      const isGlitching = t < glitchUntil.current
      glitchRef.current.mode = isGlitching ? GlitchMode.SPORADIC : GlitchMode.DISABLED
    }

    // 3. Noise/Grain ∝ 1 - hitRatio
    // hitRatio gives 0..1
    const hitRatio = runtime.engine.hitRatio ? runtime.engine.hitRatio() : 1
    const grainOpacity = 1 - hitRatio
    if (noiseRef.current && noiseRef.current.blendMode) {
      noiseRef.current.blendMode.opacity.value = Math.max(0.05, grainOpacity) // always slight noise
    }

    // 4. Vignette ∝ remaining timer
    // Timer is in world.playerHealth01 (0 = dead, 1 = full). Vignette closes in as health drops.
    const hp = world.playerHealth01 !== undefined ? world.playerHealth01 : 1
    // Darkness: max 0.8 when hp=0
    if (vignetteRef.current) {
      vignetteRef.current.darkness = 0.8 - (hp * 0.4)
    }
  })

  return (
    <EffectComposer disableNormalPass>
      <SSAO
        samples={16}
        radius={0.05}
        intensity={20}
        luminanceInfluence={0.5}
        resolutionScale={0.5} // half-res
      />
      <Bloom
        luminanceThreshold={0.85}
        luminanceSmoothing={0.1}
        intensity={1.0}
      />
      <ChromaticAberration
        ref={caRef}
        offset={[0.002, 0.002]}
      />
      <Glitch
        ref={glitchRef}
        delay={[1.5, 3.5]} // unused because we override mode imperatively
        duration={[0.1, 0.3]} // unused
      />
      <Noise
        ref={noiseRef}
        premultiply
      />
      <Vignette
        ref={vignetteRef}
        offset={0.5}
        darkness={0.5}
      />
      <SMAA />
    </EffectComposer>
  )
}
