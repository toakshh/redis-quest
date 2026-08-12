import React, { useEffect, useRef, useState } from 'react'
import { GameLoop } from '../game/GameLoop.js'
import { World } from '../game/World.js'
import { drawIsoTile, drawIsoBlock, gridToIso, isoToGrid, TILE_WIDTH, TILE_HEIGHT } from '../game/IsometricRenderer.js'
import { IsometricEngineControls } from '../game/IsometricEngine.js'
import { useGameStore } from '../store/gameStore.js'

// Region map configurations for 2D Isometric Tilesets
export const REGION_MAPS = {
  'memory-village': {
    id: 'memory-village',
    name: 'Memory Village',
    width: 20,
    height: 20,
    groundColor: '#1e293b',
    tileColor1: '#334155',
    tileColor2: '#1e293b',
    borderColor: '#0284c7',
    chests: [
      { id: 'mv_c1', gx: 4, gy: 4, gem: 'SET', key: 'quest:welcome', value: 'hello', looted: false },
      { id: 'mv_c2', gx: 14, gy: 5, gem: 'GET', key: 'quest:welcome', value: 'hello', looted: false },
      { id: 'mv_c3', gx: 8, gy: 12, gem: 'EXPIRE', key: 'quest:temp', value: 'secret', looted: false },
    ],
    enemies: [
      { id: 'mv_e1', name: 'Memory Goblin', gx: 10, gy: 8, hp: 30, maxHp: 30, shieldKey: 'goblin:shield', spell: 'SET goblin:shield 100', counterGem: 'DEL' },
    ],
  },
  'key-value-kingdom': {
    id: 'key-value-kingdom',
    name: 'Key-Value Kingdom',
    width: 24,
    height: 24,
    groundColor: '#1e1b4b',
    tileColor1: '#312e81',
    tileColor2: '#1e1b4b',
    borderColor: '#818cf8',
    chests: [
      { id: 'kv_c1', gx: 5, gy: 5, gem: 'HSET', key: 'user:100', value: 'name REX', looted: false },
      { id: 'kv_c2', gx: 18, gy: 6, gem: 'HGET', key: 'user:100', value: 'name', looted: false },
      { id: 'kv_c3', gx: 12, gy: 18, gem: 'HDEL', key: 'user:100', value: 'name', looted: false },
    ],
    enemies: [
      { id: 'kv_e1', name: 'Entropy Spectre', gx: 14, gy: 14, hp: 50, maxHp: 50, shieldKey: 'spectre:barrier', spell: 'HSET spectre:barrier armor 50', counterGem: 'HDEL' },
    ],
  },
  'pubsub-city': {
    id: 'pubsub-city',
    name: 'PubSub City',
    width: 24,
    height: 24,
    groundColor: '#064e3b',
    tileColor1: '#065f46',
    tileColor2: '#064e3b',
    borderColor: '#34d399',
    chests: [
      { id: 'ps_c1', gx: 6, gy: 6, gem: 'PUBLISH', key: 'news:channel', value: 'broadcast', looted: false },
      { id: 'ps_c2', gx: 16, gy: 16, gem: 'SUBSCRIBE', key: 'news:channel', value: '', looted: false },
    ],
    enemies: [
      { id: 'ps_e1', name: 'Noise Jammer', gx: 12, gy: 12, hp: 40, maxHp: 40, shieldKey: 'jammer:signal', spell: 'PUBLISH jammer:signal noise', counterGem: 'PUBLISH' },
    ],
  },
  'data-structure-dungeons': {
    id: 'ds-dungeons',
    name: 'Data Structure Dungeons',
    width: 26,
    height: 26,
    groundColor: '#450a0a',
    tileColor1: '#7f1d1d',
    tileColor2: '#450a0a',
    borderColor: '#f87171',
    chests: [
      { id: 'ds_c1', gx: 5, gy: 5, gem: 'LPUSH', key: 'queue:jobs', value: 'task1', looted: false },
      { id: 'ds_c2', gx: 20, gy: 6, gem: 'RPOP', key: 'queue:jobs', value: '', looted: false },
      { id: 'ds_c3', gx: 10, gy: 20, gem: 'ZADD', key: 'arena:scores', value: '100 Hero', looted: false },
    ],
    enemies: [
      { id: 'ds_e1', name: 'Queue Overlord', gx: 15, gy: 15, hp: 70, maxHp: 70, shieldKey: 'overlord:queue', spell: 'LPUSH overlord:queue spike', counterGem: 'RPOP' },
      { id: 'ds_e2', name: 'Time Bomb', gx: 8, gy: 14, hp: 20, maxHp: 20, shieldKey: 'bomb:timer', spell: 'EXPIRE bomb:timer 5', counterGem: 'DEL' },
    ],
  },
  'cluster-galaxy': {
    id: 'cluster-galaxy',
    name: 'Cluster Galaxy',
    width: 30,
    height: 30,
    groundColor: '#2e1065',
    tileColor1: '#4c1d95',
    tileColor2: '#2e1065',
    borderColor: '#c084fc',
    chests: [
      { id: 'cg_c1', gx: 7, gy: 7, gem: 'CLUSTER', key: 'node:1', value: 'meet', looted: false },
      { id: 'cg_c2', gx: 22, gy: 22, gem: 'DEL', key: 'node:bad', value: '', looted: false },
    ],
    enemies: [
      { id: 'cg_e1', name: 'Partition Anomaly', gx: 18, gy: 12, hp: 100, maxHp: 100, shieldKey: 'anomaly:core', spell: 'SET anomaly:core locked', counterGem: 'DEL' },
    ],
  },
}

