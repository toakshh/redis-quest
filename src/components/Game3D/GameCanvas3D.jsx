import React, { useEffect, useRef, useState } from 'react'
import { Engine3D } from './Engine3D.js'
import { useGameStore } from '../../store/gameStore.js'
import { soundEngine } from '../../audio/SoundEngine.js'

export default function GameCanvas3D({ engine, isFullscreen, onToggleFullscreen, isTerminalDrawerOpen, onToggleTerminalDrawer }) {
  const containerRef = useRef(null)
  const engine3DRef = useRef(null)
  const store = useGameStore()

  // 3D HUD State
  const [hudState, setHudState] = useState({
    playerHp: 100,
    systemHealth: 100,
    systemPressure: 20,
    bossHp: 100,
    bossMaxHp: 100,
    bossShieldActive: true,
    bossShieldKey: 'goblin:shield',
    score: 0,
    apiGateActive: false,
    apiGateTimer: 0,
  })

  const [activeWeapon, setActiveWeapon] = useState('SET')
  const activeWeaponRef = useRef('SET')
  const [battleMessage, setBattleMessage] = useState('3D SHOOTING ARENA ONLINE. DEFEND THE REDIS ENGINE!')
  const [immunityOverlay, setImmunityOverlay] = useState(null)

  // GameStore state & REX interop
  const currentBoss = store.boss
  const currentChallenge = currentBoss?.challenges?.[currentBoss?.challengeIndex]
  const bossName = currentBoss ? currentBoss.name : 'MEMORY GOBLIN'
  const bossMaxHp = currentBoss ? currentBoss.maxHealth : hudState.bossMaxHp
  const bossHp = currentBoss ? currentBoss.health : hudState.bossHp
  const bossShieldActive = currentBoss ? (!currentBoss.defeated && Boolean(currentChallenge)) : hudState.bossShieldActive
  const bossShieldKey = currentBoss ? (currentChallenge ? currentChallenge.key : 'SHIELD') : hudState.bossShieldKey

  let activeRexHint = battleMessage
  if (currentBoss?.immunityShield?.hint) {
    activeRexHint = `🛡️ IMMUNITY: ${currentBoss.immunityShield.hint}`
  } else if (currentChallenge?.hint) {
    activeRexHint = `🎯 TASK: ${currentChallenge.task} (Hint: ${currentChallenge.hint})`
  } else if (store.survivalMode) {
    const survState = typeof store.getSurvivalState === 'function' ? store.getSurvivalState() : null
    const seedHint = typeof store.getRexSurvivalHint === 'function' ? store.getRexSurvivalHint(store.survivalMode) : ''
    activeRexHint = `🌩️ SURVIVAL: ${survState?.currentWave?.name || 'Wave Active'} — ${seedHint}`
  } else if (store.currentRegion) {
    const regionHint = typeof store.getRexRegionHint === 'function' ? store.getRexRegionHint(store.currentRegion) : ''
    if (regionHint) activeRexHint = `🤖 REX: ${regionHint}`
  }

  const setWeapon = (weapon) => {
    activeWeaponRef.current = weapon
    setActiveWeapon(weapon)
  }

  // Initialize Three.js 3D Engine
  useEffect(() => {
    if (!containerRef.current) return

    const engine3D = new Engine3D(containerRef.current)
    engine3DRef.current = engine3D

    engine3D.onStateChange = (newState) => {
      setHudState((prev) => {
        if (
          prev.playerHp === newState.playerHp &&
          prev.systemHealth === newState.systemHealth &&
          prev.systemPressure === newState.systemPressure &&
          prev.bossHp === newState.bossHp &&
          prev.bossMaxHp === newState.bossMaxHp &&
          prev.bossShieldActive === newState.bossShieldActive &&
          prev.bossShieldKey === newState.bossShieldKey &&
          prev.score === newState.score &&
          prev.apiGateActive === newState.apiGateActive &&
          prev.apiGateTimer === newState.apiGateTimer
        ) {
          return prev
        }
        return newState
      })
    }

    engine3D.start()

    // Mouse movement aim tracking
    const handleMouseMove = (e) => {
      if (engine3DRef.current) {
        engine3DRef.current.updateAimPoint(e.clientX, e.clientY)
      }
    }

    // Mouse click shooting
    const handleMouseDown = (e) => {
      if (e.button !== 0) return
      if (!containerRef.current?.contains(e.target)) return
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('button, input, textarea, select, a, [role="button"]')) return

      if (engine3DRef.current) {
        triggerWeapon(activeWeaponRef.current)
      }
    }

    // Keyboard controls WASD + Keys
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement
      const isInput = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)
      if (isInput) return

      if (engine3DRef.current) {
        engine3DRef.current.keysDown[e.key] = true
      }

      // Hotkey weapon selection 1-5
      if (e.key === '1') setWeapon('SET')
      if (e.key === '2') setWeapon('GET')
      if (e.key === '3') setWeapon('DEL')
      if (e.key === '4') setWeapon('EXPIRE')
      if (e.key === '5') setWeapon('LPUSH')
    }

    const handleKeyUp = (e) => {
      if (engine3DRef.current) {
        engine3DRef.current.keysDown[e.key] = false
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      engine3D.dispose()
    }
  }, [])

  useEffect(() => {
    if (engine3DRef.current && currentBoss?.id) {
      engine3DRef.current.initBoss(currentBoss.id)
    }
  }, [currentBoss?.id])

  const executeCmd = (commandStr) => {
    if (typeof store.runCommand === 'function') {
      return store.runCommand(commandStr)
    } else if (engine && typeof engine.execute === 'function') {
      return engine.execute(commandStr)
    }
  }

  // Trigger weapons / commands in 3D Arena & sync with Redis engine & game store
  const triggerWeapon = (commandName) => {
    soundEngine.playSFX('click')
    const engine3D = engine3DRef.current
    if (!engine3D) return

    const targetPos = engine3D.aimPoint

    if (commandName === 'SET') {
      soundEngine.playSFX('gem')
      engine3D.castSetCommand(targetPos)
      setBattleMessage('⚡ Fired SET Blaster Shot!')
      executeCmd('SET player:action "laser_blast"')
    } else if (commandName === 'GET') {
      soundEngine.playSFX('shuffle')
      engine3D.castGetCommand(targetPos)
      setBattleMessage('🔍 Activated GET Recon Beam!')
      executeCmd(`GET ${bossShieldKey || 'goblin:shield'}`)
    } else if (commandName === 'DEL') {
      soundEngine.playSFX('shuffle')
      engine3D.castDelCommand(targetPos)

      if (engine3D.bossShieldActive || bossShieldActive) {
        engine3D.stripBossShield()
        setBattleMessage(`💥 Purged ${bossName} Shield with DEL!`)
        setImmunityOverlay(null)
        executeCmd(`DEL ${bossShieldKey || 'goblin:shield'}`)
        if (currentBoss && !currentBoss.defeated && typeof store.attackBoss === 'function') {
          store.attackBoss(20)
        } else {
          store.addXp(30)
        }
      } else {
        setBattleMessage('⚡ DEL Energy Purge deployed!')
        if (currentBoss && !currentBoss.defeated && typeof store.attackBoss === 'function') {
          store.attackBoss(15)
        }
      }
    } else if (commandName === 'EXPIRE') {
      soundEngine.playSFX('victory')
      engine3D.castExpireCommand()
      setBattleMessage('🛡️ Deployed API Gate Shield Barrier (EXPIRE 8s)!')
      executeCmd('EXPIRE api:shield 8')
    } else if (commandName === 'LPUSH' || commandName === 'RPUSH') {
      soundEngine.playSFX('gem')
      engine3D.castQueueCommand('LPUSH')
      setBattleMessage('📦 Pushed Job Crate to Conveyor Belt (LPUSH queue:jobs task)!')
      executeCmd('LPUSH queue:jobs task')
    } else if (commandName === 'LPOP' || commandName === 'RPOP') {
      soundEngine.playSFX('shuffle')
      engine3D.castQueueCommand('LPOP')
      setBattleMessage('📦 Popped Job Crate from Conveyor Belt (LPOP queue:jobs)!')
      executeCmd('LPOP queue:jobs')
    }
  }

  return (
    <div className="relative w-full h-full min-h-[500px] bg-slate-950 overflow-hidden select-none">
      {/* 3D Canvas Mount Point */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

      {/* --- DIEGETIC 3D HUD OVERLAY --- */}

      {/* Top Left: System & Player Health Meters */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 p-3 bg-slate-900/80 backdrop-blur border border-cyan/30 rounded-xl shadow-xl min-w-[260px]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold font-mono tracking-wider text-cyan flex items-center gap-1.5">
            <span>❤️</span> PLAYER HP
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400">{hudState.playerHp} / 100</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            style={{ width: `${hudState.playerHp}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
          <span className="text-xs font-bold font-mono tracking-wider text-amber flex items-center gap-1.5">
            <span>⚙️</span> SYSTEM HEALTH
          </span>
          <span className="text-xs font-mono font-bold text-amber-300">{hudState.systemHealth} / 100</span>
        </div>
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all duration-300"
            style={{ width: `${hudState.systemHealth}%` }}
          />
        </div>
      </div>

      {/* Top Right: System Pressure Gauge & Score */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2 p-3 bg-slate-900/80 backdrop-blur border border-purple/30 rounded-xl shadow-xl min-w-[220px]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-widest text-slate-400">SYS PRESSURE</span>
          <span className={`text-sm font-mono font-bold ${hudState.systemPressure > 70 ? 'text-red animate-pulse' : 'text-purple-300'}`}>
            {hudState.systemPressure}%
          </span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div
            className={`h-full transition-all duration-300 ${
              hudState.systemPressure > 70
                ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                : 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]'
            }`}
            style={{ width: `${hudState.systemPressure}%` }}
          />
        </div>
        <div className="text-[10px] font-mono text-cyan flex justify-between w-full pt-1 border-t border-slate-800">
          <span>SCORE</span>
          <span className="font-bold text-amber">{hudState.score} XP</span>
        </div>
      </div>

      {/* Top Center: Active Boss Health & Shield Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center p-3 bg-slate-900/90 backdrop-blur border border-red-500/40 rounded-xl shadow-2xl min-w-[340px]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold font-mono tracking-widest text-emerald-400">👾 {bossName.toUpperCase()}</span>
          {bossShieldActive ? (
            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/50 animate-pulse">
              🛡️ {bossShieldKey} ACTIVE
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
              ⚡ SHIELD STRIPPED
            </span>
          )}
        </div>
        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div
            className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-400 transition-all duration-300 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
            style={{ width: `${Math.max(0, Math.min(100, (bossHp / bossMaxHp) * 100))}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-slate-300 mt-1">HP: {bossHp} / {bossMaxHp}</span>
      </div>

      {/* REX Hint Panel / Battle Log Banner */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-cyan/10 backdrop-blur border border-cyan/40 rounded-lg shadow-lg text-center max-w-lg">
        <div className="text-[10px] font-mono tracking-wider text-cyan font-bold flex items-center justify-center gap-1.5">
          <span>🤖 REX TACTICAL ADVICE</span>
        </div>
        <p className="text-xs font-mono text-slate-200 mt-0.5">
          {activeRexHint}
        </p>
        {hudState.apiGateActive && (
          <div className="text-[10px] font-mono text-sky-300 font-bold mt-1">
            🛡️ API GATE SHIELD DEPLOYED ({hudState.apiGateTimer}s)
          </div>
        )}
      </div>

      {/* Bottom Center: Weapon Hotbar (1-5) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-2 bg-slate-900/90 backdrop-blur border border-cyan/40 rounded-xl shadow-2xl">
        {[
          { key: '1', name: 'SET', icon: '⚡', desc: 'Primary Laser' },
          { key: '2', name: 'GET', icon: '🔍', desc: 'Recon Beam' },
          { key: '3', name: 'DEL', icon: '💥', desc: 'Shield Purge' },
          { key: '4', name: 'EXPIRE', icon: '🛡️', desc: 'API Barrier' },
          { key: '5', name: 'LPUSH', icon: '📦', desc: 'Queue Hopper' },
        ].map((item) => {
          const isActive = activeWeapon === item.name
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setWeapon(item.name)
                triggerWeapon(item.name)
              }}
              className={`flex flex-col items-center px-3.5 py-2 rounded-lg border transition-all duration-200 ${
                isActive
                  ? 'bg-cyan/20 border-cyan text-cyan shadow-[0_0_12px_rgba(34,211,238,0.4)] scale-105'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-cyan/50 hover:bg-slate-800'
              }`}
            >
              <span className="text-[9px] font-mono text-slate-400">[{item.key}]</span>
              <span className="text-base my-0.5">{item.icon}</span>
              <span className="text-xs font-mono font-bold tracking-wider">{item.name}</span>
            </button>
          )
        })}
      </div>

      {/* Bottom Left: Controls Guide */}
      <div className="absolute bottom-6 left-4 z-20 p-2.5 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg text-[10px] font-mono text-slate-400 space-y-1">
        <div className="text-cyan font-bold">🎮 3D CONTROLS</div>
        <div>WASD / Arrows: Move Cyber Hero</div>
        <div>Mouse Aim & Click: Fire Command Laser</div>
        <div>Hotkeys 1-5: Switch Weapon FX</div>
        <div>~ (Tilde): Toggle Terminal Drawer</div>
      </div>
    </div>
  )
}
