import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, Glitch } from '@react-three/postprocessing'

// 3D Components
import Player from './3d/Player.jsx'
import Level from './3d/Level.jsx'
import Projectiles from './3d/Projectiles.jsx'
import Enemies from './3d/Enemies.jsx'
import HUD from './3d/HUD.jsx'
import { ConsequenceEngine } from '../systems/consequences/ConsequenceEngine.js'
import { useState, useEffect } from 'react'

export default function Mode3D({ engine, isTerminalDrawerOpen, onToggleTerminalDrawer }) {
  const [glitchActive, setGlitchActive] = useState(false)

  useEffect(() => {
    if (!engine) return
    const ce = new ConsequenceEngine({ engine })
    const unsub = ce.onConsequence((payload) => {
      // Trigger glitch on cache invalidated or general damage
      if (payload.effect === 'glitch_effect' || payload.eventType === 'cache:invalidated') {
        setGlitchActive(true)
        setTimeout(() => setGlitchActive(false), 1500)
      }
    })
    return () => {
      unsub()
      ce.detachEngine()
    }
  }, [engine])

  const keyboardMap = [
    { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
    { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
    { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
    { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
    { name: 'jump', keys: ['Space'] },
    { name: 'sprint', keys: ['Shift'] },
    { name: 'terminal', keys: ['`', '~'] },
  ]

  return (
    <div className="w-full h-full bg-black relative top-0 left-0">
      <KeyboardControls map={keyboardMap}>
        <Canvas shadows camera={{ fov: 75, position: [0, 2, 5] }}>
          <color attach="background" args={['#020204']} />
          <fog attach="fog" args={['#020204', 10, 50]} />

          <ambientLight intensity={0.2} />
          <pointLight position={[0, 5, 0]} intensity={1.5} color="#00ff9d" castShadow />
          <pointLight position={[5, 2, -5]} intensity={2} color="#ff007b" />

          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

          <Suspense fallback={null}>
            <Physics gravity={[0, -20, 0]}>
              <Player />
              <Level size={50} onToggleTerminal={onToggleTerminalDrawer} />
              <Projectiles />
              <Enemies />
            </Physics>
          </Suspense>

          {/* Post Processing for AAA look */}
          <EffectComposer>
            <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={2} />
            <ChromaticAberration offset={[0.002, 0.002]} />
            <Glitch
              delay={[10, 20]}
              duration={[0.1, 0.3]}
              strength={[0.01, 0.05]}
              active={glitchActive}
            />
          </EffectComposer>
        </Canvas>
      </KeyboardControls>

      <HUD engine={engine} />

      {/* 3D UI Overlay */}
      <div className="absolute top-4 left-4 pointer-events-none select-none">
        <h1 className="text-rose-500 font-mono text-4xl font-black glitch drop-shadow-md" style={{ textShadow: "0 0 10px rgba(244,63,94,0.8)" }}>
          PROTOCOL <span className="text-white">VOID</span>
        </h1>
        <p className="text-cyan-400 font-mono text-sm shadow-md mt-2" style={{ textShadow: "0 0 5px rgba(34,211,238,0.8)" }}>
          Left Click: Shoot | WASD: Move | Shift: Sprint | ~ : Terminal
        </p>
      </div>

      {/* Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-2 h-2 rounded-full border border-cyan-400 bg-cyan-400/50 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
    </div>
  )
}

