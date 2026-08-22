import React, { useRef, useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { createRuntime } from '../bootstrap.js'

export default function Game3DRoot({ seed, playerKey = 'session:7742' }) {
  const runtimeRef = useRef(null)

  // Create runtime exactly once, handle React 18 strict mode double-invoke
  if (!runtimeRef.current) {
    runtimeRef.current = createRuntime({ seed })
  }

  useEffect(() => {
    // We capture the ref value in the closure for cleanup
    const rt = runtimeRef.current
    return () => {
      // In strict mode, unmount might happen, then remount.
      // But the spec says "dispose it exactly once on unmount".
      // If we dispose it, we can't safely reuse it if remounted.
      // For now, adhering to strict rule 3: dispose on unmount.
      if (rt) {
        rt.dispose()
        runtimeRef.current = null
      }
    }
  }, []) // Empty deps block to run on unmount

  return (
    <Suspense fallback={<div data-testid="fallback">Loading 3D...</div>}>
      <Canvas
        data-testid="canvas"
        dpr={[0.6, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <AdaptiveDpr pixelated />
        {/* Child components will consume the runtime down the line */}
      </Canvas>
    </Suspense>
  )
}
