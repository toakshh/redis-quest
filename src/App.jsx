import { useEffect, useState } from 'react'
import { createEngine } from './engine/engine.js'
import { useGameStore } from './store/gameStore.js'
import Header from './components/Header.jsx'
import Terminal from './components/Terminal.jsx'
import MemoryInspector from './components/MemoryInspector.jsx'
import BossBattle from './components/BossBattle.jsx'
import Achievements from './components/Achievements.jsx'
import SkillTreePanel from './components/SkillTreePanel.jsx'
import AchievementGallery from './components/AchievementGallery.jsx'
import CosmeticLocker from './components/CosmeticLocker.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import RexPanel from './components/RexPanel.jsx'
import JuiceOverlay from './components/JuiceOverlay.jsx'
import GameCanvas from './components/GameCanvas.jsx'

// One shared engine for the whole app: the terminal executes through it, the
// store inspects it for challenge/achievement validation, and the header +
// memory inspector subscribe to its mutation events.
const engine = createEngine()

const SIDE_TABS = [
  { id: 'memory', label: 'MEM', hint: 'inspector' },
  { id: 'world', label: 'WORLD', hint: '2D Map' },
  { id: 'boss', label: 'BOSS', hint: 'battle' },
  { id: 'awards', label: 'AWARDS', hint: 'achievements' },
  { id: 'skills', label: 'SKILLS', hint: 'tree' },
  { id: 'cosmetics', label: 'LOOK', hint: 'cosmetics' },
  { id: 'settings', label: 'CONF', hint: 'config' },
]

const REX_TABS = [
  { id: 'rex', label: 'REX', hint: 'companion' },
]

export default function App() {
  const [tab, setTab] = useState('memory')
  const [rexTab, setRexTab] = useState(false)

  // Bind the singleton engine to the game store once (idempotent in the store).
  useEffect(() => {
    useGameStore.getState().bindEngine(engine)
  }, [])

  // Canonical command path: the store executes the line, updates game state
  // (achievements, boss challenges, XP), and returns the reply for the terminal.
  const runCommand = (line) => useGameStore.getState().runCommand(line)

  return (
    <div className="flex h-full flex-col relative">
      <Header engine={engine} />

      <div className="flex min-h-0 flex-1">
        {/* side panel: tabbed MEM / BOSS / AWARDS / SKILLS / COSMETICS / SETTINGS */}
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
            {tab === 'world' ? (
              <GameCanvas engine={engine} />
            ) : (
                <div className="flex h-full flex-col">
                    {tab === 'memory' && <MemoryInspector engine={engine} className="flex-1 border-x-0" />}
                    {tab === 'boss' && <BossBattle className="flex-1" />}
                    {tab === 'awards' && <AchievementGallery className="flex-1" />}
                    {tab === 'skills' && <SkillTreePanel className="flex-1" />}
                    {tab === 'cosmetics' && <CosmeticLocker className="flex-1" />}
                    {tab === 'settings' && <SettingsPanel className="flex-1" />}
                </div>
            )}
          </div>
        </aside>

        {/* terminal */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
          <Terminal engine={engine} onSubmit={runCommand} />
        </main>

        {/* REX companion sidebar - right side */}
        <aside className={`flex min-h-0 shrink-0 transition-all duration-300 border-l border-edge ${
          rexTab ? 'w-[300px] xl:w-[340px]' : 'w-0 overflow-hidden'
        }`}>
          {rexTab && (
            <div className="flex flex-col h-full">
              <nav
                className="grid shrink-0 grid-cols-1 border-b border-edge"
                aria-label="REX panel"
              >
                <button
                  type="button"
                  aria-pressed={true}
                  className="flex items-center justify-center gap-2 border-b-2 border-transparent px-2 py-2 transition-colors text-cyan hover:bg-panel"
                >
                  <span className="text-sm font-bold leading-none tracking-[0.2em]">REX</span>
                  <span className="text-[8px] tracking-[0.15em] uppercase opacity-70">COMPANION</span>
                </button>
              </nav>
              <div className="min-h-0 flex-1">
                <RexPanel className="h-full" />
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* REX toggle button - fixed bottom right */}
      <button
        type="button"
        onClick={() => setRexTab(!rexTab)}
        aria-expanded={rexTab}
        aria-label={rexTab ? 'Hide REX companion' : 'Show REX companion'}
        className={`fixed bottom-4 right-4 z-30 w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl transition-all duration-300 ${
          rexTab
            ? 'border-cyan bg-cyan/20 text-cyan shadow-[0_0_16px_rgba(34,211,238,0.4)]'
            : 'border-edge bg-panel/80 text-dim hover:border-cyan/50 hover:text-cyan'
        }`}
        style={{ boxShadow: rexTab ? '0 0 20px rgba(34, 211, 238, 0.3)' : 'none' }}
      >
        🤖
      </button>

      {/* Juice overlay for particles, screen shake, flash, color grading */}
      <JuiceOverlay />
    </div>
  )
}