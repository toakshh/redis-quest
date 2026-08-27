import React from 'react'
import PressureMeter from './PressureMeter.jsx'
import SystemHealth from './SystemHealth.jsx'

export function calculateIncidentScore(incident) {
  if (!incident) return { score: 0, rank: 'C' }

  if (typeof incident.score === 'number') {
    const score = Math.max(0, Math.min(1000, Math.round(incident.score)))
    const rank = incident.rank || getRankFromScore(score)
    return { score, rank }
  }

  const objectives = incident.objectives || []
  const totalObjs = objectives.length || 1
  const completedObjs = objectives.filter(o => Boolean(o.completed || o.done || o.pass || o.status === 'passed')).length

  const objScore = (completedObjs / totalObjs) * 600
  const health = Math.max(0, Math.min(100, Number(incident.systemHealth ?? incident.health ?? 100)))
  const healthScore = (health / 100) * 250
  const pressure = Math.max(0, Math.min(100, Number(incident.pressure ?? 0)))
  const pressureScore = (1 - pressure / 100) * 150

  const score = Math.max(0, Math.min(1000, Math.round(objScore + healthScore + pressureScore)))
  const rank = incident.rank || getRankFromScore(score)

  return { score, rank }
}

export function getRankFromScore(score) {
  if (score >= 900) return 'S'
  if (score >= 750) return 'A'
  if (score >= 600) return 'B'
  return 'C'
}

export default function IncidentPanel({
  incident,
  activeIncident,
  onResolve,
  className = '',
}) {
  const currentIncident = incident || activeIncident

  if (!currentIncident) {
    return (
      <div className={`panel p-6 flex flex-col items-center justify-center text-center text-dim ${className}`}>
        <span className="text-3xl mb-2">⚡</span>
        <h3 className="text-sm font-bold text-fg tracking-widest uppercase">No Active Incident</h3>
        <p className="text-xs text-dim mt-1">System running in nominal standby mode.</p>
      </div>
    )
  }

  const isResolved = Boolean(
    currentIncident.resolved ||
    currentIncident.isResolved ||
    currentIncident.completed ||
    currentIncident.status === 'resolved' ||
    currentIncident.status === 'completed'
  )

  const title = currentIncident.title || currentIncident.name || 'ACTIVE INCIDENT'
  const description = currentIncident.description || 'System anomaly detected. Resolve objectives to stabilize database.'
  const objectives = currentIncident.objectives || []
  const pressure = Math.max(0, Math.min(100, Number(currentIncident.pressure ?? 0)))
  const systemHealth = Math.max(0, Math.min(100, Number(currentIncident.systemHealth ?? currentIncident.health ?? 100)))

  const { score, rank } = calculateIncidentScore(currentIncident)

  const rankColors = {
    S: 'text-amber-300 border-amber-400 bg-amber-950/60 shadow-[0_0_20px_rgba(251,191,36,0.6)]',
    A: 'text-purple-300 border-purple-400 bg-purple-950/60 shadow-[0_0_15px_rgba(167,139,250,0.5)]',
    B: 'text-cyan-300 border-cyan-400 bg-cyan-950/60 shadow-[0_0_12px_rgba(34,211,238,0.4)]',
    C: 'text-slate-300 border-slate-500 bg-slate-900/60',
  }

  return (
    <div className={`panel p-4 flex flex-col gap-4 bg-panel border border-edge rounded-lg ${className}`}>
      {/* HUD Header */}
      <div className="flex items-start justify-between border-b border-edge pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${isResolved ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40 animate-pulse'}`}>
              {isResolved ? 'RESOLVED' : 'INCIDENT ACTIVE'}
            </span>
            <span className="text-[10px] font-mono text-dim tracking-widest">
              ID: {currentIncident.id || 'INC-001'}
            </span>
          </div>
          <h2 className="text-base font-bold text-fg tracking-wide uppercase flex items-center gap-2">
            <span>⚠️</span>
            {title}
          </h2>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-fg/80 leading-relaxed bg-panel2/60 p-2.5 rounded border border-edge/60">
        {description}
      </p>

      {/* Gauges Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-panel2/40 p-3 rounded border border-edge">
        <PressureMeter pressure={pressure} />
        <SystemHealth health={systemHealth} />
      </div>

      {/* Objectives List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-dim tracking-wider uppercase flex items-center gap-1.5">
            <span>🎯</span> Objectives
          </h3>
          <span className="text-[10px] font-mono text-dim">
            {objectives.filter(o => Boolean(o.completed || o.done || o.pass || o.status === 'passed')).length} / {objectives.length} DONE
          </span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {objectives.length === 0 ? (
            <div className="text-xs text-dim italic p-2 bg-panel2/30 rounded border border-edge/40">
              No objectives listed for this incident.
            </div>
          ) : (
            objectives.map((obj, idx) => {
              const isCompleted = Boolean(obj.completed || obj.done || obj.pass || obj.status === 'passed')
              const objName = obj.name || obj.title || obj.description || `Objective #${idx + 1}`

              return (
                <div
                  key={obj.id || idx}
                  className={`flex items-center justify-between p-2 rounded text-xs border transition-all ${
                    isCompleted
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-panel2/60 border-edge text-fg/90'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-label={isCompleted ? 'objective completed' : 'objective pending'}
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {isCompleted ? '✓' : '✕'}
                    </span>
                    <span className={isCompleted ? 'line-through text-emerald-300/80 font-mono' : 'font-mono'}>
                      {objName}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                      isCompleted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {isCompleted ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Incident Completion Score Summary Card (Shown on Resolution) */}
      {isResolved && (
        <div className="mt-2 p-4 rounded-lg bg-slate-950 border-2 border-emerald-500/60 shadow-[0_0_25px_rgba(52,211,153,0.25)] flex flex-col gap-3 animate-slideUp">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <div>
                <h3 className="text-xs font-bold text-emerald-400 tracking-widest uppercase">
                  INCIDENT RESOLVED SUMMARY
                </h3>
                <p className="text-[9px] text-dim font-mono">Performance Assessment Card</p>
              </div>
            </div>
            <div className={`px-3 py-1 text-base font-black font-mono rounded border ${rankColors[rank] || rankColors.C}`}>
              RANK {rank}
            </div>
          </div>

          <div className="flex items-center justify-between bg-panel2/80 p-3 rounded border border-edge">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-mono text-dim">FINAL SCORE</span>
              <span className="text-2xl font-black font-mono text-cyan tracking-wider">
                {score} <span className="text-xs font-normal text-dim">/ 1000 PTS</span>
              </span>
            </div>
            <div className="flex gap-4 text-right font-mono text-xs">
              <div>
                <div className="text-[9px] text-dim uppercase">HEALTH</div>
                <div className="font-bold text-emerald-400">{systemHealth}%</div>
              </div>
              <div>
                <div className="text-[9px] text-dim uppercase">PRESSURE</div>
                <div className="font-bold text-amber-400">{pressure}%</div>
              </div>
            </div>
          </div>

          {onResolve && (
            <button
              type="button"
              onClick={() => onResolve(currentIncident, { score, rank })}
              className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-bold text-xs rounded transition-colors uppercase tracking-wider"
            >
              Acknowledge Incident Report
            </button>
          )}
        </div>
      )}
    </div>
  )
}
