# redis-quest — 3D AAA Netrunner Horror Mode: "LOOP // NULL_POINTER"

## Context & Problem

The existing redis-quest is a 2D isometric educational game teaching Redis through incidents, boss battles, and a skill tree. The user requested a **standalone 3D AAA fast-paced mystery/horror netrunner shooting game mode** that:

1. **Teaches production Redis skills** through gameplay mechanics (cache stampede, rate limiting, memory eviction, stream queues, cluster failover)
2. **Features a time-loop horror narrative** ("LOOP // NULL_POINTER") where player death triggers a BGSAVE snapshot rollback, preserving unlocked skills, terminal history, and psychological progression
3. **Delivers studio-level AAA visual/audio quality** using React Three Fiber, post-processing, Rapier physics, and aggressive spatial Web Audio
4. **Is a separate mode** toggled from App.jsx alongside the existing 2D mode
5. **Targets desktop web (high-end GPU)**

This plan covers the complete architecture for the 3D mode, reusing the existing `MockRedisEngine`, `ConsequenceEngine`, `WorldStateResolver`, `IncidentEngine`, and `gameStore` skill progression.

---

## A. File Structure

All new code lives under `src/mode3d/` to keep the mode isolated and tree-shakeable.

```
src/mode3d/
├── index.js                      // public barrel export for the 3D mode
├── Mode3DApp.jsx                 // top-level R3F <Canvas> root + mode bootstrap
│
├── store/
│   ├── use3DGameStore.js         // ★ Zustand store: all 3D state (see section B)
│   └── selectors.js              // memoized derived selectors + hooks
│
├── engine/
│   ├── Mode3DEngineProvider.js   // creates/owns the dedicated 3D MockRedisEngine
│   ├── RedisWorldResolver.js     // extends WorldStateResolver for 3D entities
│   ├── RedisConsequenceBridge.js // adapts ConsequenceEngine rules → 3D effects
│   ├── LoopSnapshotSystem.js     // BGSAVE/RDB snapshot save+restore across loops
│   └── SkillBridge.js            // reads gameStore skill tree → 3D loadout/perks
│
├── physics/
│   ├── PhysicsWorld.jsx          // <Physics> wrapper (Rapier), gravity, debug
│   └── constants.js              // collision groups, layer masks, materials
│
├── player/
│   ├── FPSController.jsx         // ★ pointer-lock + Rapier kinematic capsule
│   ├── useKeyboardControls.js    // WASD/Sprint/Crouch/Jump input mapping
│   ├── useMouseLook.js           // sensitivity/inversion, pointer lock API
│   ├── StaminaSystem.js          // sprint drain / regen state machine
│   ├── HeadBob.js                // procedural camera bob + recoil spring
│   └── PlayerState.js            // health/stamina/inventory/weapon runtime model
│
├── weapons/
│   ├── PlasmaCutter.jsx          // primary: raycast hitscan + recoil + ammo
│   ├── CyberDeck.jsx             // secondary: fires Redis commands as projectiles
│   ├── useRaycastWeapon.js       // shared Rapier raycast + hit resolution
│   └── ProjectileRedis.jsx       // redis-command projectile (visual + payload)
│
├── enemies/
│   ├── EnemyManager.jsx          // spawns + ticks all anomalies
│   ├── Anomaly.jsx               // single anomaly: mesh + physics + AI
│   ├── anomalyAI.js              // ★ FSM: patrol→alert→chase→attack→stun→death
│   ├── anomalyTypes.js           // data table of 5+ enemy archetypes
│   └── Ragdoll.jsx               // death physics (Rapier joints or impulse)
│
├── world/
│   ├── LevelLoader.jsx           // picks mission, mounts rooms/corridors/racks
│   ├── levels/
│   │   ├── index.js              // MISSION_DEFS registry (5 missions)
│   │   ├── cacheStampede.js      // Mission 1
│   │   ├── rateLimitSiege.js     // Mission 2
│   │   ├── memoryLeakCrisis.js   // Mission 3
│   │   ├── deadLetterPipeline.js // Mission 4
│   │   └── splitBrainFailover.js // Mission 5 (boss)
│   ├── ServerRack.jsx            // instanced rack mesh + interactive panels
│   ├── Door.jsx                  // lockable door driven by redis key state
│   ├── CorruptionZone.jsx        // shader volume affecting sanity/post-fx
│   ├── Hazard.jsx                // electrical, coolant, crush hazards
│   └── props/
│       ├── TerminalConsole.jsx   // in-world redis terminal kiosk
│       └── LockPanel.jsx         // SETNX/lock interaction surface
│
├── hud/
│   ├── VisorHUD.jsx              // ★ diegetic 3D visor (Html or shader plane)
│   ├── HealthStaminaAmmo.jsx     // holographic bars (drei <Billboard>)
│   ├── EmbeddedTerminal.jsx      // in-visor terminal → engine → response
│   ├── ObjectiveTracker.jsx      // mission checklist ribbon
│   ├── RadarMinimap.jsx          // top-down blip projection
│   └── SanityMeter.jsx           // corruption/sanity → post-fx intensity
│
├── postfx/
│   ├── PostFXPipeline.jsx        // ★ ordered EffectComposer chain
│   ├── effects.config.js         // per-state effect parameters
│   └── useDynamicPostFX.js       // binds game state → effect uniforms
│
├── audio/
│   ├── Audio3DEngine.js          // ★ extends SoundEngine with PannerNode graph
│   ├── AmbienceZones.js          // per-room atmospheric loops + zone triggers
│   ├── StingerQueue.js           // jump-scare / alert one-shots
│   └── LoopTransition.js         // reverse-tape / bass-drop time-loop audio
│
├── narrative/
│   ├── LoopDirector.jsx          // orchestrates loop count, branching, rollback
│   ├── BranchingTree.js          // decision graph + flags
│   ├── StoryBeats.js             // scripted dialogue / environmental narrative
│   └── Rex3D.js                  // REX companion VO in 3D space
│
├── systems/
│   ├── MissionSystem.js          // objective lifecycle, timers, pressure
│   ├── TimePressureSystem.js     // countdown + escalation → incident engine
│   ├── SanitySystem.js           // corruption accumulation → post-fx/audio
│   └── DiegeticTerminalBridge.js // routes HUD terminal to engine + consequence
│
└── ui/
    ├── Mode3DLoader.jsx          // suspense fallback / loading screen
    ├── Mode3DHub.jsx             // mission select + briefings (pre-loop)
    └── LoopTransitionOverlay.jsx // reverse-tape visual on death/rollback
```

