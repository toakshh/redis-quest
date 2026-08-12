import { useGameStore, ACHIEVEMENTS } from '../store/gameStore.js'
import { RARITY_COLORS, RARITY_LABELS, CATEGORY_LABELS, CATEGORY_ICONS } from '../data/achievements.js'

export default function Achievements({ className = '' }) {
  const unlocked = useGameStore((s) => s.unlocked)
  const toasts = useGameStore((s) => s.toasts)
  const dismissToast = useGameStore((s) => s.dismissToast)

  const total = ACHIEVEMENTS.length
  const count = ACHIEVEMENTS.filter((a) => unlocked ? (Array.isArray(unlocked) ? unlocked.includes(a.id) : Boolean(unlocked[a.id])) : false).length
  const pct = total > 0 ? (count / total) * 100 : 0

  return (
    <>
      <div className={`panel flex min-h-0 flex-col ${className}`}>
        {/* header */}
        <div className="border-b border-edge px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="glow-text text-sm font-bold tracking-widest text-purple">
              ACHIEVEMENTS
            </span>
            <span className="text-[10px] tabular-nums text-dim">
              {count}/{total}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel2">
            <div
              className="h-full rounded-full bg-purple shadow-[0_0_12px_rgba(167,139,250,0.35)] transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* badge grid */}
        <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3 sm:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlocked ? (Array.isArray(unlocked) ? unlocked.includes(a.id) : Boolean(unlocked[a.id])) : false
            return (
              <div
                key={a.id}
                title={`${a.desc}${isUnlocked ? '' : ` · +${a.xp} XP`}`}
                className={`flex flex-col items-center gap-1 rounded border px-2 py-2 text-center transition-colors ${
                  isUnlocked
                    ? 'border-purple/50 bg-purple/10 hover:border-purple hover:bg-purple/15'
                    : 'border-edge bg-panel/60 opacity-60 hover:opacity-80'
                }`}
              >
                <span
                  className={`text-lg leading-none ${
                    isUnlocked ? 'text-purple' : 'text-dim'
                  }`}
                >
                  {isUnlocked ? a.icon : '?'}
                </span>
                <span
                  className={`text-[10px] font-bold tracking-wide ${
                    isUnlocked ? 'text-fg' : 'text-dim'
                  }`}
                >
                  {a.name}
                </span>
                <span className="hidden text-[9px] leading-tight text-dim md:block">
                  {a.desc}
                </span>
                {isUnlocked && (
                  <span className="rounded border border-purple/40 px-1 py-px text-[8px] tracking-widest text-purple">
                    UNLOCKED
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* unlock toasts — fixed overlay so they float above the whole app */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={`${t.id}-${t.unlockedAt}`}
            className="animate-toastIn pointer-events-auto flex items-center gap-3 rounded border border-purple/60 bg-panel2 px-4 py-3 shadow-[0_0_18px_rgba(167,139,250,0.35)]"
            role="status"
          >
            <span className="text-2xl leading-none">{t.icon}</span>
            <div className="min-w-0">
              <div className="text-[9px] tracking-[0.25em] text-purple">
                ACHIEVEMENT UNLOCKED
              </div>
              <div className="truncate text-sm font-bold text-fg">{t.name}</div>
              <div className="text-[10px] text-dim">
                {t.desc} <span className="text-amber">+{t.xp} XP</span>
              </div>
            </div>
            <button
              type="button"
              aria-label={`Dismiss ${t.name} notification`}
              className="ml-1 shrink-0 rounded border border-edge px-1.5 py-0.5 text-[10px] text-dim transition-colors hover:border-purple hover:text-purple"
              onClick={() => dismissToast(t.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
