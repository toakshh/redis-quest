import { createSelector } from 'zustand/middleware'
import { use3DGameStore } from './use3DGameStore'

// Base selectors
const selectPlayer = (state) => state.player
const selectMission = (state) => state.mission
const selectEnemies = (state) => state.enemies
const selectEnvironment = (state) => state.environment
const selectLoop = (state) => state.loop
const selectTerminal = (state) => state.terminal
const selectAudio = (state) => state.audio
const selectNarrative = (state) => state.narrative
const selectPhase = (state) => state.phase
const selectPaused = (state) => state.paused
const selectModeActive = (state) => state.modeActive

// Player vitals selector
export const usePlayerVitals = () => use3DGameStore(
  createSelector(selectPlayer, (p) => ({
    health: p.health,
    maxHealth: p.maxHealth,
    healthPct: p.health / p.maxHealth,
    stamina: p.stamina,
    maxStamina: p.maxStamina,
    staminaPct: p.stamina / p.maxStamina,
    position: p.position,
    rotationYaw: p.rotationYaw,
    pitch: p.pitch,
    grounded: p.grounded,
    crouching: p.crouching,
    sprinting: p.sprinting,
    velocity: p.velocity,
    activeWeapon: p.activeWeapon,
    weapons: p.weapons,
    isDead: p.health <= 0,
    canSprint: p.stamina >= 5 && p.grounded && !p.crouching,
  }))
)

// Active objectives
export const useActiveObjectives = () => use3DGameStore(
  createSelector(selectMission, (m) => m.objectives.filter(o => !o.done))
)

// All objectives
export const useAllObjectives = () => use3DGameStore(
  createSelector(selectMission, (m) => m.objectives)
)

// Mission info
export const useMissionInfo = () => use3DGameStore(
  createSelector(selectMission, (m) => ({
    id: m.id,
    name: m.name,
    subtitle: m.subtitle,
    timer: m.timer,
    timerMax: m.timerMax,
    pressure: m.pressure,
    pressureThreshold: m.pressureThreshold,
    failed: m.failed,
    completed: m.completed,
    timeTookMs: m.timeTookMs,
    pressurePct: m.pressure / 100,
  }))
)

// Threat level: enemies chasing + mission pressure
export const useThreatLevel = () => use3DGameStore(
  createSelector(selectEnemies, selectMission, (e, m) => ({
    alertsActive: e.alertsActive,
    spawnedCount: e.spawnedCount,
    killedCount: e.killedCount,
    activeCount: e.active.length,
    pressure: m.pressure,
    isHighThreat: e.alertsActive > 0 || m.pressure >= m.pressureThreshold,
  }))
)

// Sanity: combines player health, anomalies seen, global corruption
export const useSanity = () => use3DGameStore(
  createSelector(selectPlayer, selectLoop, selectEnvironment, (p, l, env) => {
    const healthFactor = p.health / p.maxHealth
    const anomalyFactor = 1 - Math.min(1, Object.values(l.anomaliesSeen).reduce((a, b) => a + b, 0) * 0.02)
    const corruptionFactor = 1 - env.globalCorruption / 100
    const sanity = Math.round((healthFactor * 0.4 + anomalyFactor * 0.3 + corruptionFactor * 0.3) * 100)
    return {
      value: sanity,
      isCritical: sanity < 25,
      isLow: sanity < 50,
      factors: { healthFactor, anomalyFactor, corruptionFactor },
    }
  })
)

// Current mission definition (from registry - will be populated by MissionSystem)
export const useCurrentMissionDef = () => use3DGameStore(
  createSelector(selectMission, (m) => m.id)
)

// Visible enemies (for HUD radar)
export const useVisibleEnemies = () => use3DGameStore(
  createSelector(selectEnemies, (e) => e.active.filter(en => en.state !== 'patrol' && en.state !== 'dead'))
)

// Terminal state
export const useTerminalState = () => use3DGameStore(
  createSelector(selectTerminal, (t) => ({
    history: t.history,
    input: t.input,
    macros: t.macros,
    autocomplete: t.autocomplete,
    open: t.open,
    lastReply: t.lastReply,
  }))
)

// Loop state
export const useLoopState = () => use3DGameStore(
  createSelector(selectLoop, (l) => ({
    count: l.count,
    maxLoops: l.maxLoops,
    retainedSkills: l.retainedSkills,
    retainedTerminalHistory: l.retainedTerminalHistory,
    branchingFlags: l.branchingFlags,
    anomaliesSeen: l.anomaliesSeen,
    sanityBaseline: l.sanityBaseline,
    isFinalLoop: l.count >= l.maxLoops,
  }))
)

// Environment
export const useEnvironment = () => use3DGameStore(
  createSelector(selectEnvironment, (e) => ({
    rooms: e.rooms,
    doors: e.doors,
    corruptionZones: e.corruptionZones,
    lighting: e.lighting,
    globalCorruption: e.globalCorruption,
    powerState: e.powerState,
  }))
)

// Audio state
export const useAudioState = () => use3DGameStore(
  createSelector(selectAudio, (a) => ({
    currentZone: a.currentZone,
    tension: a.tension,
    stingerQueue: a.stingerQueue,
    masterMuted: a.masterMuted,
    ducking: a.ducking,
  }))
)

// Narrative
export const useNarrative = () => use3DGameStore(
  createSelector(selectNarrative, (n) => ({
    currentBeat: n.currentBeat,
    pendingChoices: n.pendingChoices,
    rexLine: n.rexLine,
  }))
)

// Phase and paused
export const useGamePhase = () => use3DGameStore(selectPhase)
export const useIsPaused = () => use3DGameStore(selectPaused)
export const useIsModeActive = () => use3DGameStore(selectModeActive)

// Enemy by ID
export const useEnemy = (id) => use3DGameStore(
  createSelector(selectEnemies, (e) => e.active.find(en => en.id === id))
)

// Door state
export const useDoorState = (doorId) => use3DGameStore(
  createSelector(selectEnvironment, (e) => e.doors[doorId] || { locked: false, open: false, key: null })
)

// Room state
export const useRoomState = (roomId) => use3DGameStore(
  createSelector(selectEnvironment, (e) => e.rooms[roomId] || { name: roomId, locked: false, corruption: 0, ambience: 'ambient' })
)