**Dependency layers (no cycles):**
- `store` depends on `engine` types only via actions, never on React.
- `player`/`weapons`/`enemies` depend on `store` + `physics` + `engine`.
- `world` depends on `store` + `engine` + `physics`.
- `hud`/`postfx` depend on `store` + `audio` (read-only).
- `narrative`/`systems` depend on `store` + `engine`.
- `Mode3DApp.jsx` wires everything and mounts `<Canvas>`.

**Reused as-is from the existing app:**
- `src/engine/engine.js` (`MockRedisEngine`), `src/engine/registry.js`, `src/engine/reply.js`
- `src/systems/consequences/ConsequenceEngine.js`, `WorldStateResolver.js`
- `src/systems/incidents/IncidentEngine.js`, `IncidentEvaluator.js`
- `src/store/gameStore.js` (for skill tree / XP carry-over)
- `src/audio/SoundEngine.js` (extended, not replaced)

---

## B. 3D Game Store (`use3DGameStore.js`)

A single Zustand store (separate slice from `gameStore`, not merged, to keep the 2D app hot-path untouched). Initial state shape:

```js
const initialState = () => ({
  // ---- lifecycle / mode ----
  modeActive: false,            // 3D mode mounted
  paused: false,
  phase: 'hub',                 // 'hub' | 'briefing' | 'playing' | 'loopTransition' | 'victory' | 'defeat'
  loadingProgress: 0,

  // ---- LOOP STATE (time-loop horror) ----
  loop: {
    count: 0,                  // how many times we've died/rolled back
    maxLoops: 7,               // soft cap; beyond = "NULL_POINTER" ending
    snapshotRDB: null,         // base BGSAVE snapshot (engine.save) at loop start
    retainedSkills: [],        // skill ids persisted across loops (from gameStore)
    retainedTerminalHistory: [], // command lines typed in prior loops (persist!)
    branchingFlags: {},        // { savedCoworker:true, killedSentinel:false, ... }
    anomaliesSeen: {},         // id -> count (psychological progression)
    sanityBaseline: 100,       // carries between loops (learned resilience)
  },

  // ---- PLAYER STATE ----
  player: {
    health: 100, maxHealth: 100,
    stamina: 100, maxStamina: 100,
    position: [0, 1.7, 0],     // world-space [x,y,z]; y=capsule center
    rotationYaw: 0, pitch: 0,
    velocity: [0, 0, 0],       // for fall-damage tracking
    grounded: true,
    crouching: false, sprinting: false,
    inventory: [],             // [{ id, name, type:'key'|'module'|'relic' }]
    activeWeapon: 'plasma',    // 'plasma' | 'cyberdeck'
    weapons: {
      plasma: { ammo: 120, maxAmmo: 120, heat: 0, lastFire: 0 },
      cyberdeck: { charges: 8, maxCharges: 8, cooldown: 0 },
    },
    fallStartY: null, fallVelocity: 0,
    recoilOffset: [0, 0],      // spring state for view kick
    headBobPhase: 0,
  },

  // ---- MISSION STATE ----
  mission: {
    id: null,                  // current MISSION_DEFS id
    name: '', subtitle: '',
    objectives: [],            // [{ id, label, done, predicate }]
    timer: 0,                  // seconds remaining (0 = none)
    timerMax: 0,
    pressure: 0,               // 0..100 (drives incident escalation)
    pressureThreshold: 75,
    failed: false, completed: false,
    startedAt: 0,
    timeTookMs: 0,
  },

  // ---- ENEMY STATE ----
  enemies: {
    active: [],                // [{ id, type, position, health, state, target }]
    spawnedCount: 0,
    killedCount: 0,
    alertsActive: 0,           // how many currently chasing
  },

  // ---- ENVIRNMENT STATE ----
  environment: {
    rooms: {},                 // roomId -> { name, locked, corruption, ambience }
    doors: {},                 // doorId -> { locked, open, key }
    corruptionZones: [],       // [{ id, center, radius, intensity }]
    lighting: { ambient: 0.15, flicker: 0, blackoutUntil: 0 },
    globalCorruption: 0,       // 0..100 world rot
    powerState: 'online',      // 'online'|'brownout'|'offline'
  },

  // ---- TERMINAL STATE (persists across loops!) ----
  terminal: {
    history: [],               // [{ line, reply, ts }] — retained across loops
    input: '',
    macros: {},                // name -> command string
    autocomplete: true,
    open: false,               // visor terminal focus
    lastReply: null,
  },

  // ---- AUDIO STATE ----
  audio: {
    currentZone: 'ambient',    // ambience zone id
    tension: 0,                // 0..1 dynamic music intensity
    stingerQueue: [],           // pending one-shots [{ id, at }]
    masterMuted: false,
    ducking: 0,                // 0..1 sfx duck amount
  },

  // ---- NARRATIVE ----
  narrative: {
    currentBeat: null,
    pendingChoices: [],
    rexLine: null,
  },
})
```

