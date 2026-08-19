# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.

## Audio System
- Located in `src/audio/SoundEngine.js`.
- Uses Web Audio API for SFX and procedural chiptune BGM.
- Subscribes to `gameStore` for audio settings (toggles, volume).
- Initialized in `App.jsx`.

## Inventory & Chest System
- Inventory modal in `src/components/InventoryModal.jsx` (toggled via `I` hotkey or HUD button).
- Chest Command educational overlay modal in `src/components/ChestCommandModal.jsx` with data in `src/data/chestCommands.js`.

## Incident Engine & Evaluator
- Located in `src/systems/incidents/`.
- Manages incident lifecycle (`IncidentEngine.js`), objective predicates on `MockRedisEngine` (`IncidentEvaluator.js`), and definition registration (`IncidentRegistry.js`).

## Scoring & Progression Systems
- Incident performance scoring in `src/systems/scoring/ScoreEngine.js`.
- Per-command mastery tracking in `src/systems/progression/MasteryEngine.js`.

## Hint Engine System
- Located in `src/systems/hints/HintEngine.js`.
- Provides 3-tier progressive hints (Observation, Concept, Command Shape), score penalty tracking, and REX dialogue triggers (`onSymptom`, `onCommandResult`, `getHint`), integrated into `src/components/RexPanel.jsx`.

## Incident HUD & Visual Indicators
- Incident HUD in `src/components/IncidentPanel.jsx` with `PressureMeter.jsx` and `SystemHealth.jsx`.

## World Reactions & Consequence System
- Consequence events handled via `src/systems/consequences/ConsequenceEngine.js`.
- Dynamic visual world states (API Gate, Cache Corruption, Shield Expiry, Queue Conveyor) resolved via `src/systems/consequences/WorldStateResolver.js`.
- Rendered in `src/components/GameCanvas.jsx` using `src/game/IsometricRenderer.js`.

## Streams, Eviction & Latency
- Streams in `src/engine/datatypes/Stream.js` (`StreamId`, `RedisStream`, `ConsumerGroup`) and `src/engine/commands/streams.js`.
- Eviction policies in `src/engine/eviction.js`; `engine.maxmemoryPolicy` drives `engine.maybeEvict()`, called once per command.
- Per-command cost model in `src/engine/latency.js`; read latency from `engine.lastCommandCostMs` or the `command` event's `costMs`.
- Real hit/miss stats via `engine._readIntent` (see `engine.hitRatio()`); blocking commands (`BLPOP`/`BZPOPMIN`) return `{ type: 'blocked', resumeOn, timeoutAt }`, not nil.

## 3D Mode (Protocol Zero)
- Lives entirely under `src/game3d/`, lazy-loaded from `App.jsx` via `React.lazy`. Never shares state with the 2D game — see `claude-plan-pro.md` section 5 and `pro-instruct.md` Laws L3-L6.
- Owns its own engine/store/save namespace: `src/game3d/bootstrap.js` (`createRuntime()`), `src/game3d/state/game3dStore.js`, `src/game3d/state/persistence3d.js` (`redis-quest:3d:` prefix).
- Build sequence and every task's exact contract: `pro-instruct.md`. Progress tracked in `BUILD-STATUS.md`.
