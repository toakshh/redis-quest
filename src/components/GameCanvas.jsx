import React, { useEffect, useRef, useState } from 'react'
import { soundEngine } from '../audio/SoundEngine.js'
import VictoryModal from './VictoryModal.jsx'
import ChestCommandModal from './ChestCommandModal.jsx'
import { GameLoop } from '../game/GameLoop.js'
import { World } from '../game/World.js'
import { drawIsoTile, drawIsoBlock, gridToIso, isoToGrid, TILE_WIDTH, TILE_HEIGHT } from '../game/IsometricRenderer.js'
import { IsometricEngineControls } from '../game/IsometricEngine.js'
import { Camera } from '../game/Camera.js'
import { useGameStore } from '../store/gameStore.js'

// Compute where an offscreen objective marker should sit on the viewport edge.
// Uses camera coordinate translation matching the render loop.
function offscreenEdge(t, camera, canvasWidth, canvasHeight) {
  const cw = canvasWidth || 1200
  const ch = canvasHeight || 700
  const margin = 20

  // Check if position is currently on-screen with margin
  const isOnScreen = t.x >= margin && t.x <= cw - margin && t.y >= margin + 60 && t.y <= ch - margin - 40
  if (isOnScreen) return null

  // Direction from canvas center to the target point
  const dx = t.x - cw / 2
  const dy = t.y - ch / 2
  const len = Math.max(1e-6, Math.sqrt(dx * dx + dy * dy))

  let ex = cw / 2 + (dx / len) * (cw / 2 - margin)
  let ey = ch / 2 + (dy / len) * (ch / 2 - margin)

  // Clamp to visible canvas edges
  ex = Math.max(margin, Math.min(cw - margin - 90, ex))
  ey = Math.max(80, Math.min(ch - margin - 30, ey))

  const dir = dx === 0 && dy === 0 ? '' : `${dx >= 0 ? '→' : '←'}${Math.abs(dy) > Math.abs(dx) ? (dy >= 0 ? '↓' : '↑') : ''}`
  return { x: ex, y: ey, dir }
}

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
      { id: 'mv_c3', gx: 8, gy: 12, gem: 'DEL', key: 'quest:temp', value: 'secret', looted: false },
    ],
    enemies: [
      {
        id: 'mv_e1',
        name: 'Memory Goblin',
        gx: 10,
        gy: 8,
        hp: 30,
        maxHp: 30,
        shieldKey: 'goblin:shield',
        spell: 'SET goblin:shield 100',
        counterGem: 'DEL',
        failureReason: 'Standard SET/GET spells bounce off the Goblin\'s corrupted memory shield.',
        requiredConcept: 'Key Deletion (DEL) is required to purge the corrupted shield key.',
      },
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
      {
        id: 'kv_e1',
        name: 'Entropy Spectre',
        gx: 14,
        gy: 14,
        hp: 50,
        maxHp: 50,
        shieldKey: 'spectre:barrier',
        spell: 'HSET spectre:barrier armor 50',
        counterGem: 'HDEL',
        failureReason: 'Simple string commands cannot affect field-value hash structures.',
        requiredConcept: 'Hash Field Removal (HDEL) is needed to strip fields from the Spectre\'s barrier.',
      },
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
      {
        id: 'ps_e1',
        name: 'Noise Jammer',
        gx: 12,
        gy: 12,
        hp: 40,
        maxHp: 40,
        shieldKey: 'jammer:signal',
        spell: 'PUBLISH jammer:signal noise',
        counterGem: 'PUBLISH',
        failureReason: 'Normal data writes cannot penetrate the Jammer\'s broadcast frequency.',
        requiredConcept: 'Pub/Sub Channel Broadcast (PUBLISH) to disrupt the signal.',
      },
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
      {
        id: 'ds_e1',
        name: 'Queue Overlord',
        gx: 15,
        gy: 15,
        hp: 70,
        maxHp: 70,
        shieldKey: 'overlord:queue',
        spell: 'LPUSH overlord:queue spike',
        counterGem: 'RPOP',
        failureReason: 'The Overlord\'s shield is backed by a list queue that repels direct hits.',
        requiredConcept: 'Queue Consumption (RPOP or LPOP) to drain the queue shield.',
      },
      {
        id: 'ds_e2',
        name: 'Time Bomb',
        gx: 8,
        gy: 14,
        hp: 20,
        maxHp: 20,
        shieldKey: 'bomb:timer',
        spell: 'EXPIRE bomb:timer 5',
        counterGem: 'DEL',
        failureReason: 'The Time Bomb countdown cannot be stopped by normal inspection.',
        requiredConcept: 'Key Deletion (DEL) or TTL Override (EXPIRE) to defuse the bomb.',
      },
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
      {
        id: 'cg_e1',
        name: 'Partition Anomaly',
        gx: 18,
        gy: 12,
        hp: 100,
        maxHp: 100,
        shieldKey: 'anomaly:core',
        spell: 'SET anomaly:core locked',
        counterGem: 'DEL',
        failureReason: 'The Anomaly\'s slot hash isolates standard key operations.',
        requiredConcept: 'Key Purge (DEL) or Cluster Rebalancing to resolve the partition.',
      },
    ],
  },
}

