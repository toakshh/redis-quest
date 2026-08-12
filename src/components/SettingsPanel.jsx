import { useGameStore } from '../store/gameStore.js'
import { saveManager } from '../systems/SaveManager.js'

function SettingToggle({ label, description, enabled, onChange, icon }) {
  return (
    <label className="flex items-center justify-between gap-4 p-3 rounded bg-panel border border-edge hover:border-cyan/30 transition-colors cursor-pointer">
      <div className="flex items-center gap-3 flex-1">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="text-sm font-medium text-fg">{label}</div>
          <div className="text-[10px] text-dim">{description}</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative w-12 h-7 rounded-full border-2 transition-all duration-200 flex items-center ${
          enabled ? 'border-cyan bg-cyan' : 'border-edge bg-panel2'
        }`}
        style={{ boxShadow: enabled ? '0 0 12px rgba(34, 211, 238, 0.4)' : 'none' }}
      >
        <span
          className={`absolute w-5 h-5 rounded-full bg-white shadow-lg transition-transform duration-200 ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

function SettingSelect({ label, description, value, options, onChange, icon }) {
  return (
    <div className="p-3 rounded bg-panel border border-edge">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="text-sm font-medium text-fg">{label}</div>
          <div className="text-[10px] text-dim">{description}</div>
        </div>
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded bg-panel2 border border-edge text-fg text-sm focus:border-cyan focus:outline-none"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function SettingButton({ label, description, onClick, icon, variant = 'secondary', disabled = false }) {
  const variants = {
    primary: 'bg-cyan/20 border-cyan/40 text-cyan hover:bg-cyan/30',
    secondary: 'bg-panel border-edge text-fg hover:border-cyan/50 hover:text-cyan',
    danger: 'bg-red/20 border-red/40 text-red hover:bg-red/30',
    success: 'bg-green/20 border-green/40 text-green hover:bg-green/30',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded border font-medium transition-colors ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="text-lg">{icon}</span>
      <div className="text-left">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-[10px] opacity-70">{description}</div>
      </div>
    </button>
  )
}

function SaveSlotCard({ slot, onLoad, onSave, onDelete, onExport, onImport, currentSlot }) {
  const isCurrent = slot.id === currentSlot
  const hasData = slot.exists

  return (
    <div className={`relative panel border p-4 flex flex-col gap-3 ${isCurrent ? 'border-cyan/50 bg-cyan/5' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isCurrent ? '💾' : '💿'}</span>
          <div>
            <div className="font-bold text-fg">Slot {slot.id + 1}</div>
            <div className="text-[10px] text-dim">
              {hasData ? `Last saved: ${new Date(slot.timestamp).toLocaleString()}` : 'Empty'}
            </div>
          </div>
        </div>
        {isCurrent && (
          <span className="px-2 py-0.5 rounded text-[9px] font-bold text-cyan bg-cyan/10 border border-cyan/30">
            ACTIVE
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <SettingButton
          label={hasData ? 'Load Game' : 'Save Here'}
          description={hasData ? 'Load this save slot' : 'Save current game to this slot'}
          onClick={hasData ? () => onLoad(slot.id) : () => onSave(slot.id)}
          icon={hasData ? '📥' : '💾'}
          variant={hasData ? 'primary' : 'success'}
        />
        {hasData && (
          <>
            <SettingButton
              label="Export"
              description="Download save as JSON file"
              onClick={() => onExport(slot.id)}
              icon="📤"
              variant="secondary"
            />
            <SettingButton
              label="Delete"
              description="Permanently delete this save"
              onClick={() => onDelete(slot.id)}
              icon="🗑️"
              variant="danger"
            />
          </>
        )}
      </div>

      {!hasData && (
        <SettingButton
          label="Import Save"
          description="Load save from JSON file"
          onClick={() => onImport(slot.id)}
          icon="📥"
          variant="secondary"
        />
      )}
    </div>
  )
}

export default function SettingsPanel({ className = '' }) {
  const {
    mode,
    hintDepth,
    visualGuides,
    speedrunTimer,
    autoSaveInterval,
    setMode,
    setHintDepth,
    setVisualGuides,
    setSpeedrunTimer,
    saveGame,
    loadGame,
    resetGame,
    exportSave,
    importSave,
    getSaveSlots,
    deleteSaveSlot,
    xp,
    level,
    totalCommands,
  } = useGameStore()

  const [importFile, setImportFile] = useState(null)
  const [importTargetSlot, setImportTargetSlot] = useState(0)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [exportData, setExportData] = useState(null)
  const [exportSlot, setExportSlot] = useState(0)

  const saveSlots = getSaveSlots()
  const currentSlot = saveSlots.findIndex(s => s.exists) >= 0 ? saveSlots.findIndex(s => s.exists) : 0

  const handleImport = (slotId) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const success = importSave(event.target.result, slotId)
            if (success) {
              alert('Save imported successfully!')
            } else {
              alert('Failed to import save. Invalid format.')
            }
          } catch (err) {
            alert('Import failed: ' + err.message)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleExport = (slotId) => {
    const json = exportSave(slotId)
    if (json) {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `redis-quest-save-slot-${slotId + 1}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      alert('No save data in this slot')
    }
  }

  const handleReset = () => {
    if (confirm('Are you sure you want to reset ALL progress? This cannot be undone!')) {
      resetGame()
      setShowResetConfirm(false)
    }
  }

  const hintDepthOptions = [
    { value: 'none', label: 'None — Figure it out yourself' },
    { value: 'minimal', label: 'Minimal — Only critical hints' },
    { value: 'full', label: 'Full — Detailed explanations (Beginner default)' },
  ]

  const autoSaveOptions = [
    { value: 30000, label: '30 seconds (Beginner default)' },
    { value: 60000, label: '1 minute (Pro default)' },
    { value: 120000, label: '2 minutes' },
    { value: 300000, label: '5 minutes' },
    { value: 0, label: 'Disabled' },
  ]

  return (
    <div className={`panel flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="border-b border-edge p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="glow-text text-xl font-bold text-green">⚙️</span>
          <div>
            <h2 className="text-lg font-bold tracking-widest text-green">SETTINGS</h2>
            <p className="text-[9px] tracking-[0.2em] text-dim">Game options, saves, and preferences</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono tabular-nums text-cyan">LVL {level}</div>
          <div className="text-[10px] text-dim">{xp} XP · {totalCommands} cmds</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Game Mode Section */}
        <section className="panel p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-widest text-fg mb-4">
            <span className="text-lg">🎮</span> Game Mode
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded border-2 transition-colors cursor-pointer ${mode === 'beginner' ? "border-cyan bg-cyan/5" : "border-edge bg-panel"}`}
              onClick={() => setMode('beginner')}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">🌱</span>
                <div>
                  <div className={`font-bold text-lg ${mode === 'beginner' ? 'text-cyan' : 'text-fg'}`}>Beginner Mode</div>
                  <div className="text-[10px] text-dim">Full hints, visual guides, 30s auto-save</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-dim">
                Recommended for learning Redis fundamentals
              </div>
            </div>
            <div className={`p-4 rounded border-2 transition-colors cursor-pointer ${mode === 'pro' ? "border-amber bg-amber/5" : "border-edge bg-panel"}`}
              onClick={() => setMode('pro')}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏁</span>
                <div>
                  <div className={`font-bold text-lg ${mode === 'pro' ? 'text-amber' : 'text-fg'}`}>Pro Mode</div>
                  <div className="text-[10px] text-dim">Minimal hints, no guides, 60s auto-save</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-dim">
                For experienced players — unlocks "Perfectionist" achievement
              </div>
            </div>
          </div>
        </section>

        {/* UI & Feedback Section */}
        <section className="panel p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-widest text-fg mb-4">
            <span className="text-lg">🎨</span> UI & Feedback
          </h3>
          <div className="space-y-3">
            <SettingToggle
              label="Visual Guides"
              description="Show command hints, syntax highlighting, and interactive helpers"
              enabled={visualGuides}
              onChange={setVisualGuides}
              icon="👁️"
            />
            <SettingToggle
              label="Speedrun Timer"
              description="Display elapsed time for boss battles and sessions"
              enabled={speedrunTimer}
              onChange={setSpeedrunTimer}
              icon="⏱️"
            />
            <SettingSelect
              label="Hint Depth"
              description="How much guidance REX provides after errors"
              value={hintDepth}
              options={hintDepthOptions}
              onChange={setHintDepth}
              icon="💡"
            />
          </div>
        </section>

        {/* Auto-save Section */}
        <section className="panel p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-widest text-fg mb-4">
            <span className="text-lg">💾</span> Auto-Save
          </h3>
          <SettingSelect
            label="Auto-Save Interval"
            description="How often the game automatically saves progress"
            value={autoSaveInterval}
            options={autoSaveOptions}
            onChange={(val) => useGameStore.getState().setAutoSaveInterval?.(val) || console.log('Auto-save interval:', val)}
            icon="⏰"
          />
          <div className="flex gap-2 mt-3">
            <SettingButton
              label="Save Now"
              description="Manually save current progress to active slot"
              onClick={() => saveGame(currentSlot)}
              icon="💾"
              variant="success"
            />
            <SettingButton
              label="Load Latest"
              description="Load the most recent auto-save"
              onClick={() => loadGame(currentSlot)}
              icon="📂"
              variant="primary"
            />
          </div>
        </section>

        {/* Save Slots Section */}
        <section className="panel p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-widest text-fg mb-4">
            <span className="text-lg">🗂️</span> Save Slots
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {saveSlots.map((slot, index) => (
              <SaveSlotCard
                key={index}
                slot={{ ...slot, id: index }}
                onLoad={loadGame}
                onSave={saveGame}
                onDelete={deleteSaveSlot}
                onExport={handleExport}
                onImport={handleImport}
                currentSlot={currentSlot}
              />
            ))}
          </div>
        </section>

        {/* Data Management Section */}
        <section className="panel p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-widest text-fg mb-4">
            <span className="text-lg">⚠️</span> Data Management
          </h3>
          <div className="flex flex-wrap gap-3">
            <SettingButton
              label="Export All Saves"
              description="Download all save slots as a single JSON file"
              onClick={() => {
                const allSaves = saveSlots.map((slot, i) => ({
                  slot: i,
                  data: exportSave(i),
                })).filter(s => s.data)
                const blob = new Blob([JSON.stringify(allSaves, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `redis-quest-all-saves-${Date.now()}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
              icon="📦"
              variant="secondary"
            />
            <SettingButton
              label="Import Save File"
              description="Load a previously exported save file"
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.json'
                input.onchange = (e) => {
                  const file = e.target.files[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (event) => {
                      try {
                        const data = JSON.parse(event.target.result)
                        if (Array.isArray(data)) {
                          // Multiple saves
                          data.forEach(({ slot, data: saveData }) => {
                            if (saveData) importSave(saveData, slot)
                          })
                        } else {
                          // Single save
                          importSave(event.target.result, currentSlot)
                        }
                        alert('Import successful!')
                      } catch (err) {
                        alert('Import failed: ' + err.message)
                      }
                    }
                    reader.readAsText(file)
                  }
                }
                input.click()
              }}
              icon="📥"
              variant="secondary"
            />
            <SettingButton
              label="Reset All Progress"
              description="Permanently delete ALL saves and start fresh"
              onClick={() => setShowResetConfirm(true)}
              icon="💥"
              variant="danger"
            />
          </div>

          {showResetConfirm && (
            <div className="mt-4 p-4 rounded bg-red/10 border border-red/30">
              <div className="text-red font-bold mb-2">⚠️ CONFIRM RESET</div>
              <div className="text-sm text-dim mb-4">
                This will delete ALL save slots, achievements, skills, cosmetics, and progress.
                You will start at Level 1 with 0 XP. This action CANNOT be undone.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded bg-red/20 border border-red/40 text-red font-bold hover:bg-red/30"
                >
                  YES, RESET EVERYTHING
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 rounded border border-edge text-fg hover:border-cyan"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* About Section */}
        <section className="panel p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-widest text-fg mb-4">
            <span className="text-lg">ℹ️</span> About
          </h3>
          <div className="text-[10px] text-dim space-y-1">
            <div>Redis Quest v1.0.0</div>
            <div>A cyberpunk Redis learning adventure</div>
            <div className="mt-2">Built with React, Vite, Zustand, and Tailwind CSS</div>
            <div>Redis commands simulated in-browser</div>
          </div>
        </section>
      </div>
    </div>
  )
}