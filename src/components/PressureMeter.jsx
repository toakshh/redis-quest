import React from 'react'

export default function PressureMeter({
  pressure = 0,
  label = 'INCIDENT PRESSURE',
  showValue = true,
  className = '',
}) {
  const clamped = Math.max(0, Math.min(100, Number(pressure) || 0))

  // Determine warning color tier
  let colorClass = 'bg-cyan border-cyan/50 shadow-[0_0_10px_rgba(34,211,238,0.5)]'
  let textColorClass = 'text-cyan'
  let warningBadge = 'LOW'

  if (clamped > 70) {
    colorClass = 'bg-red-500 border-red-400 shadow-[0_0_12px_rgba(251,113,133,0.8)] animate-pulse'
    textColorClass = 'text-red-400'
    warningBadge = 'CRITICAL'
  } else if (clamped > 40) {
    colorClass = 'bg-amber-400 border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
    textColorClass = 'text-amber-400'
    warningBadge = 'ELEVATED'
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="flex items-center gap-1.5 font-bold tracking-wider text-fg uppercase">
          <span className="text-amber-400 animate-pulse">⚠️</span>
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border border-edge bg-panel2 ${textColorClass}`}>
            {warningBadge}
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
        {/* Background Ticks for Cyberpunk Aesthetic */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_24%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_26%,transparent_27%)] bg-[length:20px_100%] pointer-events-none z-10" />

        {/* Animated Bar Fill */}
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out border ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
