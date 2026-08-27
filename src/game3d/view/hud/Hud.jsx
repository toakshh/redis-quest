import React, { useEffect, useRef, useState } from 'react'

// The HUD reads sim state on an interval rather than subscribing to React
// state per frame: the sim mutates typed arrays 60×/second and re-rendering
// this tree that often would dominate the frame budget. 10Hz is well past
// the point a human reads a number, and the TTL bar itself is animated in
// CSS so it still looks continuous.

const HUD_HZ = 10

function useHudSnapshot(world) {
  const [snap, setSnap] = useState(() => readSnapshot(world))
  useEffect(() => {
    setSnap(readSnapshot(world))
    const t = setInterval(() => setSnap(readSnapshot(world)), 1000 / HUD_HZ)
    return () => clearInterval(t)
  }, [world])
  return snap
}

function readSnapshot(world) {
  if (!world) return { health01: 1, ttlMs: 0, pressure: 0, latency: 0, contact: 0, objectives: {}, complete: false }
  return {
    health01: world.playerHealth01 ?? 1,
    ttlMs: world.playerTtlMs ?? 0,
    pressure: world.memoryPressure ?? 0,
    latency: world.latencyP99Ms ?? 0,
    contact: world.contactWeight ?? 0,
    objectives: world.objectiveStatus || {},
    complete: Boolean(world.objectivesComplete),
  }
}

function ttlColor(h) {
  if (h > 0.5) return '#6effc0'
  if (h > 0.25) return '#ffd166'
  return '#ff4d4d'
}

export default function Hud({ world, level, nearTerminal, consoleOpen, lastResult, pointerLocked, entered }) {
  const snap = useHudSnapshot(world)
  const seconds = Math.max(0, snap.ttlMs / 1000)
  const critical = snap.health01 <= 0.25 && snap.health01 > 0
  const objectives = level.objectives || []

  // Flash the screen edges when something is currently chewing on the player.
  const damageFlash = snap.contact > 0

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-mono text-[#dfe9f0]">
      {/* Contact vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: damageFlash ? 1 : 0,
          boxShadow: 'inset 0 0 180px 40px rgba(255,40,40,0.55)',
        }}
      />
      {/* Low-life vignette — tightens as the session runs out. */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: `inset 0 0 ${120 + (1 - snap.health01) * 160}px ${20 + (1 - snap.health01) * 60}px rgba(0,0,0,${0.35 + (1 - snap.health01) * 0.45})`,
        }}
      />

      {/* Crosshair */}
      <div
        data-testid="crosshair"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ opacity: consoleOpen ? 0.15 : 0.9 }}
      >
        <div className="relative h-4 w-4">
          <span className="absolute left-1/2 top-0 h-1.5 w-px -translate-x-1/2 bg-white/80" />
          <span className="absolute left-1/2 bottom-0 h-1.5 w-px -translate-x-1/2 bg-white/80" />
          <span className="absolute top-1/2 left-0 w-1.5 h-px -translate-y-1/2 bg-white/80" />
          <span className="absolute top-1/2 right-0 w-1.5 h-px -translate-y-1/2 bg-white/80" />
        </div>
      </div>

      {/* TTL — the health bar IS the key's time to live. Labelled with both
          the physical name and the real Redis one (Vocabulary Ladder). */}
      <div data-testid="ttl-bar" className="absolute bottom-6 left-6 w-80">
        <div className="mb-1 flex items-baseline justify-between text-xs tracking-widest">
          <span className="text-white/70">SESSION LIFE</span>
          <span
            className="tabular-nums"
            style={{ color: ttlColor(snap.health01) }}
          >
            {seconds.toFixed(1)}s
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-sm border border-white/20 bg-black/60">
          <div
            className={critical ? 'h-full animate-pulse' : 'h-full'}
            style={{
              width: `${Math.max(0, Math.min(1, snap.health01)) * 100}%`,
              background: ttlColor(snap.health01),
              transition: 'width 120ms linear',
            }}
          />
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wider text-white/35">
          PTTL session:7742
        </div>
      </div>

      {/* Server vitals */}
      <div className="absolute bottom-6 right-6 w-56 text-[11px] tracking-wide">
        <Vital label="MEMORY" value={`${Math.round(snap.pressure * 100)}%`} bar={snap.pressure} danger={snap.pressure > 0.8} />
        <Vital label="LATENCY p99" value={`${snap.latency.toFixed(2)}ms`} bar={Math.min(1, snap.latency / 12)} danger={snap.latency > 8} />
      </div>

      {/* Objectives */}
      <div data-testid="objective-list" className="absolute top-6 right-6 w-72 text-[11px]">
        <div className="mb-2 tracking-[0.25em] text-white/50">OBJECTIVES</div>
        {objectives.map((o) => {
          const done = snap.objectives[o.id] === true
          return (
            <div key={o.id} className="mb-2 flex gap-2">
              <span className={done ? 'text-[#6effc0]' : 'text-white/30'}>{done ? '✓' : '○'}</span>
              <div>
                <div className={done ? 'text-[#6effc0] line-through opacity-70' : 'text-white/85'}>
                  {o.label}
                </div>
                {!done && o.hint && (
                  <div className="mt-0.5 text-[10px] leading-snug text-white/35">{o.hint}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Terminal interaction prompt */}
      {nearTerminal && !consoleOpen && (
        <div className="absolute left-1/2 top-[58%] w-[30rem] -translate-x-1/2 rounded border border-[#7dffd4]/40 bg-black/80 p-3 text-center">
          <div className="text-[10px] tracking-[0.3em] text-[#7dffd4]">{nearTerminal.label}</div>
          <div className="mt-1 text-xs text-white/80">{nearTerminal.prompt}</div>
          <div className="mt-2 text-[10px] text-white/45">
            Press <kbd className="rounded bg-white/15 px-1">E</kbd> to use the console
          </div>
        </div>
      )}

      {/* Last command receipt */}
      {lastResult && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center">
          <div className="text-[10px] tracking-widest text-white/40">{lastResult.line}</div>
          <div
            className="mt-0.5 text-sm"
            style={{ color: lastResult.ok ? '#6effc0' : '#ff6b6b' }}
          >
            {lastResult.text}
          </div>
        </div>
      )}

      {/* Controls reminder */}
      <div className="absolute top-6 left-6 text-[10px] leading-relaxed tracking-wider text-white/35">
        <div className="mb-1 tracking-[0.3em] text-white/55">NODE-7</div>
        <div>WASD move · SHIFT sprint · SPACE jump</div>
        <div>LMB fire · E / T console</div>
        {/* Only shown when pointer lock was refused — otherwise mouse-look
            is automatic and mentioning a fallback would just confuse. */}
        {entered && !pointerLocked && (
          <div className="mt-1 text-[#ffd166]/70">
            mouse look unavailable — hold RIGHT MOUSE and drag to look
          </div>
        )}
      </div>
    </div>
  )
}

function Vital({ label, value, bar, danger }) {
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex justify-between">
        <span className="text-white/45">{label}</span>
        <span className={danger ? 'text-[#ff6b6b]' : 'text-white/70'}>{value}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-sm bg-white/10">
        <div
          className="h-full"
          style={{
            width: `${Math.max(0, Math.min(1, bar)) * 100}%`,
            background: danger ? '#ff6b6b' : '#4fd8ff',
            transition: 'width 200ms linear',
          }}
        />
      </div>
    </div>
  )
}
