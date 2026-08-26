import React, { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSim } from '../SimProvider.jsx'
import { createAudioDirector } from '../../audio/AudioDirector.js'
import { playProceduralSfx } from '../../audio/ProceduralSfx.js'

export function ScareAudio() {
  const { world } = useSim()
  const directorRef = useRef(null)
  
  useEffect(() => {
    // Audio contexts need a user gesture to start in most browsers, 
    // but the 3D game begins with a "click to play" which is sufficient.
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return // For test environments without AudioContext

    const ctx = new AC()
    directorRef.current = createAudioDirector(ctx)
    return () => {
      if (ctx.state !== 'closed') ctx.close()
    }
  }, [])

  useFrame(() => {
    if (!directorRef.current) return
    const dir = directorRef.current
    
    // Process scare events
    if (world.scareEvents && world.scareEvents.length > 0) {
      for (const ev of world.scareEvents) {
        if (ev.type === 'scare') {
          playProceduralSfx(dir.ctx, dir.buses.scare, ev.soundId)
          // Add some screen shake or FOV change? This runs every frame so we can just trigger audio here.
        }
      }
      world.scareEvents.length = 0 // Clear them once processed
    }

    // Audio drop logic
    if (world.audioDrop) {
      if (dir.masterGain.gain.value > 0.01) {
        dir.masterGain.gain.cancelScheduledValues(dir.ctx.currentTime)
        dir.masterGain.gain.setTargetAtTime(0, dir.ctx.currentTime, 0.1) // Quick fade out
      }
    } else {
      if (dir.masterGain.gain.value < 0.99) {
        dir.masterGain.gain.cancelScheduledValues(dir.ctx.currentTime)
        dir.masterGain.gain.setTargetAtTime(1, dir.ctx.currentTime, 0.1) // Quick fade in
      }
    }

    // You could route enemy presence to duckMusic or updateVoiceDegradation here.
    if (world.contactWeight > 0) {
      dir.updateVoiceDegradation(0.5) // degrade voice
      // The combat bus handles ducking, might want to duck music explicit
    } else {
      dir.updateVoiceDegradation(1.0)
    }
  })

  return null
}
