import React, { useEffect } from 'react'
import { soundEngine } from '../audio/SoundEngine.js'

export default function WelcomeOverlay({ onStart }) {
  const handleStart = async () => {
    try {
      await soundEngine.init()
      if (soundEngine.ctx && soundEngine.ctx.state === 'suspended') {
        await soundEngine.ctx.resume()
      }
      soundEngine.playSFX('open')
      soundEngine.playBGM('exploration', 0.8)
    } catch (e) {
      console.warn('Audio initialization notice:', e)
    }
    if (onStart) onStart()
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleStart()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      onClick={handleStart}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 text-center cursor-pointer select-none border-4 border-cyan-500/30"
    >
      {/* Background Cyberpunk Grid Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-xl space-y-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-950/50 px-4 py-1.5 text-xs font-mono font-bold tracking-widest text-cyan-400 shadow-glow">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          SYSTEM INCIDENT DETECTED
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-[0_0_25px_rgba(6,182,212,0.6)] sm:text-6xl font-mono">
            REDIS <span className="text-cyan-400">QUEST</span>
          </h1>
          <p className="text-sm font-mono tracking-wider text-slate-400 uppercase">
            Live Backend Operator & Incident Responder
          </p>
        </div>

        {/* Summary Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 text-left text-xs font-mono text-slate-300 shadow-2xl space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <span>⚡ EMERGENCY BRIEFING:</span>
          </div>
          <p className="leading-relaxed text-slate-300">
            Production systems are under stress. Corrupted caches, expiring session locks, and overflowing job queues threaten backend stability.
          </p>
          <div className="border-t border-slate-800 pt-3 text-slate-400">
            <span className="text-amber-400 font-bold">OPERATOR RULE:</span> Observe → Diagnose → Plan → Execute Redis CLI commands. Your commands directly alter the running world state.
          </div>
        </div>

        {/* Start Prompt Button */}
        <div className="pt-4">
          <button
            onClick={handleStart}
            className="w-full sm:w-auto rounded-lg border-2 border-cyan-400 bg-cyan-500/20 px-8 py-4 font-mono text-base font-black tracking-widest text-cyan-300 shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all hover:scale-105 hover:bg-cyan-500/30 hover:text-white active:scale-95 animate-pulse"
          >
            [ ENTER ] CLICK OR PRESS ENTER TO OPERATE
          </button>
          <p className="mt-3 text-[11px] font-mono text-slate-500">
            🔊 Click to enable browser Web Audio engine & synth BGM
          </p>
        </div>
      </div>
    </div>
  )
}
