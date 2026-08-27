// src/components/ChestCommandModal.jsx
import React, { useEffect } from 'react'
import { soundEngine } from '../audio/SoundEngine'
import { getChestCommandData } from '../data/chestCommands'

export default function ChestCommandModal({ isOpen, onClose, commandGem }) {
  useEffect(() => {
    if (isOpen) {
      soundEngine.playSFX('gem')
    }
  }, [isOpen])

  // Handle ESC and Enter keys to close modal smoothly
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        soundEngine.playSFX('close')
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !commandGem) return null

  const data = getChestCommandData(commandGem)

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.playSFX('close')
          onClose()
        }
      }}
    >
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-6 w-full max-w-2xl text-left shadow-[0_0_40px_rgba(245,158,11,0.25)] flex flex-col max-h-[90vh] overflow-y-auto relative animate-scale-up">

        {/* Close Button */}
        <button 
          onClick={() => {soundEngine.playSFX('close'); onClose()}}
          className="absolute top-4 right-4 text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-bold transition-colors"
          title="Press ESC or click to close"
        >
          ✕ ESC
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-5 border-b border-amber-500/30 pb-4">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 via-amber-600 to-amber-800 border-2 border-amber-300 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.4)] shrink-0 animate-pulse">
            <span className="text-3xl">💎</span>
          </div>
          <div>
            <div className="text-amber-400 font-bold text-xs tracking-widest uppercase mb-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              COMMAND GEM UNLOCKED
            </div>
            <h2 className="text-3xl font-black text-white tracking-wide">
              {data.command} <span className="text-amber-400/80 text-base font-semibold font-mono">[{data.category}]</span>
            </h2>
          </div>
        </div>

        {/* Summary Description */}
        <p className="text-slate-200 text-base mb-5 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
          {data.description}
        </p>

        {/* Syntax & Parameters Section */}
        <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4 mb-5 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-cyan-400 font-bold text-xs uppercase tracking-wider font-mono">Syntax</h3>
            <span className="text-[10px] font-mono text-cyan-300/60">REDIS CLI FORMAT</span>
          </div>
          <code className="block bg-slate-900/90 p-2.5 rounded-lg text-emerald-400 font-mono text-sm mb-4 border border-cyan-500/20 shadow-md overflow-x-auto">
            {data.syntax}
          </code>
          
          <h3 className="text-cyan-400 font-bold text-xs uppercase tracking-wider font-mono mb-2">Parameter Breakdown</h3>
          <div className="space-y-2">
            {data.parameters.map((param, i) => (
              <div key={i} className="text-xs p-2 rounded bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-amber-300 font-bold text-sm">{param.name}</span>
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${param.required ? 'bg-red-950 text-red-300 border border-red-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {param.required ? 'Required' : 'Optional'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                    {param.type}
                  </span>
                </div>
                <span className="text-slate-300 text-xs sm:text-right">{param.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Practical Real-World Use Case Scenario */}
        <div className="bg-gradient-to-r from-amber-950/40 to-slate-950/60 border border-amber-500/40 rounded-xl p-4 mb-5 shadow-md">
          <h3 className="text-amber-400 font-bold text-xs uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
            <span>💡</span> Practical Real-World Use-Case
          </h3>
          <p className="text-amber-100/90 text-sm leading-relaxed mb-3">
            {data.useCase}
          </p>
          <div className="bg-amber-950/50 rounded-lg p-3 text-xs italic text-amber-200/90 border border-amber-500/30 font-sans">
            "{data.realWorld}"
          </div>
        </div>

        {/* Command Example */}
        {data.example && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Interactive Example</span>
              <code className="text-xs font-mono text-emerald-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 font-bold">
                {data.example}
              </code>
            </div>
            <span className="text-xs text-slate-400 italic">
              {data.exampleExplanation}
            </span>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-auto pt-2">
          <button 
            onClick={() => {soundEngine.playSFX('nav'); onClose()}}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3.5 text-base rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-[0.98] tracking-wider uppercase font-mono"
          >
            GOT IT, HERO!
          </button>
        </div>

      </div>
    </div>
  )
}