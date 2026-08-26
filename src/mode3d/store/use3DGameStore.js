import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

const initialState = () => ({
  // ---- lifecycle / mode ----
  modeActive: false,
  paused: false,
  phase: 'hub',                 // 'hub' | 'briefing' | 'playing' | 'loopTransition' | 'victory' | 'defeat'
  loadingProgress: 0,

  // ---- LOOP STATE (time-loop horror) ----
  loop: {
    count: 0,
    maxLoops: 7,
    snapshotRDB: null,
    retainedSkills: [],
    retainedTerminalHistory: [],
    branchingFlags: {},
    anomaliesSeen: {},
    sanityBaseline: 100,
  },

  // ---- PLAYER STATE ----
  player: {
    health: 100, maxHealth: 100,
    stamina: 100, maxStamina: 100,
    position: [0, 1.7, 0],
    rotationYaw: 0, pitch: 0,
    velocity: [0, 0, 0],
    grounded: true,
    crouching: false, sprinting: false,
    inventory: [],
    activeWeapon: 'plasma',
    weapons: {
      plasma: { ammo: 120, maxAmmo: 120, heat: 0, lastFire: 0 },
      cyberdeck: { charges: 8, maxCharges: 8, cooldown: 0 },
    },
    fallStartY: null, fallVelocity: 0,
    recoilOffset: [0, 0],
    headBobPhase: 0,
  },

  // ---- MISSION STATE ----
  mission: {
    id: null,
    name: '', subtitle: '',
    objectives: [],
    timer: 0,
    timerMax: 0,
    pressure: 0,
    pressureThreshold: 75,
    failed: false, completed: false,
    startedAt: 0,
    timeTookMs: 0,
  },

  // ---- ENEMY STATE ----
  enemies: {
    active: [],
    spawnedCount: 0,
    killedCount: 0,
    alertsActive: 0,
  },

  // ---- ENVIRONMENT STATE ----
  environment: {
    rooms: {},
    doors: {},
    corruptionZones: [],
    lighting: { ambient: 0.15, flicker: 0, blackoutUntil: 0 },
    globalCorruption: 0,
    powerState: 'online',
  },

  // ---- TERMINAL STATE (persists across loops!) ----
  terminal: {
    history: [],
    input: '',
    macros: {},
    autocomplete: true,
    open: false,
    lastReply: null,
  },

  // ---- AUDIO STATE ----
  audio: {
    currentZone: 'ambient',
    tension: 0,
    stingerQueue: [],
    masterMuted: false,
    ducking: 0,
  },

  // ---- NARRATIVE ----
  narrative: {
    currentBeat: null,
    pendingChoices: [],
    rexLine: null,
  },
})

