import React, { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSim } from '../SimProvider.jsx'
import { createAudioDirector } from '../../audio/AudioDirector.js'
import { playProceduralSfx } from '../../audio/ProceduralSfx.js'

export function ScareAudio() {
  const { world } = useSim()
  const tickRef = useRef(-1)
  const directorRef = useRef(null)
  const lastAudioDropRef = useRef(null)
  
  useEffect(() => {
    if (typeof window === 'undefined') return
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
    
    // Process scare events if we are on a new tick
    if (world.tick !== tickRef.current) {
      tickRef.current = world.tick
      if (world.scareEvents && world.scareEvents.length > 0) {
        for (const ev of world.scareEvents) {
          if (ev.type === 'scare') {
            playProceduralSfx(dir.ctx, dir.buses.scare, ev.soundId)
          }
        }
      }
    }

    // Audio drop logic
    if (world.audioDrop !== lastAudioDropRef.current) {
      lastAudioDropRef.current = world.audioDrop
      const targetGain = world.audioDrop ? 0 : 1
      dir.masterGain.gain.cancelScheduledValues(dir.ctx.currentTime)
      dir.masterGain.gain.setTargetAtTime(targetGain, dir.ctx.currentTime, 0.1)
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
