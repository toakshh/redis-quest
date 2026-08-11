import { useEffect, useState } from 'react'
import { createEngine } from './engine/engine.js'
import { useGameStore } from './store/gameStore.js'
import Header from './components/Header.jsx'
import Terminal from './components/Terminal.jsx'
import MemoryInspector from './components/MemoryInspector.jsx'
import BossBattle from './components/BossBattle.jsx'
import Achievements from './components/Achievements.jsx'

// One shared engine for the whole app: the terminal executes through it, the
// store inspects it for challenge/achievement validation, and the header +
// memory inspector subscribe to its mutation events.
const engine = createEngine()

const SIDE_TABS = [
  { id: 'memory', label: 'MEM', hint: 'inspector' },
  { id: 'boss', label: 'BOSS', hint: 'battle' },
  { id: 'awards', label: 'AWARDS', hint: 'achievements' },
]

export default function App() {
  const [tab, setTab] = useState('memory')

  // Bind the singleton engine to the game store once (idempotent in the store).
  useEffect(() => {
    useGameStore.getState().bindEngine(engine)
  }, [])

  // Canonical command path: the store executes the line, updates game state
  // (achievements, boss challenges, XP), and returns the reply for the terminal.
  const runCommand = (line) => useGameStore.getState().runCommand(line)

  return (
    <div className="flex h-full flex-col">
      <Header engine={engine} />

      <div className="flex min-h-0 flex-1">
        {/* side panel: tabbed MEM / BOSS / AWARDS */}
        <aside className="flex w-[300px] min-h-0 shrink-0 flex-col border-r border-edge xl:w-[340px]">
          <nav
            className="grid shrink-0 grid-cols-3 border-b border-edge"
            aria-label="Side panels"
          >
            {SIDE_TABS.map(({ id, label, hint }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-0.5 border-b-2 px-2 py-2 transition-colors ${
                    active
                      ? 'border-cyan bg-cyan/5 text-cyan'
                      : 'border-transparent text-dim hover:bg-panel hover:text-fg'
                  }`}
                >
                  <span className="text-sm font-bold leading-none tracking-[0.2em]">
                    {label}
                  </span>
                  <span className="text-[8px] tracking-[0.15em] uppercase opacity-70">
                    {hint}
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="min-h-0 flex-1">
            {tab === 'memory' && <MemoryInspector engine={engine} className="h-full border-x-0" />}
            {tab === 'boss' && <BossBattle className="h-full" />}
            {tab === 'awards' && <Achievements className="h-full" />}
          </div>
        </aside>

        {/* terminal */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
          <Terminal engine={engine} onSubmit={runCommand} />
        </main>
      </div>
    </div>
  )
}