export default function GameCanvas({ engine, isFullscreen, onToggleFullscreen, isTerminalDrawerOpen, onToggleTerminalDrawer }) {
  const canvasRef = useRef(null)
  const store = useGameStore()

  // State
  const [selectedRegion, setSelectedRegion] = useState('memory-village')
  const [inventoryGems, setInventoryGems] = useState(['SET', 'GET'])
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalLogs, setTerminalLogs] = useState(['Redis Quest CLI ready. Type ~ or click terminal icon to toggle.'])
  const [playerGridPos, setPlayerGridPos] = useState({ gx: 2, gy: 2 })
  const [chests, setChests] = useState(REGION_MAPS['memory-village'].chests)
  const [enemies, setEnemies] = useState(REGION_MAPS['memory-village'].enemies)
  const [battleMessage, setBattleMessage] = useState('')

  // Keep track of player position in ref for animation frame
  const playerRef = useRef({ gx: 2, gy: 2, targetGx: 2, targetGy: 2, animProgress: 1, facing: 'S' })

  // Switch region
  const handleRegionSelect = (regionId) => {
    setSelectedRegion(regionId)
    const map = REGION_MAPS[regionId] || REGION_MAPS['memory-village']
    setChests(map.chests)
    setEnemies(map.enemies)
    playerRef.current = { gx: 2, gy: 2, targetGx: 2, targetGy: 2, animProgress: 1, facing: 'S' }
    setPlayerGridPos({ gx: 2, gy: 2 })
    setBattleMessage(`Entered ${map.name}`)
  }

  // Keyboard & QWERTY Physical controls using IsometricEngineControls
  useEffect(() => {
    const controls = new IsometricEngineControls({
      onMove: (dx, dy) => movePlayer(dx, dy),
      onInteract: () => interactCurrentTile(),
      onToggleTerminal: () => {
        if (onToggleTerminalDrawer) {
          onToggleTerminalDrawer()
        } else {
          setTerminalOpen((prev) => !prev)
        }
      },
      isTerminalOpen: () => isTerminalDrawerOpen || terminalOpen,
    })

    controls.attach(window)
    return () => controls.detach(window)
  }, [terminalOpen, selectedRegion, chests, enemies])

  const interactCurrentTile = () => {
    const p = playerRef.current
    const chest = chests.find((c) => !c.looted && c.gx === Math.round(p.gx) && c.gy === Math.round(p.gy))
    if (chest) {
      chest.looted = true
      if (!inventoryGems.includes(chest.gem)) {
        setInventoryGems((prev) => [...prev, chest.gem])
      }
      setBattleMessage(`✨ Interacted! Acquired Command Gem: [ ${chest.gem} ]`)
      if (engine) {
        engine.execute(`SET ${chest.key} "${chest.value}"`)
      }
    } else {
      setBattleMessage('Searched area... No nearby objects to interact with.')
    }
  }

  const movePlayer = (dx, dy) => {
    const map = REGION_MAPS[selectedRegion]
    const p = playerRef.current
    const newGx = Math.max(0, Math.min(map.width - 1, p.gx + dx))
    const newGy = Math.max(0, Math.min(map.height - 1, p.gy + dy))

    if (newGx !== p.gx || newGy !== p.gy) {
      p.targetGx = newGx
      p.targetGy = newGy
      p.animProgress = 0
      setPlayerGridPos({ gx: newGx, gy: newGy })

      // Check chest interaction
      chests.forEach((chest) => {
        if (!chest.looted && chest.gx === newGx && chest.gy === newGy) {
          chest.looted = true
          if (!inventoryGems.includes(chest.gem)) {
            setInventoryGems((prev) => [...prev, chest.gem])
          }
          setBattleMessage(`✨ Opened Chest! Acquired Command Gem: [ ${chest.gem} ]`)
          if (engine) {
            engine.execute(`SET ${chest.key} "${chest.value}"`)
          }
        }
      })
    }
  }

  // Cast gem from hotbar
  const castGem = (gem) => {
    // Find closest enemy
    const p = playerRef.current
    const activeEnemy = enemies.find((e) => e.hp > 0 && Math.abs(e.gx - p.gx) <= 4 && Math.abs(e.gy - p.gy) <= 4)

    if (activeEnemy) {
      if (gem === activeEnemy.counterGem || gem === 'DEL') {
        const damage = 35
        const newHp = Math.max(0, activeEnemy.hp - damage)
        activeEnemy.hp = newHp
        setEnemies([...enemies])

        if (engine && activeEnemy.shieldKey) {
          engine.execute(`DEL ${activeEnemy.shieldKey}`)
        }

        if (newHp === 0) {
          setBattleMessage(`💥 Countered ${activeEnemy.name} with ${gem}! Enemy Defeated! (+50 XP)`)
          store.addXp(50)
        } else {
          setBattleMessage(`⚡ Cast ${gem}! Hit ${activeEnemy.name} for ${damage} dmg! (${newHp}/${activeEnemy.maxHp} HP)`)
        }
      } else {
        setBattleMessage(`⚠️ Cast ${gem}, but ${activeEnemy.name} shielded! Use ${activeEnemy.counterGem}!`)
      }
    } else {
      setBattleMessage(`Cast ${gem} gem into the air! (No enemies in range)`)
      if (engine) {
        engine.execute(`${gem} player:action "cast"`)
      }
    }
  }

  // Handle in-game diegetic terminal command submit
  const handleTerminalSubmit = (e) => {
    e.preventDefault()
    if (!terminalInput.trim()) return

    const cmd = terminalInput.trim()
    setTerminalLogs((prev) => [...prev, `> ${cmd}`])

    if (engine) {
      const res = store.runCommand(cmd)
      const output = res.type === 'error' ? `ERR: ${res.value}` : JSON.stringify(res.value)
      setTerminalLogs((prev) => [...prev, output])

      // World live react (e.g. DEL enemy shield or SET item)
      const parts = cmd.split(' ')
      const verb = parts[0].toUpperCase()
      const arg1 = parts[1]

      if (verb === 'DEL') {
        enemies.forEach((en) => {
          if (en.shieldKey === arg1 && en.hp > 0) {
            en.hp = Math.max(0, en.hp - 30)
            setBattleMessage(`⚡ Terminal DEL destroyed ${en.name}'s shield!`)
          }
        })
        setEnemies([...enemies])
      }
    }

    setTerminalInput('')
  }

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animationFrameId

    const render = () => {
      const map = REGION_MAPS[selectedRegion]
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Center offset
      const offsetX = canvas.width / 2
      const offsetY = 120

      // Update player position smooth lerp
      const p = playerRef.current
      if (p.animProgress < 1) {
        p.animProgress = Math.min(1, p.animProgress + 0.1)
        p.gx = p.gx + (p.targetGx - p.gx) * p.animProgress
        p.gy = p.gy + (p.targetGy - p.gy) * p.animProgress
      }

      // Draw isometric map tiles
      for (let gx = 0; gx < map.width; gx++) {
        for (let gy = 0; gy < map.height; gy++) {
          const iso = gridToIso(gx, gy)
          const screenX = offsetX + iso.x
          const screenY = offsetY + iso.y

          const isChecker = (gx + gy) % 2 === 0
          const fillColor = isChecker ? map.tileColor1 : map.tileColor2

          drawIsoTile(ctx, screenX, screenY, TILE_WIDTH, TILE_HEIGHT, fillColor, map.borderColor)
        }
      }

      // Draw chests
      chests.forEach((chest) => {
        const iso = gridToIso(chest.gx, chest.gy)
        const screenX = offsetX + iso.x
        const screenY = offsetY + iso.y

        if (chest.looted) {
          drawIsoBlock(ctx, screenX, screenY, 24, 12, 10, '#64748b', '#475569', '#334155')
        } else {
          drawIsoBlock(ctx, screenX, screenY, 24, 12, 14, '#f59e0b', '#d97706', '#b45309')
          // Glow dot
          ctx.fillStyle = '#fef08a'
          ctx.beginPath()
          ctx.arc(screenX, screenY - 14, 4, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // Draw enemies
      enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return
        const iso = gridToIso(enemy.gx, enemy.gy)
        const screenX = offsetX + iso.x
        const screenY = offsetY + iso.y

        // Red monster block
        drawIsoBlock(ctx, screenX, screenY, 28, 14, 22, '#ef4444', '#dc2626', '#b91c1c')

        // Enemy HP bar & Name
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(enemy.name, screenX, screenY - 32)

        // Health bar back
        ctx.fillStyle = '#450a0a'
        ctx.fillRect(screenX - 16, screenY - 28, 32, 4)
        // Health bar fill
        ctx.fillStyle = '#22c55e'
        ctx.fillRect(screenX - 16, screenY - 28, (enemy.hp / enemy.maxHp) * 32, 4)
      })

      // Draw Player Avatar (REX / Hero)
      const pIso = gridToIso(p.gx, p.gy)
      const pScreenX = offsetX + pIso.x
      const pScreenY = offsetY + pIso.y

      // Hero Cyan Block with animated bobbing
      const bob = Math.sin(Date.now() / 200) * 3
      drawIsoBlock(ctx, pScreenX, pScreenY - bob, 30, 15, 26, '#06b6d4', '#0891b2', '#0e7490')

      // Hero Crown / Indicator
      ctx.fillStyle = '#67e8f9'
      ctx.beginPath()
      ctx.arc(pScreenX, pScreenY - 32 - bob, 5, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('HERO (REX)', pScreenX, pScreenY - 42 - bob)

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => cancelAnimationFrame(animationFrameId)
  }, [selectedRegion, chests, enemies])

  return (
    <div className="relative flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Region Selector Bar */}
      <div className="flex items-center justify-between p-3 bg-slate-900 border-b border-slate-800 z-10">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold text-sm tracking-wider">REGIONS:</span>
          <div className="flex gap-1 overflow-x-auto">
            {Object.keys(REGION_MAPS).map((rid) => (
              <button
                key={rid}
                onClick={() => handleRegionSelect(rid)}
                className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                  selectedRegion === rid
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {REGION_MAPS[rid].name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={`px-3 py-1 text-xs rounded font-bold border transition-all ${
                isFullscreen
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-800 text-cyan-400 border-cyan-500/30 hover:border-cyan-400'
              }`}
            >
              ⛶ {isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
            </button>
          )}
          <button
            onClick={() => {
              if (onToggleTerminalDrawer) {
                onToggleTerminalDrawer()
              } else {
                setTerminalOpen(!terminalOpen)
              }
            }}
            className={`px-3 py-1 text-xs rounded font-bold border transition-all ${
              (isTerminalDrawerOpen || terminalOpen)
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 text-amber-400 border-amber-500/30 hover:border-amber-400'
            }`}
          >
            ⌨️ CLI TERMINAL (~)
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport - Expanded Full Width */}
      <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden w-full h-full">
        <canvas ref={canvasRef} width={1200} height={700} className="w-full h-full object-contain" />

        {/* HUD Control Legends Overlay */}
        <div className="absolute top-4 left-4 flex flex-col gap-1.5 p-3 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl text-xs font-mono text-slate-300 pointer-events-none z-10 shadow-lg">
          <div className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase mb-0.5">Controls HUD</div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-800 border border-slate-700 text-cyan-300 px-1.5 py-0.5 rounded font-bold">W A S D</span>
            <span>Move Hero</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-800 border border-slate-700 text-amber-300 px-1.5 py-0.5 rounded font-bold">E</span>
            <span>Interact / Loot</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-800 border border-slate-700 text-emerald-300 px-1.5 py-0.5 rounded font-bold">~</span>
            <span>CLI Terminal</span>
          </div>
        </div>

        {/* Battle / Interaction Banner */}
        {battleMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 backdrop-blur border border-cyan-500/50 rounded-full text-xs font-mono text-cyan-300 shadow-lg animate-fade-in">
            {battleMessage}
          </div>
        )}

        {/* Touch D-Pad Controls for mobile / touch */}
        <div className="absolute bottom-4 left-4 grid grid-cols-3 gap-1 w-32 h-32 opacity-80 hover:opacity-100 transition-opacity">
          <div />
          <button onClick={() => movePlayer(0, -1)} className="bg-slate-800 border border-slate-700 rounded text-slate-200 font-bold hover:bg-slate-700 active:bg-cyan-600">▲</button>
          <div />
          <button onClick={() => movePlayer(-1, 0)} className="bg-slate-800 border border-slate-700 rounded text-slate-200 font-bold hover:bg-slate-700 active:bg-cyan-600">◄</button>
          <div className="flex items-center justify-center text-[10px] text-slate-500 font-mono">MOVE</div>
          <button onClick={() => movePlayer(1, 0)} className="bg-slate-800 border border-slate-700 rounded text-slate-200 font-bold hover:bg-slate-700 active:bg-cyan-600">►</button>
          <div />
          <button onClick={() => movePlayer(0, 1)} className="bg-slate-800 border border-slate-700 rounded text-slate-200 font-bold hover:bg-slate-700 active:bg-cyan-600">▼</button>
          <div />
        </div>

        {/* Command Gem Hotbar Overlay */}
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1">
          <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest bg-slate-900/80 px-2 py-0.5 rounded border border-amber-500/20">
            Command Gem Hotbar
          </span>
          <div className="flex gap-2 p-2 bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl">
            {inventoryGems.map((gem, idx) => (
              <button
                key={idx}
                onClick={() => castGem(gem)}
                className="group relative flex flex-col items-center justify-center w-12 h-12 bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/40 rounded-lg hover:border-cyan-400 hover:scale-105 active:scale-95 transition-all shadow-md"
              >
                <span className="text-xs font-black font-mono text-cyan-300 group-hover:text-cyan-100">{gem}</span>
                <span className="text-[9px] text-slate-400">SPELL</span>
              </button>
            ))}
          </div>
        </div>

        {/* In-Game Diegetic Terminal / Scroll Overlay */}
        {terminalOpen && (
          <div className="absolute inset-x-6 top-6 bottom-20 bg-slate-950/95 border-2 border-amber-500/60 rounded-xl p-4 flex flex-col shadow-2xl backdrop-blur-md z-30 font-mono">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2 mb-2">
              <span className="text-xs font-bold text-amber-400 tracking-widest flex items-center gap-2">
                📜 REDIS QUEST DIEGETIC TERMINAL SCROLL
              </span>
              <button onClick={() => setTerminalOpen(false)} className="text-slate-400 hover:text-white text-xs">✕ CLOSE (~)</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 text-xs text-slate-300 p-2 bg-slate-900/50 rounded border border-slate-800/80">
              {terminalLogs.map((log, i) => (
                <div key={i} className={log.startsWith('>') ? 'text-cyan-400 font-semibold' : log.startsWith('ERR') ? 'text-red-400' : 'text-emerald-400'}>
                  {log}
                </div>
              ))}
            </div>

            <form onSubmit={handleTerminalSubmit} className="mt-3 flex gap-2">
              <span className="text-amber-400 font-bold flex items-center">&gt;</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="Type Redis command e.g. DEL goblin:shield..."
                className="flex-1 bg-slate-900 border border-amber-500/40 rounded px-3 py-1.5 text-xs text-amber-200 focus:outline-none focus:border-amber-400"
                autoFocus
              />
              <button type="submit" className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition-colors">
                EXECUTE
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