const createActions = (set, get) => ({
  // ---- MODE LIFECYCLE ----
  enterMode3D: () => set({ modeActive: true, phase: 'hub', loadingProgress: 0 }),
  exitMode3D: () => set({ modeActive: false, phase: 'hub' }),
  setPhase: (phase) => set({ phase }),
  setLoadingProgress: (p) => set({ loadingProgress: p }),
  setPaused: (p) => set({ paused: p }),

  // ---- LOOP STATE ----
  startLoop: (missionId, engine) => {
    const snapshot = engine ? engine.save() : null
    set((state) => ({
      loop: {
        ...state.loop,
        count: state.loop.count + 1,
        snapshotRDB: snapshot,
        retainedSkills: state.loop.retainedSkills,
        retainedTerminalHistory: state.loop.retainedTerminalHistory,
        branchingFlags: state.loop.branchingFlags,
        anomaliesSeen: state.loop.anomaliesSeen,
        sanityBaseline: Math.max(50, state.loop.sanityBaseline - state.loop.count * 5),
      },
      mission: { ...initialState().mission, id: missionId, startedAt: Date.now() },
      player: { ...initialState().player, position: [0, 1.7, 0] },
      enemies: { ...initialState().enemies },
      environment: { ...initialState().environment },
      narrative: { ...initialState().narrative },
      phase: 'briefing',
    }))
  },

  rollbackLoop: (engine) => {
    const { loop } = get()
    if (loop.snapshotRDB && engine) {
      engine.restore(loop.snapshotRDB)
    }
    set((state) => ({
      loop: {
        ...state.loop,
        count: state.loop.count + 1,
        snapshotRDB: null,
      },
      mission: { ...initialState().mission },
      player: { ...initialState().player, position: [0, 1.7, 0] },
      enemies: { ...initialState().enemies },
      environment: { ...initialState().environment },
      narrative: { ...initialState().narrative },
      phase: 'loopTransition',
    }))
  },

  retainSkill: (skillId) => set((state) => ({
    loop: {
      ...state.loop,
      retainedSkills: [...new Set([...state.loop.retainedSkills, skillId])],
    },
  })),

  addBranchingFlag: (key, value) => set((state) => ({
    loop: {
      ...state.loop,
      branchingFlags: { ...state.loop.branchingFlags, [key]: value },
    },
  })),

  recordAnomalySeen: (anomalyId) => set((state) => ({
    loop: {
      ...state.loop,
      anomaliesSeen: { ...state.loop.anomaliesSeen, [anomalyId]: (state.loop.anomaliesSeen[anomalyId] || 0) + 1 },
    },
  })),

  // ---- PLAYER ----
  playerDamage: (amount) => set((state) => ({
    player: {
      ...state.player,
      health: Math.max(0, state.player.health - amount),
    },
  })),

  playerHeal: (amount) => set((state) => ({
    player: {
      ...state.player,
      health: Math.min(state.player.maxHealth, state.player.health + amount),
    },
  })),

  setPlayerPosition: (pos) => set((state) => ({
    player: { ...state.player, position: pos },
  })),

  setPlayerRotation: (yaw, pitch) => set((state) => ({
    player: { ...state.player, rotationYaw: yaw, pitch },
  })),

  setPlayerVelocity: (vel) => set((state) => ({
    player: { ...state.player, velocity: vel },
  })),

  setGrounded: (g) => set((state) => ({
    player: { ...state.player, grounded: g },
  })),

  setSprinting: (s) => set((state) => ({
    player: { ...state.player, sprinting: s },
  })),

  setCrouching: (c) => set((state) => ({
    player: { ...state.player, crouching: c },
  })),

  spendStamina: (amount) => set((state) => ({
    player: {
      ...state.player,
      stamina: Math.max(0, state.player.stamina - amount),
    },
  })),

  regenStamina: (dt) => set((state) => ({
    player: {
      ...state.player,
      stamina: Math.min(state.player.maxStamina, state.player.stamina + dt * 12),
    },
  })),

  firePlasma: () => set((state) => ({
    player: {
      ...state.player,
      weapons: {
        ...state.player.weapons,
        plasma: {
          ...state.player.weapons.plasma,
          ammo: Math.max(0, state.player.weapons.plasma.ammo - 1),
          heat: Math.min(100, state.player.weapons.plasma.heat + 8),
          lastFire: Date.now(),
        },
      },
    },
  })),

  fireCyberDeck: (cmd) => set((state) => ({
    player: {
      ...state.player,
      weapons: {
        ...state.player.weapons,
        cyberdeck: {
          ...state.player.weapons.cyberdeck,
          charges: Math.max(0, state.player.weapons.cyberdeck.charges - 1),
          cooldown: Date.now() + 3000,
        },
      },
    },
  })),

  recoilKick: (amount = 1) => set((state) => ({
    player: {
      ...state.player,
      recoilOffset: [
        state.player.recoilOffset[0] + (Math.random() - 0.5) * amount * 0.02,
        state.player.recoilOffset[1] - amount * 0.015,
      ],
    },
  })),

  advanceHeadBob: (phase) => set((state) => ({
    player: { ...state.player, headBobPhase: phase },
  })),

  // ---- MISSION ----
  setMission: (missionDef) => set({
    mission: {
      id: missionDef.id,
      name: missionDef.name,
      subtitle: missionDef.subtitle,
      objectives: missionDef.objectives.map(o => ({ ...o, done: false })),
      timer: missionDef.timeLimit || 0,
      timerMax: missionDef.timeLimit || 0,
      pressure: 0,
      pressureThreshold: missionDef.pressureThreshold || 75,
      failed: false,
      completed: false,
      startedAt: Date.now(),
      timeTookMs: 0,
    },
  }),

  addObjective: (obj) => set((state) => ({
    mission: {
      ...state.mission,
      objectives: [...state.mission.objectives, { ...obj, done: false }],
    },
  })),

  completeObjective: (id) => set((state) => ({
    mission: {
      ...state.mission,
      objectives: state.mission.objectives.map(o => o.id === id ? { ...o, done: true } : o),
    },
  })),

  tickMission: (dt) => set((state) => {
    const m = state.mission
    if (m.timer > 0) {
      const newTimer = Math.max(0, m.timer - dt)
      return {
        mission: {
          ...m,
          timer: newTimer,
          timeTookMs: m.timeTookMs + dt * 1000,
        },
      }
    }
    return { mission: { ...m, timeTookMs: m.timeTookMs + dt * 1000 } }
  }),

  addPressure: (amount) => set((state) => ({
    mission: {
      ...state.mission,
      pressure: Math.min(100, state.mission.pressure + amount),
    },
  })),

  reducePressure: (amount) => set((state) => ({
    mission: {
      ...state.mission,
      pressure: Math.max(0, state.mission.pressure - amount),
    },
  })),

  failMission: () => set((state) => ({
    mission: { ...state.mission, failed: true },
    phase: 'defeat',
  })),

  completeMission: () => set((state) => ({
    mission: { ...state.mission, completed: true },
    phase: 'victory',
  })),

  // ---- ENEMIES ----
  spawnEnemy: (spec) => set((state) => ({
    enemies: {
      ...state.enemies,
      active: [...state.enemies.active, { ...spec, id: `enemy_${state.enemies.spawnedCount}` }],
      spawnedCount: state.enemies.spawnedCount + 1,
    },
  })),

  updateEnemy: (id, patch) => set((state) => ({
    enemies: {
      ...state.enemies,
      active: state.enemies.active.map(e => e.id === id ? { ...e, ...patch } : e),
    },
  })),

  killEnemy: (id) => set((state) => ({
    enemies: {
      ...state.enemies,
      active: state.enemies.active.filter(e => e.id !== id),
      killedCount: state.enemies.killedCount + 1,
      alertsActive: Math.max(0, state.enemies.alertsActive - 1),
    },
  })),

  setEnemyState: (id, newState) => set((state) => ({
    enemies: {
      ...state.enemies,
      active: state.enemies.active.map(e =>
        e.id === id ? { ...e, state: newState, ...(newState === 'alert' && { target: 'player' })} : e
      ),
      alertsActive: state.enemies.active.filter(e => e.id === id ? newState === 'alert' || newState === 'chase' : e.state === 'alert' || e.state === 'chase').length,
    },
  })),

  // ---- ENVIRONMENT ----
  setRoomState: (roomId, patch) => set((state) => ({
    environment: {
      ...state.environment,
      rooms: { ...state.environment.rooms, [roomId]: { ...state.environment.rooms[roomId], ...patch } },
    },
  })),

  lockDoor: (doorId) => set((state) => ({
    environment: {
      ...state.environment,
      doors: { ...state.environment.doors, [doorId]: { ...state.environment.doors[doorId], locked: true, open: false } },
    },
  })),

  openDoor: (doorId) => set((state) => ({
    environment: {
      ...state.environment,
      doors: { ...state.environment.doors, [doorId]: { ...state.environment.doors[doorId], locked: false, open: true } },
    },
  })),

  addCorruptionZone: (zone) => set((state) => ({
    environment: {
      ...state.environment,
      corruptionZones: [...state.environment.corruptionZones, { ...zone, id: zone.id || `cz_${Date.now()}` }],
      globalCorruption: Math.min(100, state.environment.globalCorruption + (zone.intensity || 10)),
    },
  })),

  tickCorruption: (dt) => set((state) => {
    const growth = dt * 2
    return {
      environment: {
        ...state.environment,
        globalCorruption: Math.min(100, state.environment.globalCorruption + growth),
        corruptionZones: state.environment.corruptionZones.map(z => ({
          ...z,
          radius: Math.min(z.radius + dt * 0.5, 15),
        })),
      },
    }
  }),

  setLighting: (patch) => set((state) => ({
    environment: {
      ...state.environment,
      lighting: { ...state.environment.lighting, ...patch },
    },
  })),

  setPowerState: (state) => set((s) => ({
    environment: { ...s.environment, powerState: state },
  })),

  // ---- TERMINAL ----
  pushTerminalLine: (line, reply) => set((state) => ({
    terminal: {
      ...state.terminal,
      history: [...state.terminal.history, { line, reply, ts: Date.now() }],
      lastReply: reply,
      input: '',
    },
  })),

  setTerminalInput: (input) => set((state) => ({
    terminal: { ...state.terminal, input },
  })),

  addMacro: (name, command) => set((state) => ({
    terminal: { ...state.terminal, macros: { ...state.terminal.macros, [name]: command } },
  })),

  toggleTerminal: () => set((state) => ({
    terminal: { ...state.terminal, open: !state.terminal.open },
  })),

  // ---- AUDIO ----
  setAmbienceZone: (zoneId) => set((state) => ({
    audio: { ...state.audio, currentZone: zoneId },
  })),

  setTension: (t) => set((state) => ({
    audio: { ...state.audio, tension: Math.max(0, Math.min(1, t)) },
  })),

  queueStinger: (stingerId) => set((state) => ({
    audio: { ...state.audio, stingerQueue: [...state.audio.stingerQueue, { id: stingerId, at: Date.now() }] },
  })),

  consumeStinger: () => set((state) => ({
    audio: { ...state.audio, stingerQueue: state.audio.stingerQueue.slice(1) },
  })),

  setDucking: (d) => set((state) => ({
    audio: { ...state.audio, ducking: Math.max(0, Math.min(1, d)) },
  })),

  // ---- NARRATIVE ----
  setStoryBeat: (beat) => set((state) => ({
    narrative: { ...state.narrative, currentBeat: beat },
  })),

  setRexLine: (line) => set((state) => ({
    narrative: { ...state.narrative, rexLine: line },
  })),

  addPendingChoice: (choice) => set((state) => ({
    narrative: { ...state.narrative, pendingChoices: [...state.narrative.pendingChoices, choice] },
  })),

  clearPendingChoices: () => set((state) => ({
    narrative: { ...state.narrative, pendingChoices: [] },
  })),
})

export const use3DGameStore = create(
  subscribeWithSelector((set, get) => ({
    ...initialState(),
    ...createActions(set, get),
  }))
)