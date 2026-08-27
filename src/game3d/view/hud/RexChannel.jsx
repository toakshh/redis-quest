import React, { useState, useEffect } from 'react'

export default function RexChannel({ world, level }) {
  const [visibleMessage, setVisibleMessage] = useState(null)
  
  useEffect(() => {
    if (!world || !world.runtime || !world.runtime.bus) return
    
    let timeoutId
    // Listen for hint events or debriefs
    const handleHint = (data) => {
      // Simulate audio processing delay based on world latency
      const p99 = world.latencyP99Ms || 0
      setVisibleMessage({
        text: data.text,
        tier: data.tier || 0,
        degraded: p99 > 15
      })

      // Hide after a duration
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setVisibleMessage(null)
      }, 5000)
    }

    world.runtime.bus.on('sim:hint', handleHint)
    return () => {
      world.runtime.bus.off('sim:hint', handleHint)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [world])

  if (!visibleMessage) return null

  const isDegraded = visibleMessage.degraded

  return (
    <div
      data-testid="rex-channel"
      className="absolute top-24 left-6 max-w-sm pointer-events-none"
    >
      <div className="flex items-start gap-3 bg-black/80 border-l-2 border-[#4fd8ff] p-3 shadow-lg">
        <div className="w-8 h-8 rounded bg-[#4fd8ff]/20 flex items-center justify-center shrink-0 border border-[#4fd8ff]/40">
          {/* visual noise when degraded */}
          <span className="text-[#4fd8ff]" style={{ filter: isDegraded ? 'blur(1px)' : 'none' }}>
            REX
          </span>
        </div>
        <div className="flex-1 text-sm font-mono text-[#e0efff] leading-snug break-words">
          <span className="text-[#4fd8ff]/50 text-[10px] block mb-1">
            {isDegraded ? 'CONNECTION DEGRADED' : `HINT TIER ${visibleMessage.tier}`}
          </span>
          <span style={{ 
            opacity: isDegraded ? 0.7 : 1,
            textShadow: isDegraded ? '2px 0 2px rgba(255,0,0,0.5), -2px 0 2px rgba(0,255,255,0.5)' : 'none'
          }}>
            {visibleMessage.text}
          </span>
        </div>
      </div>
    </div>
  )
}
