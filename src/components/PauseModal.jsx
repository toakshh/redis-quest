import React, { useEffect } from 'react'
import { soundEngine } from '../audio/SoundEngine.js'

export default function PauseModal({ isOpen, onResume, onOpenTerminal, playerHp, systemHealth }) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        soundEngine.playSFX('click')
        if (onResume) onResume()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onResume])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="relative z-10 max-w-sm w-full bg-slate-900 border-2 border-amber-500/70 rounded-2xl p-5 shadow-[0_0_30px_rgba(245,158,11,0.3)] font-mono text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm tracking-widest">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            OPERATOR PAUSE MENU
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 font-bold">
            ESC
          </span>
        </div>

        {/* Content */}
        <div className="space-y-1 text-center">
          <h3 className="text-2xl font-black text-amber-400 tracking-tight">
            ⏸️ GAME PAUSED
          </h3>
          <p className="text-xs text-slate-300">
            API Request floods, worker queues, and world state timers are currently frozen.
          </p>
        </div>

        {/* Summary Info */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs space-y-2">
          <div className="flex justify-between items-center text-slate-300">
            <span>OPERATOR HEALTH:</span>
            <span className={`font-bold ${playerHp > 70 ? 'text-emerald-400' : playerHp > 30 ? 'text-amber-400' : 'text-red-400'}`}>
              {playerHp} / 100 HP
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>REDIS SYSTEM HEALTH:</span>
            <span className={`font-bold ${systemHealth > 70 ? 'text-emerald-400' : systemHealth > 30 ? 'text-amber-400' : 'text-red-400'}`}>
              {systemHealth}%
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => {
              soundEngine.playSFX('click')
              if (onResume) onResume()
            }}
            className="w-full rounded-xl border-2 border-amber-400 bg-amber-500/20 px-4 py-3 font-mono text-xs font-black tracking-widest text-amber-200 hover:bg-amber-500/30 hover:text-white transition-all shadow-md"
          >
            ▶️ RESUME GAME (ESC)
          </button>
          {onOpenTerminal && (
            <button
              onClick={() => {
                soundEngine.playSFX('open')
                if (onResume) onResume()
                onOpenTerminal()
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 font-mono text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
            >
              ⌨️ OPEN CLI TERMINAL (~)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
