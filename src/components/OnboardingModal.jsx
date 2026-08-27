import React, { useState, useEffect } from 'react'

const STORAGE_KEY = 'redis_quest_onboarding_completed'

export function hasCompletedOnboarding() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch (e) {
    return false
  }
}

export function setOnboardingCompleted(completed = true) {
  try {
    localStorage.setItem(STORAGE_KEY, completed ? 'true' : 'false')
  } catch (e) {
    // ignore
  }
}

export default function OnboardingModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1)

  useEffect(() => {
    if (isOpen) {
      setStep(1)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleFinish = () => {
    setOnboardingCompleted(true)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-cyan-500/60 rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.3)] text-slate-100 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-cyan-400">{'>_'}</span>
            <div>
              <h2 className="text-xl font-bold tracking-wider text-cyan-400">REDIS QUEST ONBOARDING</h2>
              <p className="text-xs text-slate-400 font-mono">Step {step} of 3</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white text-xl font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                s === step
                  ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]'
                  : s < step
                  ? 'bg-cyan-700'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Content per Step */}
        <div className="min-h-[240px] flex flex-col justify-center">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-slate-950/60 p-4 rounded-xl border border-cyan-500/30">
                <div className="text-4xl">🤖</div>
                <div>
                  <h3 className="text-lg font-bold text-cyan-300">Welcome to Cyberpunk Redis Lab!</h3>
                  <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                    Meet <strong className="text-amber-400">REX</strong>, your AI companion robot. The Redis Core memory grids have been corrupted by glitch entities and memory goblins.
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed px-1">
                Your mission: Journey through 12 key-value realm regions, harness Redis in-memory data structures, execute CLI commands, and restore memory stability to the realm!
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-cyan-300">QWERTY Physical Controls & Movement</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-bold text-amber-400 flex items-center gap-2">
                    <span className="bg-slate-800 px-2 py-0.5 rounded font-mono border border-slate-700">W A S D</span>
                    <span>Movement</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Physical QWERTY key positions navigate your hero block in Isometric 2D space regardless of OS keyboard layout.
                  </p>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-bold text-amber-400 flex items-center gap-2">
                    <span className="bg-slate-800 px-2 py-0.5 rounded font-mono border border-slate-700">E</span>
                    <span>Interact / Loot</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Press physical E to open treasure chests, loot command gems, and trigger region interactions.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                <span className="font-mono text-cyan-300 bg-slate-800 px-2 py-1 rounded">` / ~ (Tilde)</span>
                <span>Toggle Diegetic Magic Scroll CLI Terminal</span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-cyan-300">Command Gems & Magic Scroll CLI</h3>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-start gap-3">
                  <span className="text-2xl">💎</span>
                  <div>
                    <strong className="text-amber-400 block">Command Gems</strong>
                    Loot gems like <code className="text-cyan-300">SET</code>, <code className="text-cyan-300">GET</code>, <code className="text-cyan-300">DEL</code>, and <code className="text-cyan-300">HSET</code> to cast spells from your HUD hotbar and counter boss shields!
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-start gap-3">
                  <span className="text-2xl">📜</span>
                  <div>
                    <strong className="text-amber-400 block">Magic Scroll CLI</strong>
                    Open the terminal (~ key) to type real Redis commands. Watch live memory inspection and world state react instantly to your queries!
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
              step === 1
                ? 'opacity-40 border-slate-800 text-slate-600 cursor-not-allowed'
                : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            ← BACK
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
            >
              NEXT →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-6 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all"
            >
              START QUEST 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
