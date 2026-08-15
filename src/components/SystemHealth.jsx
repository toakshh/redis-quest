import React from 'react'

export default function SystemHealth({
  health = 100,
  label = 'SYSTEM HEALTH',
  showValue = true,
  className = '',
}) {
  const clamped = Math.max(0, Math.min(100, Number(health) ?? 100))

  let colorClass = 'bg-emerald-400 border-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.6)]'
  let textColorClass = 'text-emerald-400'
  let statusText = 'NOMINAL'

  if (clamped < 30) {
    colorClass = 'bg-red-500 border-red-400 shadow-[0_0_12px_rgba(251,113,133,0.8)] animate-pulse'
    textColorClass = 'text-red-400'
    statusText = 'CRITICAL'
  } else if (clamped < 70) {
    colorClass = 'bg-amber-400 border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
    textColorClass = 'text-amber-400'
    statusText = 'DEGRADED'
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="flex items-center gap-1.5 font-bold tracking-wider text-fg uppercase">
          <span className="text-emerald-400">🛡️</span>
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border border-edge bg-panel2 ${textColorClass}`}>
            {statusText}
          </span>
          {showValue && (
            <span className={`font-bold font-mono ${textColorClass}`}>
              {clamped}%
            </span>
          )}
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="w-full h-3 bg-panel2 border border-edge rounded-full overflow-hidden relative p-0.5"
      >
        {/* Cyber Grid Lines Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_19%,rgba(255,255,255,0.05)_20%,rgba(255,255,255,0.05)_21%,transparent_22%)] bg-[length:15px_100%] pointer-events-none z-10" />

        {/* Health Bar Fill */}
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out border ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