**Key actions (selected — full set in implementation):**
- `enterMode3D()`, `exitMode3D()`, `setPhase(p)`
- `startLoop(missionId)` → snapshots RDB, resets player/mission, increments `loop.count`
- `rollbackLoop()` → `engine.restore(snapshotRDB)`, rehydrate `retainedSkills/terminal`, branch on flags
- `playerDamage(n)`, `playerHeal(n)`, `setPlayerPosition(v)`, `setPlayerVelocity(v)`
- `spendStamina(n)`, `regenStamina(dt)`, `setSprinting/ setCrouching`
- `firePlasma()`, `fireCyberDeck(cmd)`, `recoilKick(amount)`
- `addObjective/completeObjective(id)`, `tickMission(dt)`, `failMission()`, `completeMission()`
- `spawnEnemy(spec)`, `updateEnemy(id, patch)`, `killEnemy(id)`, `setEnemyState(id,s)`
- `setRoomState/lockDoor/openDoor`, `addCorruptionZone`, `tickCorruption(dt)`
- `pushTerminalLine(line, reply)`, `setTerminalInput`, `addMacro`, `toggleTerminal`
- `setAmbienceZone`, `setTension`, `queueStinger`, `setDucking`
- `retainSkill(id)` (called from SkillBridge), `addBranchingFlag(k,v)`

**Selectors (`selectors.js`):** `usePlayerVitals`, `useActiveObjectives`, `useThreatLevel` (alertsActive + pressure), `useSanity` (combination of player.health, loop.anomaliesSeen, environment.globalCorruption), `useCurrentMissionDef`, `useVisibleEnemies`.

