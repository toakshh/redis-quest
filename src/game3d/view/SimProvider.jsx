import React, { createContext, useContext, useEffect, useMemo } from 'react'

export const SimContext = createContext(null)

export function useSim() {
  const ctx = useContext(SimContext)
  if (!ctx) {
    throw new Error('useSim must be used within a SimProvider')
  }
  return ctx
}

export function SimProvider({ runtime, world, children }) {
  // Stable context value
  const value = useMemo(() => ({ runtime, world }), [runtime, world])

  useEffect(() => {
    let frameId
    let lastTime = performance.now()

    function gameLoop(time) {
      // Calculate delta in seconds, clamped to max 0.1s to avoid huge jumps
      let dt = (time - lastTime) / 1000
      if (dt > 0.1) dt = 0.1
      lastTime = time

      // Step the physics / simulation
      world.step(dt)

      frameId = requestAnimationFrame(gameLoop)
    }

    frameId = requestAnimationFrame(gameLoop)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [world])

  return (
    <SimContext.Provider value={value}>
      {children}
    </SimContext.Provider>
  )
}
