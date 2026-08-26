import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { use3DGameStore } from '../../stores/use3DGameStore'
import { Anomaly } from './Anomaly'
import { getAnomalyType } from './anomalyTypes'
import { MISSION_DEFS } from '../world/levels'

export function EnemyManager() {
  const rapier = useRapier()
  const {
    mission,
    enemies,
    spawnEnemy,
    updateEnemy,
    killEnemy,
    environment,
    player,
  } = use3DGameStore.getState()

  const missionDef = useRef(null)
  const spawnTimerRef = useRef(0)
  const waveTimerRef = useRef(0)
  const waveIndexRef = useRef(0)

  // Initialize mission def
  useEffect(() => {
    if (mission.id) {
      missionDef.current = MISSION_DEFS[mission.id]
    }
  }, [mission.id])

  // Main spawn/update loop
  useFrame((state, dt) => {
    if (!rapier.world || !missionDef.current || mission.phase !== 'playing') return

    const def = missionDef.current
    const activeEnemies = enemies.active
    const maxEnemies = def.maxEnemies || 15

    // Wave spawning logic
    if (def.waves && def.waves.length > 0) {
      waveTimerRef.current += dt
      const currentWave = def.waves[waveIndexRef.current]
      if (currentWave && waveTimerRef.current >= currentWave.delay) {
        spawnWave(currentWave)
        waveIndexRef.current++
        waveTimerRef.current = 0
      }
    } else {
      // Continuous spawn pressure
      spawnTimerRef.current += dt
      const spawnRate = Math.max(1, 10 - mission.pressure * 0.1)
      if (activeEnemies.length < maxEnemies && spawnTimerRef.current >= spawnRate) {
        spawnRandomEnemy()
        spawnTimerRef.current = 0
      }
    }

    // Environmental pressure spawns
    if (mission.pressure > 50 && Math.random() < dt * 0.1) {
      spawnPressureEnemy()
    }

    // Despawn far enemies (optional optimization)
    activeEnemies.forEach(enemy => {
      const dist = Math.hypot(
        enemy.position[0] - player.position[0],
        enemy.position[2] - player.position[2]
      )
      if (dist > 80 && enemy.state !== 'chase') {
        // Despawn and respawn closer later
        killEnemy(enemy.id)
      }
    })
  })

  const spawnWave = (wave) => {
    wave.spawns.forEach((spawn, i) => {
      setTimeout(() => {
        spawnEnemy({
          id: `${wave.id}_${i}_${Date.now()}`,
          type: spawn.type,
          position: spawn.position || getRandomSpawnPosition(spawn.room),
          health: getAnomalyType(spawn.type).hp,
          maxHealth: getAnomalyType(spawn.type).maxHp,
          state: 'patrol',
          target: null,
          lastAttack: 0,
          stunTimer: 0,
          splitCooldown: 0,
        })
      }, i * 200)
    })
  }

  const spawnRandomEnemy = () => {
    const def = missionDef.current
    if (!def || !def.enemyTypes || def.enemyTypes.length === 0) return

    const type = def.enemyTypes[Math.floor(Math.random() * def.enemyTypes.length)]
    const anomalyType = getAnomalyType(type)
    const position = getRandomSpawnPosition()

    spawnEnemy({
      id: `enemy_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type,
      position,
      health: anomalyType.hp,
      maxHealth: anomalyType.maxHp,
      state: 'patrol',
      target: null,
      lastAttack: 0,
      stunTimer: 0,
      splitCooldown: 0,
    })
  }

  const spawnPressureEnemy = () => {
    const def = missionDef.current
    if (!def || !def.pressureEnemyTypes) return

    const type = def.pressureEnemyTypes[Math.floor(Math.random() * def.pressureEnemyTypes.length)]
    const anomalyType = getAnomalyType(type)
    // Spawn near player but not too close
    const angle = Math.random() * Math.PI * 2
    const distance = 15 + Math.random() * 10
    const position = [
      player.position[0] + Math.cos(angle) * distance,
      player.position[1],
      player.position[2] + Math.sin(angle) * distance,
    ]

    spawnEnemy({
      id: `pressure_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type,
      position,
      health: anomalyType.hp,
      maxHealth: anomalyType.maxHp,
      state: 'alert',
      target: 'player',
      lastAttack: 0,
      stunTimer: 0,
      splitCooldown: 0,
    })
  }

  const getRandomSpawnPosition = (roomId = null) => {
    const rooms = Object.values(environment.rooms)
    const room = roomId ? environment.rooms[roomId] : rooms[Math.floor(Math.random() * rooms.length)]
    if (!room) return [0, 1, 0]

    const padding = 2
    return [
      room.center[0] + (Math.random() - 0.5) * (room.size[0] - padding),
      room.center[1] || 1,
      room.center[2] + (Math.random() - 0.5) * (room.size[2] - padding),
    ]
  }

  // Render active enemies
  return (
    <group>
      {enemies.active.map((enemy, index) => (
        <Anomaly key={enemy.id} anomaly={enemy} index={index} />
      ))}
    </group>
  )
}