---

## C. FPS Controller Design

**Movement model** — Rapier `RigidBody` with `type: 'kinematicPosition'` (capsule collider, radius 0.35, half-height 0.6). Kinematic avoids jitter and lets us apply our own acceleration/friction while still colliding with walls/doors.

- `useKeyboardControls` maps: `W/A/S/D` → move vector, `Shift` → sprint, `C`/`Ctrl` → crouch, `Space` → jump (only when `grounded`).
- `useMouseLook` requests `Pointer Lock` on canvas click; reads `movementX/Y`, applies `sensitivity` (store setting) and `invertY`. Yaw on body, pitch on camera.
- **Per-frame in `FPSController.jsx`:**
  1. Read input → desired horizontal velocity (walk 4.5 m/s, sprint 7.5, crouch 2.2).
  2. Stamina gate: sprint disabled if stamina < 5; drains 18/s, regens 12/s otherwise.
  3. Jump: if grounded & Space pressed, set vertical velocity = 6.5 m/s; gravity (-18 m/s²) integrated each frame; `grounded` recomputed from raycast down.
  4. Write `nextPos = currentPos + velocity*dt` to `rigidBody.setNextKinematicTranslation`.
  5. **Fall damage**: track `fallVelocity`; on landing if impact speed > 12 m/s, `playerDamage((speed-12)*4)`.
- **Recoil**: `PlasmaCutter` calls `store.recoilKick()`; `HeadBob` applies a spring (critically-damped) to camera pitch + positional kick, decaying ~120ms.
- **Head bob**: sine on `headBobPhase` advanced by horizontal speed; amplitude scaled by sprint/crouch; zeroed when airborne.
- **Pointer lock integration**: `document.pointerLockElement` check; on `pointerlockchange` set `paused` if unlocked mid-play. Escape releases lock → pause menu.

---

## D. Level Architecture (5 Missions)

Each level file exports a `MISSION_DEF`: `{ id, name, subtitle, rooms[], spawn[], objectives[], enemies[], hazards[], puzzles[], boss?, timePressure, redisTeaching, victory, failure, branching }`. Rooms are box volumes with instanced `ServerRack` walls; corridors connect them; doors gate progression and are driven by redis keys via `Door.jsx`.

### Mission 1 — CACHE STAMPEDE (SETNX / distributed locking)
- **Layout**: "Cooling Wing" — 3 cold-aisle rooms joined by a long corridor; central "Lock Console" (LockPanel) and 4 cache-node racks.
- **Redis taught**: `SETNX lock:cache:rebuild 1` (acquire), `EXPIRE` to avoid deadlock, `DEL` to release, `GET` to inspect holder. Stampede of duplicate "request" NPCs floods if lock not held → they overload the player.
- **Enemy**: *Stampeder* (fast, low-HP wave entity) — spawning surges when lock free.
- **Puzzle**: Hold the lock (`SETNX` succeeds only once), then `DEL` to release after draining the queue; failing to release before timer → corridor collapse.
- **Boss**: none.
- **Victory**: acquire lock, drain `cache:requests` list to 0, survive 90s.
- **Failure**: health 0, or lock held > 30s (deadlock → power loss).
- **Time pressure**: 90s window; pressure rises if `LLEN cache:requests` stays high.

### Mission 2 — RATE LIMIT SIEGE (ZSET sliding window / Lua)
- **Layout**: "Edge Gateway" — gatehouse with 5 ingress lanes; each lane is a ZSET `ratelimit:ip:<n>`. Siege cannon (hazard) fires when a lane exceeds quota.
- **Redis taught**: `ZADD ratelimit:ip:1 <nowMs> reqId`, `ZREMRANGEBYSCORE` to slide the window, `ZCARD` to count, and a `EVAL` Lua script doing atomic check+add.
- **Enemy**: *Siege Drone* (ranged, telegraphs, spawns per overflow lane).
- **Puzzle**: Write the Lua sliding-window script once, `EVAL` it per request spike; mismanaged windows trigger the cannon.
- **Boss**: none (escalates into Mission 5 themes).
- **Victory**: keep all 5 lanes under quota for 60s.
- **Failure**: health 0, or 3 lanes breached simultaneously.
- **Time pressure**: continuous; `ZCARD` over threshold drives `pressure`.

