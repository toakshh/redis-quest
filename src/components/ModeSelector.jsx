import React, { useEffect, useState } from 'react'

export const MODE_KEY = 'rq_game_mode'

export function getSavedGameMode() {
  try {
    const saved = localStorage.getItem(MODE_KEY)
    if (saved === '2d' || saved === '3d') {
      return saved
    }
  } catch (e) {
    // Ignore storage errors
  }
  return '3d' // Default to 3D Shooting Mode
}

export function saveGameMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch (e) {
    // Ignore storage errors
  }
}

export default function ModeSelector({ currentMode, onModeChange, className = '' }) {
  const [mode, setMode] = useState(currentMode || getSavedGameMode())

  useEffect(() => {
    if (currentMode && currentMode !== mode) {
      setMode(currentMode)
    }
  }, [currentMode])

  const handleSelectMode = (newMode) => {
    setMode(newMode)
    saveGameMode(newMode)
    if (onModeChange) {
      onModeChange(newMode)
    }
  }

  return (
    <div className={`inline-flex items-center rounded-lg border border-cyan/40 bg-slate-900/90 p-1 shadow-lg ${className}`}>
      <button
        type="button"
        onClick={() => handleSelectMode('3d')}
        aria-pressed={mode === '3d'}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold font-mono transition-all duration-200 ${
          mode === '3d'
            ? 'bg-gradient-to-r from-cyan to-blue-600 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.5)] scale-[1.02]'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <span className="text-sm">🎯</span>
        <span>3D SHOOTER</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelectMode('2d')}
        aria-pressed={mode === '2d'}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold font-mono transition-all duration-200 ${
          mode === '2d'
            ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-slate-950 shadow-[0_0_12px_rgba(192,132,252,0.5)] scale-[1.02]'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <span className="text-sm">🗺️</span>
        <span>2D ISOMETRIC</span>
      </button>
    </div>
  )
}
