import React from 'react'

// The entry screen presenting the 2D and 3D games as two separate products
// (plan section 5.3 / Law "mode isolation"). Neither panel imports anything
// from the other mode — this component only ever calls onSelect with a
// mode id; App.jsx decides what to mount.

export default function ModeLauncher({ onSelect }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950 p-6">
      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col justify-between gap-4 rounded border border-cyan/30 bg-panel/60 p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold tracking-wide text-cyan">REDIS QUEST</h2>
            <p className="text-sm text-slate-300">Learn Redis commands</p>
            <p className="text-xs text-dim">Terminal · Puzzle · RPG</p>
            <p className="text-xs text-dim">Instant</p>
          </div>
          <button
            type="button"
            onClick={() => onSelect('2d')}
            className="rounded border border-cyan/50 px-4 py-2 text-sm font-bold tracking-widest text-cyan hover:bg-cyan/10"
          >
            PLAY 2D
          </button>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded border border-amber/30 bg-panel/60 p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold tracking-wide text-amber">PROTOCOL ZERO</h2>
            <p className="text-sm text-slate-300">Survive Facility NODE-7</p>
            <p className="text-xs text-dim">Horror · Shooter · Story</p>
            <p className="text-xs text-dim">~40 MB download · requires a GPU</p>
            <p className="text-xs font-bold text-red-400">⚠ Frequent jumpscares, loud audio, darkness</p>
          </div>
          <button
            type="button"
            onClick={() => onSelect('3d')}
            className="rounded border border-amber/50 px-4 py-2 text-sm font-bold tracking-widest text-amber hover:bg-amber/10"
          >
            ENTER NODE-7
          </button>
        </div>
      </div>
    </div>
  )
}