### Mission 3 — MEMORY LEAK CRISIS (LRU/LFU, UNLINK, MEMORY USAGE)
- **Layout**: "Core Vault" — circular room of 64 memory banks; central `MEMORY USAGE` readout; leaking "Sludge" puddles (CorruptionZone) grow.
- **Redis taught**: `MEMORY USAGE key`, `CONFIG SET maxmemory`, `UNLINK` (async free) vs `DEL`, `OBJECT FREQ` (LFU), `MAXMEMORY-POLICY allkeys-lru`. Banks overflow → room fills with corruption.
- **Enemy**: *Sludge Blob* (slow, splits on hit, thrives in corruption zones).
- **Puzzle**: Use `MEMORY USAGE` to find fat keys, `UNLINK` the heaviest, set policy to reclaim; mis-prioritizing wastes time as sludge spreads.
- **Boss**: none.
- **Victory**: bring `MEMORY USAGE` total under budget AND clear all sludge.
- **Failure**: globalCorruption hits 100, or health 0.
- **Time pressure**: corruption growth rate; `environment.globalCorruption` climbs.

### Mission 4 — DEAD LETTER PIPELINE (Streams XADD/XREADGROUP/XACK/XPENDING)
- **Layout**: "Conveyor Catacombs" — processing floor with a stream console and a "Dead Letter" vault at the far end; blocked consumers spawn *Phantom Consumers*.
- **Redis taught**: `XADD stream:orders * field val`, `XGROUP CREATE`, `XREADGROUP GROUP g c COUNT 10`, `XACK`, `XPENDING` to find stuck messages, `XCLAIM` to redeliver.
- **Enemy**: *Phantom Consumer* (steals unacked messages, becomes hostile).
- **Puzzle**: Read group, process, `XACK`; `XPENDING` reveals orphans → `XCLAIM` them into the dead-letter stream. Stuck > N messages → vault surge.
- **Boss**: none.
- **Victory**: stream drained, `XPENDING` == 0, dead-letter vault sealed.
- **Failure**: health 0, or pending messages exceed cap (catacomb flood).
- **Time pressure**: pending-message backlog timer.

### Mission 5 — SPLIT-BRAIN FAILOVER (CLUSTER FAILOVER, MULTI/EXEC, sentinel)
- **Layout**: "Nexus Chamber" — two redundant node clusters (Master/Replica) bridged by a fragile link; a Sentinel pylon; the *NULL_POINTER* anomaly as boss.
- **Redis taught**: `CLUSTER FAILOVER`, `MULTI`/`EXEC` (atomic promote), `WATCH`/`UNWATCH` (optimistic lock), sentinel `SENTINEL failover`. Split-brain occurs if both nodes think they're master.
- **Enemy**: *NULL_POINTER* boss — large corrupted entity; phases tied to cluster state (healthy → split-brain → reunified).
- **Puzzle**: Detect split-brain (`CLUSTER INFO` shows two masters), use `WATCH master:epoch` + `MULTI`/`EXEC` to safely demote one, then `CLUSTER FAILOVER` to heal. Wrong order → boss enrages.
- **Boss**: yes — 3 phases, each gated by a correct cluster command sequence.
- **Victory**: cluster reunified, sentinel green, boss dissipated.
- **Failure**: health 0, or split-brain unresolved past timer (total datacenter loss).
- **Time pressure**: failover SLA countdown; `pressure` spikes on divergence.

**All five share:** spawn-safe room, diegetic terminal console reachable, corruption zones tied to failure states, and loop-branching hooks (e.g., saving a coworker NPC in M1 sets `branchingFlags.savedCoworker`, altering M5 ending).

---

## E. Weapon & Combat System

**PlasmaCutter (primary)** — `PlasmaCutter.jsx` + `useRaycastWeapon.js`:
- On fire: Rapier `world.castRay(origin, dir, maxToi)` from camera; first hit → enemy rigidbody or world. `store.firePlasma()` decrements ammo, applies recoil.
- Damage resolved in `anomalyAI` (hit → health -= dmg, state→stun briefly).
- Heat mechanic: sustained fire raises `weapons.plasma.heat`; at 100 → forced cooldown.

**CyberDeck (secondary)** — `CyberDeck.jsx` + `ProjectileRedis.jsx`:
- Fires a "command bolt": captures the *currently queued terminal command* (or a quick-select), spawns a slow projectile; on impact it `engine.rawExecute(cmd)` and emits a `consequence` (reusing ConsequenceEngine rules → world reacts).
- Example: `DEL anomaly:shield` bolt strips a boss shield in-world.
- Charges regen over time; thematically the "spell" weapon.