export default function GameCanvas({ engine, isFullscreen, onToggleFullscreen, isTerminalDrawerOpen, onToggleTerminalDrawer }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
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
  const [showVictory, setShowVictory] = useState(false)
  const [openedChestGem, setOpenedChestGem] = useState(null)
  const [enemyImmunityOverlay, setEnemyImmunityOverlay] = useState(null)

  // Camera instance ref
  const cameraRef = useRef(new Camera({ viewportWidth: 1200, viewportHeight: 700, smoothFactor: 0.15 }))
  // Keep track of player position in ref for animation frame
  const playerRef = useRef({ gx: 2, gy: 2, targetGx: 2, targetGy: 2, animProgress: 1, facing: 'S' })

  // Switch region
  const handleRegionSelect = (regionId) => {
    setSelectedRegion(regionId)
    const map = REGION_MAPS[regionId] || REGION_MAPS['memory-village']
    setChests(map.chests)
    setEnemies(map.enemies)
    setEnemyImmunityOverlay(null)
    playerRef.current = { gx: 2, gy: 2, targetGx: 2, targetGy: 2, animProgress: 1, facing: 'S' }
    setPlayerGridPos({ gx: 2, gy: 2 })
    const initialIso = gridToIso(2, 2)
    cameraRef.current.moveTo(initialIso.x, initialIso.y)
    setBattleMessage(`Entered ${map.name}`)
  }

  // Keyboard & QWERTY Physical controls using IsometricEngineControls
  useEffect(() => {
    if (openedChestGem) return
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
  }, [terminalOpen, selectedRegion, chests, enemies, openedChestGem])

  const handleProceed = () => {
    const regionIds = Object.keys(REGION_MAPS)
    const currentIndex = regionIds.indexOf(selectedRegion)
    const nextIndex = (currentIndex + 1) % regionIds.length
    handleRegionSelect(regionIds[nextIndex])
    setShowVictory(false)
    setBattleMessage('Proceeding to next challenge!')
  }

  const openChest = (chest) => {
    chest.looted = true
    if (!inventoryGems.includes(chest.gem)) {
      setInventoryGems((prev) => [...prev, chest.gem])
    }
    setBattleMessage(`✨ Opened Chest! Acquired Command Gem: [ ${chest.gem} ]`)
    if (!store.objectiveBannerDismissed) {
      store.dismissObjectiveBanner()
    }
    if (engine) {
      engine.execute(`SET ${chest.key} "${chest.value}"`)
    }
    setOpenedChestGem(chest.gem)
  }

  const interactCurrentTile = () => {
    soundEngine.playSFX('interact')
    const p = playerRef.current
    const chest = chests.find((c) => !c.looted && c.gx === Math.round(p.gx) && c.gy === Math.round(p.gy))
    if (chest) {
      openChest(chest)
    } else {
      setBattleMessage('Searched area... No nearby objects to interact with.')
    }
  }

  // Play BGM with intensity
  useEffect(() => {
    const intensity = 1 - (enemies.filter(e => e.hp > 0).length / Math.max(1, enemies.length))
    soundEngine.playBGM(selectedRegion, intensity)
  }, [selectedRegion, enemies])

  const movePlayer = (dx, dy) => {
    soundEngine.playSFX('click')
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
          openChest(chest)
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
        setEnemyImmunityOverlay(null)

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
        setBattleMessage(`Immune to ${gem}! The boss's data structure requires a specific command type!`)
        setEnemyImmunityOverlay({
          active: true,
          command: gem,
          enemyName: activeEnemy.name,
          whyFailed: activeEnemy.failureReason || `Standard ${gem} spells bounce off ${activeEnemy.name}'s data structure shield.`,
          requiredConcept: activeEnemy.requiredConcept || `Specialized command required: ${activeEnemy.counterGem}`,
          hint: `${activeEnemy.counterGem} ${activeEnemy.shieldKey || ''}`,
        })
      }
    } else {
      setBattleMessage(`Cast ${gem} gem into the air! (No enemies in range)`)
      if (engine) {
        engine.execute(`${gem} player:action "cast"`)
      }
    }
  }

  // Quest objective completion check
  const activeEnemyCount = enemies.filter((e) => e.hp > 0).length
  const unlootedChestCount = chests.filter((c) => !c.looted).length
  const questComplete = activeEnemyCount === 0 && unlootedChestCount === 0

  useEffect(() => {
    if (questComplete && !showVictory) {
        setShowVictory(true)
    }
  }, [questComplete])

  // Map tile screenspace coordinates for HUD markers (mirrors the render loop math)
  const getTileScreenPos = (gx, gy) => {
    const map = REGION_MAPS[selectedRegion]
    const iso = gridToIso(Math.max(0, Math.min(map.width - 1, gx)), Math.max(0, Math.min(map.height - 1, gy)))
    return cameraRef.current.worldToViewport(iso.x, iso.y)
  }

  // Handle in-game diegetic terminal command submit
  const handleTerminalSubmit = (e) => {
    e.preventDefault()
    soundEngine.playSFX('click')
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

      const p = playerRef.current
      const activeEnemy = enemies.find((e) => e.hp > 0 && Math.abs(e.gx - p.gx) <= 4 && Math.abs(e.gy - p.gy) <= 4)

      if (activeEnemy) {
        if (verb === activeEnemy.counterGem || verb === 'DEL') {
          enemies.forEach((en) => {
            if ((en.shieldKey === arg1 || en.id === activeEnemy.id) && en.hp > 0) {
              en.hp = Math.max(0, en.hp - 35)
              setBattleMessage(`⚡ Terminal ${verb} breached ${en.name}'s shield!`)
            }
          })
          setEnemies([...enemies])
          setEnemyImmunityOverlay(null)
        } else {
          setBattleMessage(`Immune to ${verb}! The boss's data structure requires a specific command type!`)
          setEnemyImmunityOverlay({
            active: true,
            command: verb,
            enemyName: activeEnemy.name,
            whyFailed: activeEnemy.failureReason || `Standard ${verb} commands bounce off ${activeEnemy.name}'s data structure shield.`,
            requiredConcept: activeEnemy.requiredConcept || `Specialized command required: ${activeEnemy.counterGem}`,
            hint: `${activeEnemy.counterGem} ${activeEnemy.shieldKey || ''}`,
          })
        }
      } else if (verb === 'DEL') {
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

  // Dynamic Canvas Resizing & Camera Viewport update
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return
      const rect = container.getBoundingClientRect()
      if (rect.width && rect.height) {
        canvas.width = rect.width
        canvas.height = rect.height
        cameraRef.current.setViewportSize(rect.width, rect.height)
      }
    }
    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animationFrameId
    let lastTime = performance.now()

    const render = (time) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000)
      lastTime = time

      const map = REGION_MAPS[selectedRegion]
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Update player position smooth lerp
      const p = playerRef.current
      if (p.animProgress < 1) {
        p.animProgress = Math.min(1, p.animProgress + 0.1)
        p.gx = p.gx + (p.targetGx - p.gx) * p.animProgress
        p.gy = p.gy + (p.targetGy - p.gy) * p.animProgress
      }

      // Convert grid player position to world space for camera follow
      const playerWorldIso = gridToIso(p.gx, p.gy)
      cameraRef.current.follow(playerWorldIso)
      cameraRef.current.update(dt)

      // Apply camera view matrix transform
      cameraRef.current.applyToContext(ctx)

      // Draw isometric map tiles
      for (let gx = 0; gx < map.width; gx++) {
        for (let gy = 0; gy < map.height; gy++) {
          const iso = gridToIso(gx, gy)
          const screenX = iso.x
          const screenY = iso.y

          const isChecker = (gx + gy) % 2 === 0
          const fillColor = isChecker ? map.tileColor1 : map.tileColor2

          drawIsoTile(ctx, screenX, screenY, TILE_WIDTH, TILE_HEIGHT, fillColor, map.borderColor)
        }
      }

      // Draw chests
      chests.forEach((chest) => {
        const iso = gridToIso(chest.gx, chest.gy)
        const screenX = iso.x
        const screenY = iso.y

        if (chest.looted) {
          drawIsoBlock(ctx, screenX, screenY, 24, 12, 10, '#64748b', '#475569', '#334155')
        } else {
          drawIsoBlock(ctx, screenX, screenY, 24, 12, 14, '#f59e0b', '#d97706', '#b45309')
          // Glow dot
          ctx.fillStyle = '#fef08a'
          ctx.beginPath()
          ctx.arc(screenX, screenY - 14, 4, 0, Math.PI * 2)
          ctx.fill()

          // Pulsing quest marker arrow above unlooted chest
          const pulse = Math.sin(Date.now() / 250) * 0.5 + 0.5
          const bounce = -22 - pulse * 6
          ctx.save()
          ctx.globalAlpha = 0.6 + pulse * 0.4
          ctx.strokeStyle = '#fde047'
          ctx.fillStyle = '#fde047'
          ctx.lineWidth = 2
          // Flag pole
          ctx.beginPath()
          ctx.moveTo(screenX, screenY - 20)
          ctx.lineTo(screenX, screenY - 20 + bounce)
          ctx.stroke()
          // Arrow head
          const headY = screenY - 22 + bounce
          ctx.beginPath()
          ctx.moveTo(screenX, headY - 9)
          ctx.lineTo(screenX - 5, headY)
          ctx.lineTo(screenX + 5, headY)
          ctx.closePath()
          ctx.fill()
          // Glow halo ring
          ctx.strokeStyle = `rgba(253, 224, 71, ${0.25 + pulse * 0.25})`
          ctx.beginPath()
          ctx.arc(screenX, screenY - 10, 18 + pulse * 6, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      })

      // Draw enemies
      enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return
        const iso = gridToIso(enemy.gx, enemy.gy)
        const screenX = iso.x
        const screenY = iso.y

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

        // Pulsing quest marker arrow above active enemy
        const pulse = Math.sin(Date.now() / 220 + enemy.gx * 0.5) * 0.5 + 0.5
        const bounce = -30 - pulse * 5
        ctx.save()
        ctx.globalAlpha = 0.6 + pulse * 0.4
        ctx.strokeStyle = '#f87171'
        ctx.fillStyle = '#f87171'
        ctx.lineWidth = 2
        // Flag pole
        ctx.beginPath()
        ctx.moveTo(screenX, screenY - 34)
        ctx.lineTo(screenX, screenY - 34 + bounce)
        ctx.stroke()
        // Arrow head
        const headY = screenY - 36 + bounce
        ctx.beginPath()
        ctx.moveTo(screenX, headY - 9)
        ctx.lineTo(screenX - 5, headY)
        ctx.lineTo(screenX + 5, headY)
        ctx.closePath()
        ctx.fill()
        // Warning halo
        ctx.strokeStyle = `rgba(248, 113, 113, ${0.3 + pulse * 0.3})`
        ctx.beginPath()
        ctx.arc(screenX, screenY - 12, 24 + pulse * 6, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      })

      // Draw Player Avatar (REX / Hero)
      const pIso = gridToIso(p.gx, p.gy)
      const pScreenX = pIso.x
      const pScreenY = pIso.y

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

      // Restore camera context transform
      cameraRef.current.restoreContext(ctx)

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

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
                onClick={() => {soundEngine.playSFX('click'); handleRegionSelect(rid)}}
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
              onClick={() => {soundEngine.playSFX('nav'); onToggleFullscreen()}}
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
              soundEngine.playSFX('open')
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
      <div ref={containerRef} className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Quest Objective Banner - prominent top guidance */}
        {!store.objectiveBannerDismissed && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 max-w-[92%] w-fit px-4 py-2 bg-gradient-to-r from-cyan-950/95 via-slate-900/95 to-cyan-950/95 backdrop-blur border border-cyan-500/50 rounded-xl shadow-[0_0_24px_rgba(34,211,238,0.25)] z-20 flex items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px] font-mono text-cyan-200 leading-snug">
              <span className="font-black tracking-widest text-cyan-300">🎯 ACTIVE QUEST:</span>
              <span className="text-slate-200">Move Hero using</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-cyan-500/40 text-cyan-300 font-bold">WASD</span>
              <span className="text-slate-200">→ Walk to glowing</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/50 text-amber-300 font-bold">Chest</span>
              <span className="text-slate-200">→ Press</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-amber-400/50 text-amber-300 font-bold">E</span>
              <span className="text-slate-200">to open chest & acquire</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/50 text-emerald-300 font-bold">Command Gems</span>
              <span className="text-slate-200">→ Defeat enemies using</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/50 text-emerald-300 font-bold">Gem Hotbar</span>
              <span className="text-slate-200">/</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-amber-400/50 text-amber-300 font-bold">CLI Terminal (~)</span>
              {questComplete && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 font-black animate-pulse">✔ QUEST COMPLETE!</span>
              )}
            </div>
            <button
              onClick={() => store.dismissObjectiveBanner()}
              className="text-slate-400 hover:text-cyan-300 font-bold text-xs px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors shrink-0"
              title="Dismiss objective banner"
            >
              ✕
            </button>
          </div>
        )}

        {/* HUD Control Legends Overlay - interactive */}
        <div className="absolute top-16 left-4 flex flex-col gap-1 p-2.5 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 z-10 shadow-lg">
          <div className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase mb-0.5">Controls HUD</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => movePlayer(-1, 0)}
              title="Press W A S D to move the hero"
              className="bg-slate-800 border border-slate-700 text-cyan-300 px-1.5 py-0.5 rounded font-bold hover:bg-cyan-600/40 hover:text-white cursor-pointer transition-colors"
            >
              W A S D
            </button>
            <span>Move Hero</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => interactCurrentTile()}
              title="Walk onto a glowing chest, then press E to open it"
              className="bg-slate-800 border border-slate-700 text-amber-300 px-1.5 py-0.5 rounded font-bold hover:bg-amber-500/40 hover:text-white cursor-pointer transition-colors"
            >
              E
            </button>
            <span>Interact / Loot</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onToggleTerminalDrawer) {
                  onToggleTerminalDrawer()
                } else {
                  setTerminalOpen(!terminalOpen)
                }
              }}
              title="Toggle the Redis CLI terminal"
              className="bg-slate-800 border border-slate-700 text-emerald-300 px-1.5 py-0.5 rounded font-bold hover:bg-emerald-500/40 hover:text-white cursor-pointer transition-colors"
            >
              ~
            </button>
            <span>CLI Terminal</span>
          </div>
        </div>

        {/* Offscreen quest markers pointing toward remaining objectives */}
        {((enemies.some((e) => e.hp > 0)) || chests.some((c) => !c.looted)) && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {chests
              .filter((c) => !c.looted)
              .map((c) => {
                const t = getTileScreenPos(c.gx, c.gy)
                const off = offscreenEdge(t, cameraRef.current, canvasRef.current?.width, canvasRef.current?.height)
                if (!off) return null
                return (
                  <div
                    key={c.id}
                    className="absolute flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-400/50 text-amber-300 text-[9px] font-mono font-bold shadow-lg animate-pulse"
                    style={{ left: off.x, top: off.y }}
                  >
                    <span className="text-[10px]">🔶</span> CHEST {off.dir}
                  </div>
                )
              })}
            {enemies
              .filter((e) => e.hp > 0)
              .map((e) => {
                const t = getTileScreenPos(e.gx, e.gy)
                const off = offscreenEdge(t, cameraRef.current, canvasRef.current?.width, canvasRef.current?.height)
                if (!off) return null
                return (
                  <div
                    key={e.id}
                    className="absolute flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/15 border border-red-400/50 text-red-300 text-[9px] font-mono font-bold shadow-lg animate-pulse"
                    style={{ left: off.x, top: off.y }}
                  >
                    <span className="text-[10px]">⚔️</span> {e.name.toUpperCase()} {off.dir}
                  </div>
                )
              })}
          </div>
        )}

        {/* Strategic Immunity Hint Dialog / HUD Overlay */}
        {enemyImmunityOverlay?.active && (
          <div className="absolute top-16 right-4 max-w-sm p-3.5 bg-slate-900/95 border-2 border-red-500/80 rounded-xl shadow-[0_0_24px_rgba(239,68,68,0.4)] backdrop-blur-md z-30 font-mono text-slate-100 animate-fade-in">
            <div className="flex items-center justify-between border-b border-red-500/30 pb-1 mb-2">
              <span className="text-xs font-bold text-red-400 tracking-wider flex items-center gap-1.5">
                🛡️ SHIELD IMMUNITY DETECTED
              </span>
              <button
                onClick={() => setEnemyImmunityOverlay(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-1"
                title="Dismiss overlay"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-red-300 font-bold mb-2 leading-tight">
              Immune to {enemyImmunityOverlay.command}! The {enemyImmunityOverlay.enemyName}'s shield bounced your attack!
            </div>
            <div className="text-[10px] space-y-1.5 bg-slate-950/90 p-2.5 rounded border border-red-500/30">
              <div>
                <span className="text-amber-400 font-bold">WHY ATTACK FAILED:</span>{' '}
                <span className="text-slate-300">{enemyImmunityOverlay.whyFailed}</span>
              </div>
              <div>
                <span className="text-cyan-400 font-bold">REQUIRED STRATEGY / CONCEPT:</span>{' '}
                <span className="text-cyan-300 font-bold">{enemyImmunityOverlay.requiredConcept}</span>
              </div>
              {enemyImmunityOverlay.hint && (
                <div>
                  <span className="text-emerald-400 font-bold">COUNTER COMMAND HINT:</span>{' '}
                  <code className="text-emerald-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{enemyImmunityOverlay.hint}</code>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Battle / Interaction Banner */}
        {battleMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 backdrop-blur border border-cyan-500/50 rounded-full text-xs font-mono text-cyan-300 shadow-lg animate-fade-in">
            {battleMessage}
          </div>
        )}
        
        {/* Victory Modal */}
        <VictoryModal 
          isOpen={showVictory} 
          onProceed={handleProceed}
        />

        {/* Chest Command Learning Modal */}
        <ChestCommandModal
          isOpen={Boolean(openedChestGem)}
          onClose={() => setOpenedChestGem(null)}
          commandGem={openedChestGem}
        />

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
        <div className="absolute bottom-4 left-36 right-36 flex flex-col items-center justify-center gap-1 pointer-events-auto z-20">
          <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest bg-slate-900/80 px-2 py-0.5 rounded border border-amber-500/20 shadow-md">
            Command Gem Hotbar
          </span>
          <div className="flex gap-2 p-2 bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl overflow-x-auto max-w-full">
            {inventoryGems.map((gem, idx) => (
              <button
                key={idx}
                onClick={() => castGem(gem)}
                className="group relative flex flex-col items-center justify-center min-w-[48px] w-12 h-12 bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/40 rounded-lg hover:border-cyan-400 hover:scale-105 active:scale-95 transition-all shadow-md shrink-0"
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
              <button onClick={() => {soundEngine.playSFX('close'); setTerminalOpen(false)}} className="text-slate-400 hover:text-white text-xs">✕ CLOSE (~)</button>
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
