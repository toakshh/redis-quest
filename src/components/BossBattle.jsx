import { useGameStore, levelInfo } from '../store/gameStore.js'
import { soundEngine } from '../audio/SoundEngine.js'
import { useEffect } from 'react'

// ASCII portrait for the sentinel. Drawn with String.raw so backslashes render
// literally; only safe terminal glyphs are used.
const SERPENT_ASCII = String.raw`
   .---..---.
  /     \/     /
 |  [O]    [O]  |
  \     /\     /
   \_  /  \  _/
     /______/
    |        |
    |  ====  |
     \______/
`

function healthTone(pct) {
  if (pct > 60) return { bar: 'bg-green shadow-glow-green', text: 'text-green' }
  if (pct > 30) return { bar: 'bg-amber', text: 'text-amber' }
  return { bar: 'bg-red shadow-glow-red', text: 'glow-text-red text-red' }
}

export default function BossBattle({ className = '' }) {
  const boss = useGameStore((s) => s.boss)
  const xp = useGameStore((s) => s.xp)
  const startBattle = useGameStore((s) => s.startBattle)

  useEffect(() => {
    if (boss?.defeated) {
      soundEngine.playSFX('victory')
    }
  }, [boss?.defeated])

  const { level, xpIntoLevel, xpForNext } = levelInfo(xp)

  // ------------------------------------------------------------------ engage
  if (!boss) {
    return (
      <div className={`panel flex min-h-0 flex-col ${className}`}>
        <div className="border-b border-edge px-4 py-2">
          <span className="glow-text text-sm font-bold tracking-widest text-red">BOSS BATTLE</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-5 text-center">
          <pre className="animate-flicker select-none text-[10px] leading-tight text-red glow-text-red">
            {SERPENT_ASCII}
          </pre>
          <h2 className="glow-text-red text-lg font-bold tracking-[0.35em] text-red">
            NEON SERPENT
          </h2>
          <p className="text-[11px] leading-relaxed text-dim">
            A corrupted redis instance guards the data vault. Break its shield by
            completing Redis command challenges — each solved objective deals
            damage and earns XP.
          </p>
          <button
            type="button"
            className="btn-primary mt-1"
            onClick={() => startBattle()}
          >
            DEPLOY BATTLE
          </button>
        </div>
      </div>
    )
  }

  const pct = (boss.health / boss.maxHealth) * 100
  const tone = healthTone(pct)
  const challenge = boss.challenges[boss.challengeIndex]
  const wave = Math.min(boss.challengeIndex + 1, boss.challenges.length)
  const result = boss.lastResult

  // ----------------------------------------------------------------- victory
  if (boss.defeated) {
    return (
      <div className={`panel flex min-h-0 flex-col ${className}`}>
        <div className="border-b border-edge px-4 py-2">
          <span className="glow-text text-sm font-bold tracking-widest text-green">BOSS BATTLE</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-5 text-center">
          <pre className="select-none text-[10px] leading-tight text-green glow-text-green">
            {SERPENT_ASCII}
          </pre>
          <h2 className="glow-text-green text-lg font-bold tracking-[0.35em] text-green animate-pulse">
            DATA SECURED
          </h2>
          <div className="text-[30px] animate-bounce">🎊</div>
          <p className="text-[11px] text-dim">
            {boss.name} is dismantled. The vault yields{' '}
            <span className="text-green">+{result.xp} XP</span>.
          </p>
          <button
            type="button"
            className="btn-primary mt-1"
            onClick={() => startBattle()}
          >
            REBATTLE
          </button>
          <button
            type="button"
            className="btn-secondary mt-1"
            onClick={() => console.log("Next region!")}
          >
            NEXT REGION
          </button>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------ active fight
  return (
    <div className={`panel flex min-h-0 flex-col ${className}`}>
      <div className="flex items-center justify-between border-b border-edge px-4 py-2">
        <span className="glow-text text-sm font-bold tracking-widest text-red">BOSS BATTLE</span>
        <span className="text-[10px] tracking-widest text-dim">
          OBJECTIVE {wave}/{boss.challenges.length}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* boss portrait + health */}
        <div className="flex items-stretch gap-4">
          <pre className="select-none self-center text-[10px] leading-tight text-red glow-text-red">
            {SERPENT_ASCII}
          </pre>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className={`truncate text-sm font-bold tracking-widest ${tone.text}`}>
                {boss.name}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-dim">
                {boss.health}<span className="text-dim/60">/{boss.maxHealth}</span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-sm border border-edge bg-panel2">
              <div
                className={`h-full rounded-sm transition-[width] duration-300 ${tone.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="truncate text-[9px] tracking-[0.25em] text-dim">{boss.title}</p>

            {/* shield = remaining objectives */}
            <div className="flex gap-1 pt-1" aria-label="shield segments">
              {boss.challenges.map((c, i) => (
                <span
                  key={c.key}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < boss.challengeIndex
                      ? 'bg-red/70 shadow-glow-red'
                      : 'border border-edge bg-panel2'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* objective card */}
        <div className="panel-2 relative p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] tracking-widest text-dim">CURRENT OBJECTIVE</span>
            <span className="text-[10px] text-dim">hit −{challenge.damage} HP · +{challenge.xp} XP</span>
          </div>
          <p className="text-[12px] leading-relaxed text-cyan glow-text">
            ▸ {challenge.task}
          </p>
          <p className="mt-2 border-t border-edge/60 pt-2 text-[10px] text-dim">
            hint <span className="text-green">{challenge.hint}</span>
          </p>
        </div>

        {/* last result feedback */}
        {result && (
          <div
            key={result.at}
            className={`animate-toastIn rounded border px-3 py-2 text-[11px] ${
              result.ok
                ? 'border-green/40 bg-green/10 text-green glow-text-green'
                : 'border-red/40 bg-red/10 text-red'
            }`}
          >
            {result.message}
            {!result.ok && result.hint && (
              <span className="block text-dim"> try: {result.hint}</span>
            )}
          </div>
        )}

        {/* player XP bar */}
        <div className="mt-auto">
          <div className="flex items-center justify-between text-[10px] text-dim">
            <span>
              XP {xp} · LVL {level}
            </span>
            <span className="tabular-nums">
              {xpIntoLevel}/{xpForNext}
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-panel2">
            <div
              className="h-full rounded-full bg-cyan shadow-glow"
              style={{ width: `${(xpIntoLevel / xpForNext) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
