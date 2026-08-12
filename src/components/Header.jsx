import { useEffect, useState } from 'react'
import { useGameStore, levelInfo } from '../store/gameStore.js'
import { formatBytes } from '../engine/datatypes/memory.js'

// Compact stat tile used for KEYS / MEM readouts. `value` is the emphasized
// figure, `label` the dimmed caption.
function Stat({ label, value, className = 'text-amber' }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] tracking-[0.2em] text-dim">{label}</span>
      <span className={`text-sm font-bold leading-none tabular-nums ${className}`}>
        {value}
      </span>
    </div>
  )
}

// Thin gradient bar; `pct` clamped to [0,100].
function Meter({ pct, className }) {
  const width = Math.max(0, Math.min(100, pct))
  return (
    <div className="h-1 w-28 overflow-hidden rounded-full bg-panel2">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${className}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

// Top app bar: brand, player level/XP, keys in the active db, and a live
// used_memory gauge. Live-updates on every engine mutation (change/expired)
// so keys + memory always reflect what the terminal just did.
export default function Header({ engine, className = '' }) {
  const xp = useGameStore((s) => s.xp)
  const skillPoints = useGameStore((s) => s.skillPoints)
  const unlockedSkills = useGameStore((s) => s.unlockedSkills)
  const unlockedRegions = useGameStore((s) => s.unlockedRegions)
  const mode = useGameStore((s) => s.mode)
  const [, force] = useState(0)

  useEffect(() => {
    const refresh = () => force((n) => n + 1)
    engine.on('change', refresh)
    engine.on('expired', refresh)
    return () => {
      engine.off('change', refresh)
      engine.off('expired', refresh)
    }
  }, [engine])

  const { level, xpIntoLevel, xpForNext } = levelInfo(xp)
  const keys = engine.store.size
  const usedBytes = engine.memoryBytes
  const limitBytes = engine.memoryLimit
  const memPct = limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0
  const memTone =
    memPct >= 85
      ? 'bg-red shadow-glow-red'
      : memPct >= 50
        ? 'bg-amber'
        : 'bg-cyan shadow-glow'

  const skillsUnlocked = Object.keys(unlockedSkills).length
  const regionsUnlocked = Object.keys(unlockedRegions).length

  return (
    <header
      className={`flex items-center justify-between gap-6 border-b border-edge bg-panel/60 px-6 py-3 ${className}`}
    >
      {/* brand */}
      <div className="flex items-center gap-3">
        <span className="glow-text text-2xl font-bold text-cyan">{'>_'}</span>
        <div className="leading-tight">
          <h1 className="text-lg font-bold tracking-widest text-cyan">
            REDIS QUEST
          </h1>
          <p className="text-[9px] tracking-[0.25em] text-dim">
            CYBERPUNK REDIS LAB
          </p>
        </div>
      </div>

      {/* live stats */}
      <div className="flex items-center gap-7">
        {/* player level + xp progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-[0.2em] text-fg">
              LVL {level}
            </span>
            <span className="text-[10px] tabular-nums text-dim">
              {xpIntoLevel}/{xpForNext} XP
            </span>
          </div>
          <Meter pct={(xpIntoLevel / xpForNext) * 100} className="bg-cyan shadow-glow" />
        </div>

        {/* keys count */}
        <div className="h-8 w-px bg-edge" aria-hidden="true" />
        <Stat label="KEYS" value={keys} className="text-amber" />

        <div className="h-8 w-px bg-edge" aria-hidden="true" />

        {/* memory gauge */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] tracking-[0.2em] text-dim">MEM</span>
            <span className="text-xs tabular-nums text-fg">
              {formatBytes(usedBytes)}
              <span className="text-dim"> / {formatBytes(limitBytes)}</span>
            </span>
          </div>
          <Meter pct={memPct} className={memTone} />
        </div>

        <div className="h-8 w-px bg-edge" aria-hidden="true" />

        {/* skill points */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] tracking-[0.2em] text-amber">SP</span>
            <span className="text-sm font-bold tabular-nums text-amber">{skillPoints}</span>
          </div>
          <Meter pct={(skillsUnlocked / 60) * 100} className="bg-amber shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
        </div>

        <div className="h-8 w-px bg-edge" aria-hidden="true" />

        {/* regions & mode */}
        <div className="flex flex-col gap-1.5 items-end">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] tracking-[0.2em] text-purple">{regionsUnlocked}/12</span>
            <span className="text-xs tabular-nums text-fg">REGIONS</span>
          </div>
          <span className={`text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded border ${
            mode === 'pro' ? 'border-amber text-amber' : 'border-cyan text-cyan'
          }`}>
            {mode === 'pro' ? 'PRO' : 'BEGINNER'}
          </span>
        </div>
      </div>
    </header>
  )
}