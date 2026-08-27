import React, { useState, useEffect, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useSim } from '../SimProvider.jsx'
import { BUDGETS } from '../../config/budgets.js'

export default function SimInspector() {
  const [visible, setVisible] = useState(false)
  const { world, runtime } = useSim()

  // Use refs for fast updating without React overhead
  const statsRef = useRef(null)

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'F3') {
        e.preventDefault()
        setVisible(v => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useFrame((state) => {
    if (!visible || !statsRef.current || !world) return

    // Collect data (fps logic would need proper rolling average, we keep it simple here)
    const activeBeat = world.objectivesComplete ? "Done" : "In Progress"
    const msPerStage = world.timeMs || 0
    const count = world.entities ? world.entities.spawnCount : 0 // Rough entity metrics

    // WebGL info
    const gl = state.gl
    const drawCalls = gl.info.render.calls

    statsRef.current.innerHTML = `
      <div style="background: rgba(0,0,0,0.8); color: lime; font-family: monospace; padding: 10px; pointer-events: none;">
        <div><b>SIM INSPECTOR (F3)</b></div>
        <div>Active Beat: ${activeBeat}</div>
        <div>Draw Calls: ${drawCalls}</div>
        <div>Entity Count: ${count}</div>
        <div>Sim Time: ${msPerStage.toFixed(2)} ms vs ${BUDGETS.frame.simStepMs} budget</div>
      </div>
    `
  })

  if (!visible) return null

  return (
    <Html fullscreen style={{ pointerEvents: 'none', zIndex: 100 }}>
      <div ref={statsRef} />
    </Html>
  )
}
