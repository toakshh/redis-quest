import { useEffect, useState } from 'react'
import { createEngine } from './engine/engine.js'
import { useGameStore } from './store/gameStore.js'
import Header from './components/Header.jsx'
import Terminal from './components/Terminal.jsx'
import MemoryInspector from './components/MemoryInspector.jsx'
import BossBattle from './components/BossBattle.jsx'
import SkillTreePanel from './components/SkillTreePanel.jsx'
import AchievementGallery from './components/AchievementGallery.jsx'
import CosmeticLocker from './components/CosmeticLocker.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import RexPanel from './components/RexPanel.jsx'
import JuiceOverlay from './components/JuiceOverlay.jsx'
import GameCanvas from './components/GameCanvas.jsx'
import OnboardingModal, { hasCompletedOnboarding } from './components/OnboardingModal.jsx'
import UITourModal from './components/UITourModal.jsx'

// One shared engine for the whole app: the terminal executes through it, the
// store inspects it for challenge/achievement validation, and the header +
// memory inspector subscribe to its mutation events.
const engine = createEngine()

const SIDE_TABS = [
  { id: 'world', label: 'WORLD', hint: '2D Map' },
  { id: 'memory', label: 'MEM', hint: 'inspector' },
  { id: 'boss', label: 'BOSS', hint: 'battle' },
  { id: 'awards', label: 'AWARDS', hint: 'achievements' },
  { id: 'skills', label: 'SKILLS', hint: 'tree' },
  { id: 'cosmetics', label: 'LOOK', hint: 'cosmetics' },
  { id: 'settings', label: 'CONF', hint: 'config' },
]

