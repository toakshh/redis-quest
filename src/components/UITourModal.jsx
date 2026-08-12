import React, { useState, useEffect } from 'react'

const TOUR_STEPS = [
  {
    title: 'WELCOME TO THE UI TOUR',
    icon: '🧭',
    content: (
      <div className="space-y-2">
        <p className="text-sm text-slate-300 leading-relaxed">
          Welcome to <strong className="text-cyan-400">Redis Quest</strong>! This interactive tour will guide you through all the tabs, header controls, stats, and companion features of your cyberpunk workstation.
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          Use the navigation buttons below or your keyboard arrow keys to step through each feature.
        </p>
      </div>
    ),
  },
  {
    title: 'HEADER STATS & GAUGES',
    icon: '📊',
    content: (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="font-bold text-amber-400 block mb-1">🔑 KEYS</span>
            <p className="text-slate-300">Live count of key-value pairs stored in the active Redis engine instance.</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="font-bold text-cyan-400 block mb-1">⚡ LVL & XP</span>
            <p className="text-slate-300">Your hero level and progress bar towards unlocking your next skill point.</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="font-bold text-amber-400 block mb-1">✨ SP</span>
            <p className="text-slate-300">Available Skill Points to allocate in the Skill Tree for stat boosts and perks.</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="font-bold text-purple-400 block mb-1">🗺️ REGIONS</span>
            <p className="text-slate-300">Total unlocked regions across the 12 Cyberpunk Redis lab zones.</p>
          </div>
        </div>

        {/* Explicit Guidance on MEM GAUGE vs MEM INSPECTOR */}
        <div className="bg-amber-950/30 p-3 rounded-lg border border-amber-500/40 text-xs">
          <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
            <span>⚠️</span>
            <span>MEM GAUGE vs MEM INSPECTOR</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            <strong className="text-cyan-300">Header MEM GAUGE:</strong> Monitors overall real-time RAM allocation and live memory usage percentage of the Redis process.<br />
            <strong className="text-cyan-300">MEM INSPECTOR Tab:</strong> Provides a deep, key-by-key database breakdown showing data types, individual byte sizes, TTLs, and raw value payload inspection.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: 'SIDEBAR TABS & PANELS',
    icon: '🗂️',
    content: (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <strong className="text-cyan-300 block">🗺️ WORLD</strong>
            <span className="text-slate-400">2D Isometric RPG game canvas for exploration, enemy combat, and gem looting.</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <strong className="text-cyan-300 block">🔍 MEM INSPECTOR</strong>
            <span className="text-slate-400">Granular key-by-key database inspector and memory allocation breakdown.</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <strong className="text-cyan-300 block">⚔️ BOSS</strong>
            <span className="text-slate-400">Memory Goblin Boss battles with Redis command counter mechanics.</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <strong className="text-cyan-300 block">🏆 AWARDS</strong>
            <span className="text-slate-400">Achievement gallery tracking your Redis milestones and rewards.</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <strong className="text-cyan-300 block">🌳 SKILLS</strong>
            <span className="text-slate-400">Interactive Skill Tree to spend SP on command mastery and passive buffs.</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800">
            <strong className="text-cyan-300 block">🎨 LOOK</strong>
            <span className="text-slate-400">Cosmetic locker for hero avatar themes and terminal color schemes.</span>
          </div>
        </div>
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800 text-center">
          <strong className="text-cyan-300">⚙️ CONF:</strong> <span className="text-slate-400">App settings, save data management, sound & theme toggles.</span>
        </div>
      </div>
    ),
  },
  {
    title: 'TERMINAL DRAWER & FULLSCREEN MODE',
    icon: '💻',
    content: (
      <div className="space-y-3 text-xs">
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
          <span className="text-2xl">⌨️</span>
          <div>
            <strong className="text-amber-400 block mb-1">Expandable Terminal Drawer</strong>
            <p className="text-slate-300 leading-relaxed">
              Toggle the right-hand CLI terminal side-drawer anytime using the <code className="text-cyan-300 bg-slate-800 px-1 py-0.5 rounded">~</code> (Tilde) key, clicking <strong className="text-amber-300">⌨️ CLI TERMINAL</strong> in the canvas header, or using the drawer toggle button.
            </p>
          </div>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
          <span className="text-2xl">⛶</span>
          <div>
            <strong className="text-cyan-400 block mb-1">Full-Screen Immersion Mode</strong>
            <p className="text-slate-300 leading-relaxed">
              Click <strong className="text-cyan-300">⛶ FULLSCREEN</strong> in the top header or HUD to hide all sidebars and headers, expanding the 2D Game Canvas for an uninterrupted gaming experience.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'REX COMPANION',
    icon: '🤖',
    content: (
      <div className="space-y-3 text-xs">
        <div className="bg-slate-950/60 p-4 rounded-xl border border-cyan-500/30 flex items-center gap-4">
          <div className="text-4xl">🤖</div>
          <div className="space-y-1">
            <strong className="text-cyan-300 text-sm block">REX AI Assistant & Guide</strong>
            <p className="text-slate-300 leading-relaxed">
              Click the floating <strong className="text-cyan-400">🤖 REX</strong> button in the bottom right corner to open REX&apos;s companion panel. REX offers contextual hints, personality dialogue, region tips, and command assistance throughout your quest!
            </p>
          </div>
        </div>
        <p className="text-center text-slate-400 text-[11px]">
          You are all set! Click <strong className="text-emerald-400">READY TO PLAY</strong> below to close this tour.
        </p>
      </div>
    ),
  },
]

export default function UITourModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (isOpen) {
      setStep(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const current = TOUR_STEPS[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-cyan-500/60 rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.3)] text-slate-100 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{current.icon}</span>
            <div>
              <h2 className="text-lg font-bold tracking-wider text-cyan-400">{current.title}</h2>
              <p className="text-xs text-slate-400 font-mono">Step {step + 1} of {TOUR_STEPS.length}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close UI tour modal"
            className="text-slate-400 hover:text-white text-xl font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="flex gap-2">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                i === step
                  ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]'
                  : i < step
                  ? 'bg-cyan-700'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Body Content */}
        <div className="min-h-[220px] flex flex-col justify-center">
          {current.content}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
              step === 0
                ? 'opacity-40 border-slate-800 text-slate-600 cursor-not-allowed'
                : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            ← PREV
          </button>

          {step < TOUR_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(TOUR_STEPS.length - 1, s + 1))}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
            >
              NEXT →
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all"
            >
              READY TO PLAY 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
