import React from 'react'
import { soundEngine } from '../audio/SoundEngine.js'

export default function GameOverModal({ isOpen, systemHealth, onRestart }) {
  if (!isOpen) return null

  const handleRespawn = () => {
    soundEngine.playSFX('open')
    soundEngine.playSFX('gem')
    if (onRestart) onRestart()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in select-none">
      {/* Red Glitch Background Radial */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.2)_0,transparent_75%)] pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-slate-900 border-2 border-red-500/80 rounded-2xl p-6 shadow-[0_0_40px_rgba(239,68,68,0.5)] font-mono text-slate-100 space-y-5">
        {/* Header Badge */}
        <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
          <div className="flex items-center gap-2 text-red-400 font-black text-sm tracking-widest uppercase">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
            CRITICAL OPERATOR FAILURE
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 border border-red-600/50 text-red-300 font-bold">
            GAME OVER
          </span>
        </div>

        {/* Title & Description */}
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-black text-red-500 tracking-tight drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]">
            OPERATOR OVERLOADED
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Unthrottled API Request floods breached operator defenses. Cascading failure degraded Redis Server stability.
          </p>
        </div>

        {/* Impact Breakdown Card */}
        <div className="rounded-xl border border-red-900/60 bg-slate-950/80 p-4 text-xs space-y-2.5">
          <div className="flex justify-between items-center text-slate-300">
            <span>OPERATOR HP:</span>
            <span className="text-red-400 font-bold">0 / 100 HP (KNOCKED OUT)</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>REDIS SYSTEM HEALTH:</span>
            <span className={`font-bold ${systemHealth < 40 ? 'text-red-400' : 'text-amber-400'}`}>
              {systemHealth}% (DEGRADED -25%)
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>SAFE RESPAWN ZONE:</span>
            <span className="text-cyan-400 font-bold">Grid (2, 2)</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={handleRespawn}
            className="w-full rounded-xl border-2 border-red-500 bg-red-600/30 px-6 py-3.5 font-mono text-sm font-black tracking-widest text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all hover:scale-105 hover:bg-red-500/40 hover:text-white active:scale-95 animate-pulse"
          >
            [ 🔄 REBOOT OPERATOR & RESPAWN ]
          </button>
          <p className="mt-2 text-[10px] text-center text-slate-400">
            Press to reboot hero instance at safe zone grid (2, 2)
          </p>
        </div>
      </div>
    </div>
  )
}