export default function App() {
  const [tab, setTab] = useState('world')
  const [rexTab, setRexTab] = useState(false)
  const [terminalDrawerOpen, setTerminalDrawerOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [isTourOpen, setIsTourOpen] = useState(false)

  // Bind the singleton engine to the game store once (idempotent in the store).
  useEffect(() => {
    useGameStore.getState().bindEngine(engine)
    if (!hasCompletedOnboarding()) {
      setIsOnboardingOpen(true)
    }
  }, [])

  // Keyboard shortcut listener for ~ key to toggle terminal drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '`' || e.key === '~') {
        const activeEl = document.activeElement
        const isInput = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)
        // If user is inside an input/textarea but presses tilde, or if anywhere else
        if (!isInput || activeEl?.classList.contains('terminal-input')) {
          e.preventDefault()
          setTerminalDrawerOpen((prev) => !prev)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Canonical command path: the store executes the line, updates game state
  // (achievements, boss challenges, XP), and returns the reply for the terminal.
  const runCommand = (line) => useGameStore.getState().runCommand(line)

  return (
    <div className="flex h-full flex-col relative bg-bg text-fg overflow-hidden">
      {!isFullscreen && (
        <Header
          engine={engine}
          onOpenTutorial={() => setIsOnboardingOpen(true)}
          onOpenTour={() => setIsTourOpen(true)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      )}

      <div className="flex min-h-0 flex-1 relative overflow-hidden">
        {/* left side panel: tabbed WORLD / MEM / BOSS / AWARDS / SKILLS / COSMETICS / SETTINGS */}
        {!isFullscreen && (
          <aside className="flex w-[300px] min-h-0 shrink-0 flex-col border-r border-edge xl:w-[340px] bg-panel/30">
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
              <div className="flex h-full flex-col">
                {tab === 'world' && (
                  <div className="p-4 text-xs text-dim space-y-2">
                    <p className="font-bold text-cyan">WORLD VIEW ACTIVE</p>
                    <p>The 2D Isometric RPG Canvas is currently active in the primary center view.</p>
                    <p>Select another tab to inspect memory, battle bosses, manage skills, or configure settings.</p>
                  </div>
                )}
                {tab === 'memory' && <MemoryInspector engine={engine} className="flex-1 border-x-0" />}
                {tab === 'boss' && <BossBattle className="flex-1" />}
                {tab === 'awards' && <AchievementGallery className="flex-1" />}
                {tab === 'skills' && <SkillTreePanel className="flex-1" />}
                {tab === 'cosmetics' && <CosmeticLocker className="flex-1" />}
                {tab === 'settings' && <SettingsPanel className="flex-1" />}
              </div>
            </div>
          </aside>
        )}

        {/* Center Primary Center View: GameCanvas (or active side tab content if not world, but GameCanvas is primary) */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col relative bg-slate-950">
          <GameCanvas
            engine={engine}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            isTerminalDrawerOpen={terminalDrawerOpen}
            onToggleTerminalDrawer={() => setTerminalDrawerOpen(!terminalDrawerOpen)}
          />
        </main>

        {/* Expandable Terminal Side Drawer (Right Side) */}
        <aside className={`flex min-h-0 shrink-0 transition-all duration-300 border-l border-edge bg-panel/95 z-20 ${
          terminalDrawerOpen ? 'w-[360px] xl:w-[420px]' : 'w-0 overflow-hidden'
        }`}>
          {terminalDrawerOpen && (
            <div className="flex flex-col h-full w-full">
              <Terminal
                engine={engine}
                onSubmit={runCommand}
                onCloseDrawer={() => setTerminalDrawerOpen(false)}
              />
            </div>
          )}
        </aside>

        {/* REX companion sidebar - right side */}
        {!isFullscreen && (
          <aside className={`flex min-h-0 shrink-0 transition-all duration-300 border-l border-edge bg-panel/90 z-20 ${
            rexTab ? 'w-[300px] xl:w-[340px]' : 'w-0 overflow-hidden'
          }`}>
            {rexTab && (
              <div className="flex flex-col h-full w-full">
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
        )}
      </div>

      {/* Floating Action Buttons Bottom Right */}
      {!isFullscreen && (
        <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2">
          {/* Terminal Drawer Toggle Button */}
          <button
            type="button"
            onClick={() => setTerminalDrawerOpen(!terminalDrawerOpen)}
            aria-expanded={terminalDrawerOpen}
            aria-label={terminalDrawerOpen ? 'Hide Terminal Drawer' : 'Show Terminal Drawer'}
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl transition-all duration-300 ${
              terminalDrawerOpen
                ? 'border-amber bg-amber/20 text-amber shadow-[0_0_16px_rgba(251,191,36,0.4)]'
                : 'border-edge bg-panel/80 text-dim hover:border-amber/50 hover:text-amber'
            }`}
          >
            ⌨️
          </button>

          {/* REX toggle button */}
          <button
            type="button"
            onClick={() => setRexTab(!rexTab)}
            aria-expanded={rexTab}
            aria-label={rexTab ? 'Hide REX companion' : 'Show REX companion'}
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl transition-all duration-300 ${
              rexTab
                ? 'border-cyan bg-cyan/20 text-cyan shadow-[0_0_16px_rgba(34,211,238,0.4)]'
                : 'border-edge bg-panel/80 text-dim hover:border-cyan/50 hover:text-cyan'
            }`}
          >
            🤖
          </button>
        </div>
      )}

      {/* Fullscreen Exit Button Overlay when in Fullscreen */}
      {isFullscreen && (
        <button
          type="button"
          onClick={() => setIsFullscreen(false)}
          className="fixed top-4 right-4 z-50 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 border border-amber-500/60 rounded-lg text-amber-300 font-bold text-xs shadow-lg backdrop-blur"
        >
          ✕ EXIT FULLSCREEN (ESC)
        </button>
      )}

      {/* Juice overlay for particles, screen shake, flash, color grading */}
      <JuiceOverlay />

      {/* Onboarding & Tutorial Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      {/* Interactive Step-by-Step UI Tour Modal */}
      <UITourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  )
}
