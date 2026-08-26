import { useEffect, useState, lazy, Suspense } from 'react'
import { createEngine } from './engine/engine.js'
import { useGameStore } from './store/gameStore.js'
import ModeLauncher from './components/ModeLauncher.jsx'
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
import InventoryModal from './components/InventoryModal.jsx'
import OnboardingModal, { hasCompletedOnboarding } from './components/OnboardingModal.jsx'
import UITourModal from './components/UITourModal.jsx'
import WelcomeOverlay from './components/WelcomeOverlay.jsx'
import { soundEngine } from './audio/SoundEngine.js'

// Lazy: the 3D mode's bundle (three.js and everything under game3d/) never
// reaches a player who stays in the 2D game. See ModeLauncher.jsx and the
// bundle-split guard test in src/game3d/__tests__/bundleSplit.test.js.
const Game3DRoot = lazy(() => import('./game3d/index.js'))

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

function getTabIcon(id) {
  switch (id) {
    case 'world': return '🗺️'
    case 'memory': return '🔍'
    case 'boss': return '⚔️'
    case 'awards': return '🏆'
    case 'skills': return '🌳'
    case 'cosmetics': return '🎨'
    case 'settings': return '⚙️'
    default: return '📄'
  }
}

export default function App() {
  const [tab, setTab] = useState('world')
  const [rexTab, setRexTab] = useState(false)
  const [terminalDrawerOpen, setTerminalDrawerOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [isTourOpen, setIsTourOpen] = useState(false)
  const [isInventoryOpen, setIsInventoryOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [appMode, setAppMode] = useState(null)

  // Bind the singleton engine to the game store once (idempotent in the store).
  useEffect(() => {
    useGameStore.getState().bindEngine(engine)

    // Subscribe to engine commands to trigger sounds
    const unsubscribe = engine.on('command', ({ name, args, reply }) => {
        if (reply && reply.type === 'error') {
            soundEngine.playSFX('defeat')
        } else {
            // Mapping commands to sound effects
            if (['SET', 'HSET', 'LPUSH', 'SADD'].includes(name)) {
                soundEngine.playSFX('gem')
            } else if (name === 'EXEC') {
                soundEngine.playSFX('victory')
            } else if (name === 'DEL') {
                soundEngine.playSFX('shuffle')
            }
        }
    })

    if (!hasCompletedOnboarding()) {
      setIsOnboardingOpen(true)
    }
    
    return () => {
        unsubscribe()
    }
  }, [])

  // Keyboard shortcut listener for ~ key to toggle terminal drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'i' || e.key === 'I') {
        const activeEl = document.activeElement
        const isInput = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)
        if (!isInput) {
          setIsInventoryOpen((prev) => !prev)
        }
      }
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

  if (appMode === null) return <ModeLauncher onSelect={setAppMode} />
  if (appMode === '3d') return (
    <Suspense fallback={<div className="flex h-full items-center justify-center bg-black text-cyan font-mono">LOADING NODE-7…</div>}>
      <Game3DRoot onExit={() => setAppMode(null)} />
    </Suspense>
  )

  return (
    <div className="flex h-full flex-col relative bg-bg text-fg overflow-hidden">
      {showWelcome && (
        <WelcomeOverlay onStart={() => setShowWelcome(false)} />
      )}
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
          <aside className="flex w-[180px] min-w-[150px] max-w-[240px] min-h-0 shrink flex-col border-r border-edge xl:w-[240px] bg-panel/30 overflow-y-auto">
            <nav
              className="flex flex-col shrink-0 border-b border-edge bg-panel/60"
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
                    className={`flex items-center justify-between px-2.5 py-2 border-b border-edge/50 transition-colors whitespace-nowrap overflow-hidden ${
                      active
                        ? 'bg-cyan/10 text-cyan font-bold border-l-2 border-l-cyan'
                        : 'text-slate-400 hover:bg-panel2 hover:text-slate-200 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      <span className="text-base shrink-0">{getTabIcon(id)}</span>
                      <span className="text-xs tracking-[0.1em] truncate font-mono">{label}</span>
                    </div>
                  </button>
                )
              })}
            </nav>

            <div className="min-h-0 flex-1">
              <div className="flex h-full flex-col">
                {tab === 'world' && (
                  <div className="p-3 text-xs space-y-3 overflow-y-auto max-h-full">
                    <div className="border-b border-edge pb-1.5 flex justify-between items-center">
                      <span className="font-bold text-cyan text-xs tracking-wider">🗺️ REGION SELECTOR</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan/10 text-cyan border border-cyan/30">5 REGIONS</span>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 rounded bg-slate-900 border border-cyan/40 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-cyan text-xs">1. Memory Village</span>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/40">ACTIVE</span>
                        </div>
                        <p className="text-[10px] text-slate-300">Ground zero for string commands and basic memory gates.</p>
                      </div>

                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1 opacity-90 hover:border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber text-xs">2. Key-Value Kingdom</span>
                          <span className="text-[9px] text-dim">LOCK: LVL 2</span>
                        </div>
                        <p className="text-[10px] text-slate-300">Hash maps, field operations, and structural key isolation.</p>
                      </div>

                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1 opacity-90 hover:border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-emerald-400 text-xs">3. PubSub City</span>
                          <span className="text-[9px] text-dim">LOCK: LVL 3</span>
                        </div>
                        <p className="text-[10px] text-slate-300">Real-time message broadcasting and stream subscription channels.</p>
                      </div>

                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1 opacity-90 hover:border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-red-400 text-xs">4. Data Structure Dungeons</span>
                          <span className="text-[9px] text-dim">LOCK: LVL 4</span>
                        </div>
                        <p className="text-[10px] text-slate-300">Lists, sets, sorted sets, and complex queue mechanics.</p>
                      </div>

                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1 opacity-90 hover:border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-purple-400 text-xs">5. Cluster Galaxy</span>
                          <span className="text-[9px] text-dim">LOCK: LVL 5</span>
                        </div>
                        <p className="text-[10px] text-slate-300">Multi-node sharding, slot hashing, and distributed memory limits.</p>
                      </div>
                    </div>
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

        {/* Center Primary Center View: GameCanvas (2D) */}
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
        <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2 pointer-events-none">
          {/* Terminal Drawer Toggle Button */}
          <button
            type="button"
            onClick={() => setIsInventoryOpen(true)}
            aria-label="Open Inventory"
            className="w-12 h-12 rounded-full border-2 border-edge bg-panel/80 text-dim hover:border-cyan/50 hover:text-cyan flex items-center justify-center text-xl transition-all duration-300 pointer-events-auto"
          >
            🎒
          </button>
          
          <button
            type="button"
            onClick={() => setTerminalDrawerOpen(!terminalDrawerOpen)}
            aria-expanded={terminalDrawerOpen}
            aria-label={terminalDrawerOpen ? 'Hide Terminal Drawer' : 'Show Terminal Drawer'}
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl transition-all duration-300 pointer-events-auto ${
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
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl transition-all duration-300 pointer-events-auto ${
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

      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
      />
    </div>
  )
}