**Enemy AI FSM** (`anomalyAI.js`) — states: `PATROL → ALERT (heard/saw player) → CHASE → ATTACK (in range) → STUNNED (hit) → DEATH/RAGDOLL`. Transitions driven by distance, line-of-sight raycast, and `store.enemies` patches. `Ragdoll.jsx` converts the capsule to a dynamic body with impulse on death for a brief physics flop, then fades.

`anomalyTypes.js` data table maps each mission's enemy to stats: HP, speed, damage, sense radius, attack cooldown, corruption affinity.

---

## F. Diegetic HUD Design (VisorHUD)

Rendered in 3D space, not screen HTML, so it feels part of the helmet:
- `VisorHUD.jsx` mounts a curved plane attached to the camera (child of the camera rig) using a `RenderTexture`/drei `<Hud>` layer, OR drei `<Html transform>` for crisp text. **Recommendation:** a separate orthographic `<Hud>` scene for bars + terminal (always readable), with subtle 3D framing geometry (visor rim, scanlines).
- `HealthStaminaAmmo.jsx`: holographic bars as `Billboard` meshes with shader glow; color shifts red as health drops (drives no post-fx itself, but feeds SanityMeter).
- `EmbeddedTerminal.jsx`: the diegetic terminal. Input captured via an invisible DOM `<input>` synced to `Terminal` component logic; submits to `DiegeticTerminalBridge` → `engine.execute` → response rendered back into the visor plane. History persists across loops (`store.terminal.history`).
- `ObjectiveTracker.jsx`: vertical ribbon listing `mission.objectives` with check states; updates from `MissionSystem`.
- `RadarMinimap.jsx`: top-down blip projection of enemies/doors using store data.
- `SanityMeter.jsx`: corruption/sanity value → modulates post-fx intensity (section G) and audio tension (section H); visually a fracturing ring.

---

## G. Post-Processing Pipeline

Ordered `EffectComposer` chain (R3F `@react-three/postprocessing`):
1. `RenderPass` (auto)
2. `SSAO` — radius 0.1, intensity 2.5, samples 16 (datacenter depth cueing)
3. `Bloom` — luminanceThreshold 0.65, intensity 0.9 (neon panels, plasma)
4. `DepthOfField` — subtle, focus on mid-distance (horror isolation)
5. `ChromaticAberration` — offset base 0.0008, **scales with sanity** (up to 0.006)
6. `Noise` / `FilmGrain` — opacity 0.08, blends additive (VHS/datacenter cam)
7. `Vignette` — darkness 0.5, **intensifies with corruption**
8. `ColorGrading`/tint — desaturate + green/red shift as sanity drops

`useDynamicPostFX.js` binds: `sanity` → chromatic aberration + vignette + grain; `playerDamage event` → brief bloom flash + trauma shake (camera); `loopTransition` phase → full desaturate + reverse-scanline sweep. Performance: disable SSAO/DoF below a GPU tier check; cap pixel ratio at 1.5; `multisampling={0}` with FXAA pass.

---

## H. Audio 3D Engine Design

Extends existing `SoundEngine` (keeps 2D SFX/BGM), adds a **spatial graph**:
- `AudioContext` + `PannerNode` (HRTF) per positioned source; listener updated each frame from camera position/orientation (`audioCtx.listener.setPosition/orientation`).
- `playSpatial(type, position)` for diegetic sources: server hum (looped oscillator + filtered noise per rack cluster), cooling fans (band-passed noise), electrical buzz (square + ring-mod), enemy vocalizations (granular/stretch).
- `AmbienceZones.js`: each room has an ambient loop; crossing a room boundary crossfades zones. Zone defines base tension.
- **Dynamic music layers**: tension (0..1 from `store.audio.tension`) mixes stems (drone → pulse → arp → percussion) via gain ramps.
- `StingerQueue.js`: jump-scare / alert one-shots pushed by `store.queueStinger` (enemy ALERT, door lock, boss phase). Plays immediately, interrupts ducking.
- `LoopTransition.js`: on death/rollback, plays reverse-tape effect (buffer played backward) + sub-bass drop, synced with `LoopTransitionOverlay` visual.

Reuse: `SoundEngine.playSFX/playBGM` still valid for UI; new methods layered on top.

---

## I. Integration Points

1. **Engine reuse** — `Mode3DEngineProvider` creates a *dedicated* `MockRedisEngine` (separate instance so 2D progress isn't disturbed). `bindEngine(engine)` pattern mirrored: the 3D store references it; `DiegeticTerminalBridge` executes lines through `engine.execute` exactly like `gameStore.runCommand`.
2. **Consequence → 3D** — `RedisConsequenceBridge` registers 3D-specific rules (extending `DEFAULT_CONSEQUENCE_RULES`) whose `getPayload` dispatches to `store` actions: e.g. `DEL anomaly:shield` → `updateEnemy(id,{state:'stunned'})`; `SET api:gate:mode open` → `openDoor`. The existing `ConsequenceEngine` evaluates on every engine `change`, so world reactions are automatic.
3. **WorldStateResolver reuse** — `RedisWorldResolver` subclasses it, adding `resolveCorruptionState`, `resolveDoorState`, `resolveAnomalyShield(key)` used by `Door.jsx` / `CorruptionZone.jsx` / `Anomaly.jsx`. Same key→entity mapping idiom.
4. **Skill tree carry-over** — `SkillBridge` reads `useGameStore.getState().unlockedSkills` at `enterMode3D`; maps e.g. `tangler-slayer` → +plasma damage, `warden-slayer` → +maxStamina, etc. Persisted into `loop.retainedSkills` so they survive rollback.
5. **Mode switching UX (App.jsx)** — add a 3D mode entry to `SIDE_TABS` (e.g. `mode3d`) and a `Mode3DHub`. Clicking it sets a top-level `appMode` state; `App` renders `<Mode3DApp>` instead of the 2D `GameCanvas` tree. Pointer-lock and R3F `<Canvas>` mount only in 3D mode (lazy `React.lazy` + `Suspense` to keep bundle split). Exit returns to 2D with engine state intact (separate instances, no bleed).

---

## J. Performance Budget

- **Target**: 60 FPS on high-end desktop GPU (RTX 3060+/equivalent), 1080p–1440p.
- **Poly budget**: ~1.2M tris on screen; static racks/rooms pre-baked LODs.
- **LOD**: 3 levels per prop via `drei <Detailed>`; swap at 15m / 40m.
- **Instancing**: all `ServerRack` instances (often 100+) via `instancedMesh` / `drei <Instances>`; one draw call per rack variant.
- **Texture atlas**: rack panels, floor tiles, signage packed into 2–3 2048² atlases; `MeshStandardMaterial` with `aoMap`/`emissiveMap` channels.
- **Occlusion culling**: Rapier/three frustum cull (default) + portal-based room culling — only the current + adjacent room meshes mounted (LevelLoader unmounts far rooms). Lights baked per-room; dynamic lights capped at 4 per room.
- **Physics**: fixed 60Hz Rapier step decoupled from render; sleep bodies when idle.
- **Post-fx**: pixelRatio cap 1.5, drop SSAO/DoF on low FPS (adaptive via `useFrame` FPS sampler feeding `useDynamicPostFX`).

---

## Implementation Sequencing

1. `package.json` deps: `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `@react-three/postprocessing`, `three`.
2. `Mode3DEngineProvider` + `RedisWorldResolver` + `RedisConsequenceBridge` (engine reuse, the hardest integration risk — validate first).
3. `use3DGameStore` + `selectors` (state contract everything else depends on).
4. `FPSController` + `PhysicsWorld` (movement feel before content).
5. One mission (M1 Cache Stampede) end-to-end: level, terminal, enemy, HUD, post-fx.
6. `Audio3DEngine` spatial layer + `LoopDirector` + `LoopSnapshotSystem`.
7. Remaining 4 missions, boss (M5), narrative branching.
8. Performance pass (instancing, LOD, culling, adaptive post-fx).

---

### Critical Files for Implementation
- `/home/akshh16/firstmate/projects/redis-quest/src/mode3d/store/use3DGameStore.js`
- `/home/akshh16/firstmate/projects/redis-quest/src/mode3d/engine/RedisConsequenceBridge.js`
- `/home/akshh16/firstmate/projects/redis-quest/src/mode3d/player/FPSController.jsx`
- `/home/akshh16/firstmate/projects/redis-quest/src/mode3d/hud/VisorHUD.jsx`
- `/home/akshh16/firstmate/projects/redis-quest/src/mode3d/world/levels/index.js`