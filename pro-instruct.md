# PRO-INSTRUCT
## Machine-Executable Build Manual — Redis Quest: Protocol Zero (3D Mode)

**Companion document:** [claude-plan-pro.md](claude-plan-pro.md) — the *what* and *why*.
**This document:** the *how*. Written to be executed by a mid- or low-capability coding model (7B–34B class) with no design judgement required and no room for interpretation.

**Revision:** 1.0 · 2026-08-19 · targets repo state at commit `9e95e0b`

---

# PART A — OPERATING MANUAL

## A.0 What this document is

A sequence of **atomic task cards**. Each card is a complete, self-contained work order: which files to read, which file to create, the exact contract of every export, and a shell command that proves the work is correct.

**A weak model can build a strong game if, and only if, it is never asked to decide anything.** Every design decision in this build has already been made. The model's job is transcription and verification, not invention.

### Rules for the human operator

1. **One task card per model session.** Do not paste two cards into one conversation. Context contamination is the single largest cause of failure with small models.
2. **Paste the session preamble (§A.1) at the top of every session.** Every time. No exceptions.
3. **Then paste exactly one task card.** Nothing else.
4. **Run the acceptance command yourself.** Do not trust the model's claim that it passed.
5. **If acceptance fails twice, do not let the model keep trying.** Go to the Failure Playbook (§F). Small models loop.
6. **Commit after every green task card.** `git commit -m "T-XXX: <title>"`. This gives a rollback point per task.
7. **Never skip a task card.** Dependencies are strict and stated.

### Progress tracking

Maintain `BUILD-STATUS.md` in the repo root. One line per task:

```
T-001  DONE      2026-08-19  commit a1b2c3d
T-002  DONE      2026-08-19  commit e4f5g6h
T-003  IN-PROG
T-004  TODO
```

---

## A.1 SESSION PREAMBLE — paste this verbatim at the top of every model session

```
You are a code-transcription agent working in the repository at
E:\personal projects\redis-quest

You will receive exactly ONE task card. Execute only that card. Do not
start the next one. Do not refactor anything the card does not name.

ABSOLUTE RULES:
1. Read ONLY the files listed under "READ FIRST". Reading other files
   wastes context and causes errors.
2. Never invent an API. If you need a function that is not in the API
   Reference Card given to you, STOP and output:
   "BLOCKED: need API <name>, not in reference card."
3. Never modify a file that is not listed under CREATE or MODIFY.
4. Never delete or rewrite an existing test.
5. Never add an npm dependency unless the card says to.
6. Write JavaScript, not TypeScript. No type annotations.
7. Match the code style contract exactly (given below).
8. After writing code, output the exact acceptance command and nothing
   else. Do not claim it passes. The operator runs it.
9. If the card is ambiguous to you, STOP and output:
   "BLOCKED: ambiguous at <quote the line>."
   A blocked task is a good outcome. A guessed task is a bad outcome.

CODE STYLE CONTRACT (this repository, non-negotiable):
- ES modules. `import` / `export`. No `require`.
- NO SEMICOLONS at end of statements.
- 2-space indentation. Never tabs.
- Single quotes for strings. Backticks only for interpolation.
- `const` by default, `let` when reassigned, never `var`.
- Named exports. `export function foo() {}` or `export const FOO = ...`.
- Every file opens with a `//` comment block (2-6 lines) saying what the
  file is for and how it fits the system.
- Function names: camelCase. Classes: PascalCase. Constants: SCREAMING_SNAKE.
- File names: PascalCase.js for classes, camelCase.js for function modules,
  PascalCase.jsx for React components.
- No `console.log` in committed code. `console.error` is allowed in catch
  blocks only.
- No trailing whitespace. File ends with exactly one newline.

STYLE EXAMPLE — correct:
  // SpatialHash — uniform-grid broadphase for enemy proximity queries.
  // Sim layer: no three.js, no DOM.

  const CELL_SIZE = 4

  export function createSpatialHash(cellSize = CELL_SIZE) {
    const cells = new Map()
    return { cells, cellSize }
  }

STYLE EXAMPLE — wrong (semicolons, tabs, default export, var):
  var x = 1;
  export default function foo() {
  	return x;
  }
```

---

## A.2 THE TWENTY-TWO HARD LAWS

These are enforced by automated tests written in Phase 0. A violation fails the build.

| # | Law |
|---|---|
| **L1** | No file under `src/game3d/sim/` may import `three`, `@react-three/*`, or `react`. |
| **L2** | No file under `src/game3d/sim/` may reference `window`, `document`, `navigator`, or `localStorage`. |
| **L3** | No file under `src/game3d/` may import `../store/gameStore.js`. |
| **L4** | No file under `src/game3d/` may import `../audio/SoundEngine.js`. |
| **L5** | No file under `src/game3d/` may import an exported *singleton*: `eventBus`, `incidentEngine`, `soundEngine`, `defaultMasteryEngine`, `worldStateResolver`, `consequenceEngine`. Importing the *class* is required and correct. |
| **L6** | The 3D mode creates its own engine with `createEngine()`. It never receives an engine as a prop from `App.jsx`. |
| **L7** | All 3D persistence keys begin with `3d:` (the store prefix makes them `redis-quest:3d:`). |
| **L8** | No gameplay state may live in a `.jsx` file. `.jsx` files render and dispatch intents. Nothing else. |
| **L9** | No `useState` for anything that changes more than 10 times per second. Use refs. |
| **L10** | No allocation inside `useFrame` or inside any `sim.step()`. Pre-allocate in the constructor. |
| **L11** | Every `new` inside a hot loop is a bug. Pool it. |
| **L12** | Every `addEventListener` has a matching `removeEventListener` in the same cleanup. |
| **L13** | Every `setTimeout`/`setInterval`/`requestAnimationFrame` is cancelled on unmount. |
| **L14** | Every three.js `geometry`, `material` and `texture` created imperatively is `.dispose()`d on unmount. |
| **L15** | Existing tests must stay green. `npm test` reports **614 passed** before Phase 1, and never fewer thereafter. |
| **L16** | Every new module ships with a test file in the same commit. |
| **L17** | Sim tests run in the `node` environment. They must never need a GL context, jsdom, or a mock canvas. |
| **L18** | Randomness comes only from `createRng(seed)`. Never `Math.random()` inside `sim/`. |
| **L19** | Time comes only from the injected clock. Never `Date.now()` inside `sim/`. |
| **L20** | Content lives in `src/game3d/content/` as data. Never as code inside a system. |
| **L21** | Every player-visible string is defined in a content file, never inline in a component. |
| **L22** | Every asset file added under `public/assets3d/` has a matching row in `ASSETS_LICENSES.md` in the same commit. |

---

## A.3 THE TASK LOOP — the model runs these eight steps for every card

```
1. READ    the files named in READ FIRST. Only those.
2. RESTATE the contract in one sentence. If you cannot, output BLOCKED.
3. WRITE   the test file first, if the card names one.
4. WRITE   the implementation file.
5. CHECK   your file against the Code Style Contract, line by line.
6. CHECK   your file against the Hard Laws that the card lists.
7. OUTPUT  the acceptance command.
8. STOP.   Do not begin the next task.
```

---

## A.4 VERIFICATION COMMANDS

Run from the repository root.

**Full suite (must always pass):**
```bash
npm test
```

**Single test file (fast iteration):**
```bash
npx vitest run src/game3d/__tests__/isolation.test.js
```

**A whole directory:**
```bash
npx vitest run src/game3d
```

**Build check (catches import errors the tests miss):**
```bash
npm run build
```

**Dev server for visual checks:**
```bash
npm run dev
```

**PowerShell equivalents** — identical; these commands are cross-platform. Do not use `&&` in PowerShell; run each on its own line or use `;`.

---

## A.5 API REFERENCE CARD

**This is the complete list of existing APIs the model is permitted to call.** Anything not on this card does not exist. If a task needs something not listed, the model must output `BLOCKED`.

### Engine — `src/engine/engine.js`

```js
import { createEngine, MockRedisEngine, HISTORY_LIMIT, checkArity } from '../engine/engine.js'

createEngine({ memoryLimit, now, seed }) -> MockRedisEngine
   // memoryLimit: bytes, default 10 * 1024 * 1024
   // now: () => number, injectable clock. null = Date.now()
   // seed: any, null = Math.random

engine.execute(line)                  -> reply     // parses a full command line
engine.rawExecute(cmd, ...args)       -> reply     // programmatic, emits 'command'
engine.silentExecute(cmd, ...args)    -> reply     // programmatic, does NOT emit 'command'
engine.on(event, fn)                  -> unsubscribeFn
engine.off(event, fn)                 -> void
engine.emit(event, payload)           -> void
engine.now()                          -> number
engine.random()                       -> number in [0,1)
engine.snapshot()                     -> plain JSON object
engine.restore(snapshot)              -> engine

engine.store                          -> Map  (the ACTIVE db only)
engine.databases                      -> Map<number, Map>
engine.activeDb                       -> number
engine.memoryBytes                    -> number  (getter, cached)
engine.memoryLimit                    -> number  (get/set)
engine.commandHistory                 -> array of { seq, raw, command, args, reply, timestamp }
engine.commandRegistry                -> Map<string, fn>

engine._get(key)                      -> entry | null   (applies lazy expiry)
engine._entryForWrite(key, type)      -> { entry, created } | { wrongType: true }
engine._clearTtl(entry)               -> void
engine._touch(key, entry)             -> void
engine._bump(key, entry)              -> void   (version++, lru, cache dirty)
engine._delete(key)                   -> boolean
engine._sweepExpired()                -> void

engine.stats = {
  totalCommands, totalErrors, keysCreated, keysExpired, memoryPeak,
  multiBatches, scriptsRun, commandsByType, opsPerSecond,
  commandsPerMinute, startedAt, _lastCommandTime
}
```

**Entry shape** (the value stored in `engine.store`):
```js
{ type, value, expiresAt, version, lruTick, lruTickTime }
// type: 'string' | 'hash' | 'list' | 'set' | 'zset'
// expiresAt: absolute ms timestamp, or null
// lruTick: engine.stats.totalCommands at last touch
// lruTickTime: engine.now() at last touch
```

**Engine events** (`engine.on(...)`):
```
'command'  -> { name, args, reply }   name is UPPERCASE canonical
'change'   -> undefined
'error'    -> undefined
'expired'  -> { keys: string[] }
'message'  -> { channel, message, count }
```

### Reply helpers — `src/engine/reply.js`

```js
okReply()                 -> { type: 'simple',  value: 'OK' }
simpleReply(v)            -> { type: 'simple',  value: v }
errorReply(msg)           -> { type: 'error',   value: msg }
integerReply(n)           -> { type: 'integer', value: n }
bulkReply(s)              -> { type: 'bulk',    value: s }
nilReply()                -> { type: 'nil',     value: null }
arrayReply(items)         -> { type: 'array',   value: items }
emptyArrayReply()         -> { type: 'array',   value: [] }
wrongArity(commandName)   -> error reply
wrongType()               -> error reply
noSuchKey()               -> error reply
unknownCommand(name)      -> error reply
syntaxError()             -> error reply
invalidInt()              -> error reply
invalidExpire()           -> error reply
intValue(reply)           -> number
```

### Command registration — `src/engine/registry.js`

```js
import { cmd } from '../registry.js'

export const MYCOMMAND = cmd({
  arity: -3,        // positive = exact arg count INCLUDING command name
                    // negative = minimum arg count
  syntax: 'MYCOMMAND key value [value ...]',
  summary: 'One sentence, ends with a period.',
  group: 'streams',
  examples: ['MYCOMMAND foo bar'],
})((engine, args) => {
  // args[0] is the command name. args[1] is the first argument.
  return okReply()
})
```

A new command **module** is picked up only after it is added to the `groups` array in `src/engine/registry.js`.

### RNG — `src/engine/rng.js`

```js
createRng(seed)   -> () => number in [0,1)   // seed null/undefined -> Math.random
mulberry32(int)   -> () => number
hash32(string)    -> uint32
```

### Game loop — `src/game/GameLoop.js`

```js
new GameLoop({ onUpdate, onRender, targetFps = 60, maxAccumSeconds = 0.25 })
loop.start()            // uses requestAnimationFrame
loop.stop()
loop.step(dtSeconds)    // manual advance, for headless tests
loop.running            -> boolean
loop.fps                -> number
loop.dt                 -> number (fixed timestep, seconds)
// onUpdate(dt)         dt in seconds, fixed
// onRender(alpha)      alpha in [0,1] interpolation factor
```

### Event bus — `src/engine/EventBus.js`

```js
import { EventBus } from '../../engine/EventBus.js'    // the CLASS. never the singleton.

const bus = new EventBus({ logSize: 500 })
bus.on(type, fn)                  -> unsubscribeFn      // exact string, or '*'
bus.subscribe(type, fn, opts)     -> unsubscribeFn      // type may contain * and ?
bus.once(type, fn)                -> unsubscribeFn
bus.off(type, fn)
bus.emit({ type, payload, source }) -> normalizedEvent
bus.publish(type, payload, source)  -> normalizedEvent
bus.recent(n)                     -> array, newest first
bus.log                           -> array
bus.toJSON()                      -> array
bus.clear()
// normalized event: { type, seq, timestamp, source, payload }
```

### Objective predicates — `src/systems/incidents/IncidentEvaluator.js`

```js
import { evaluatePredicate, evaluateObjectives } from '.../IncidentEvaluator.js'

evaluatePredicate(pred, engine)         -> boolean
evaluateObjectives(objectives, engine)  -> { allPassed, statusMap }

// existing predicate types:
// keyEquals, keyExists, keyNotExists, ttlBetween, listLengthBelow,
// setContains, setNotContains, hashFieldEquals, hashFieldNotExists,
// sortedSetTop, custom
```

### Incident lifecycle — `src/systems/incidents/IncidentEngine.js`

```js
import { IncidentEngine, INCIDENT_STATES } from '.../IncidentEngine.js'   // the CLASS

const inc = new IncidentEngine(engine)
inc.startIncident(definition, engine)   -> activeIncident
inc.stopIncident()
inc.tick(deltaMs)
inc.onCommandExecuted(cmd, args, result, engine)
inc.adjustHealth(delta)     // clamps 0..100
inc.adjustPressure(delta)   // clamps 0..100
inc.setState(state)
inc.getState()              -> string
inc.on(event, fn)           -> unsubscribeFn
// events: incidentStarted, incidentStopped, stateChange, healthChange,
//         pressureChange, objectiveChange, objectivesUpdated, resolved,
//         failed, tick
// INCIDENT_STATES: DORMANT ACTIVE ESCALATING MITIGATED RESOLVED FAILED RECOVERING
```

### Memory accounting — `src/engine/datatypes/memory.js`

```js
MEMORY_CONSTANTS = {
  KEY_ENTRY: 48, HASH_FIELD: 64, LIST_NODE: 56, SET_MEMBER: 56,
  ZSET_NODE: 128, ZSET_SCORE: 16, DEFAULT_MEMORY_LIMIT: 10485760
}
utf8Bytes(str) · stringBytes(v) · hashBytes(map) · listBytes(list)
setBytes(set) · zsetBytes(skiplist) · valueMemoryBytes(type, value)
entryMemoryBytes(name, entry) · totalMemoryBytes(store) · formatBytes(n)
```

### Persistence — `src/store/persistence.js`

```js
load(key, fallback)   // reads localStorage 'redis-quest:' + key
save(key, value)
remove(key)
// The 3D mode wraps these with a '3d:' key prefix. See T-006.
```

---

# PART B — PHASE 0 · FOUNDATIONS AND GUARD RAILS

**Goal:** the guard rails exist before any code that could violate them.
**Exit:** T-001 … T-012 all green, `npm test` reports ≥ 614 passing, `npm run build` succeeds.

---

### TASK T-001 · Create the build status tracker

**DEPENDS ON:** nothing
**READ FIRST:** nothing
**CREATE:** `BUILD-STATUS.md`

**CONTENT:** exactly this, then one line per task from this document, all `TODO`:

```
# Build Status — Protocol Zero

Format: <task-id>  <STATUS>  <date>  <commit>
STATUS is one of: TODO | IN-PROG | DONE | BLOCKED

T-001  IN-PROG
T-002  TODO
T-003  TODO
```

**ACCEPTANCE:**
```bash
node -e "const s=require('fs').readFileSync('BUILD-STATUS.md','utf8'); if(!s.includes('T-001')) process.exit(1); console.log('OK')"
```
**DONE WHEN:** prints `OK`.

---

### TASK T-002 · Install pinned dependencies

**DEPENDS ON:** T-001
**READ FIRST:** `package.json`
**MODIFY:** `package.json`

**RULES:**
1. Add to `dependencies`, with these **exact** version strings. Do not use `^` or `~` on `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, or `@react-three/postprocessing`. These pins exist because the current majors require React 19 and this repo is React 18.3.1.

```jsonc
"three": "0.171.0",
"@react-three/fiber": "8.18.0",
"@react-three/drei": "9.122.0",
"@react-three/rapier": "1.5.0",
"@react-three/postprocessing": "2.19.1",
"postprocessing": "^6.36.0",
"howler": "^2.2.4",
"maath": "^0.10.8"
```

2. Add to `devDependencies`:

```jsonc
"@react-three/test-renderer": "^8.2.0",
"@testing-library/react": "^14.3.1"
```

3. Do not change any existing dependency version.
4. Run `npm install`.

**ACCEPTANCE:**
```bash
npm install
npm test
```
**DONE WHEN:** `npm test` reports **614 passed** and no peer-dependency errors appear during install.
**IF IT FAILS:** if npm reports a peer conflict on React, you used a wrong version. Re-check every pin above character by character. Do NOT use `--force` or `--legacy-peer-deps`.

---

### TASK T-003 · Directory skeleton

**DEPENDS ON:** T-002
**READ FIRST:** nothing
**CREATE:** the directory tree below. Every leaf directory gets a `.gitkeep` file (empty).

```
src/game3d/
  __tests__/
  config/
  state/
  sim/entity/
  sim/systems/
  sim/horror/
  sim/teaching/
  sim/director/
  sim/story/
  sim/redis/
  sim/replay/
  view/player/
  view/entities/
  view/level/
  view/fx/shaders/
  view/fx/particles/
  view/hud/
  view/debug/
  audio/
  content/chapters/ch1/beats/
  content/residents/
  content/clues/
  content/scares/
  content/enemies/
  content/tools/
  content/dialogue/
```

**RULES:** create no `.js` files in this task. Directories and `.gitkeep` only.

**ACCEPTANCE:**
```bash
node -e "const f=require('fs');const d=['src/game3d/sim/systems','src/game3d/view/hud','src/game3d/content/chapters/ch1/beats','src/game3d/audio'];for(const x of d){if(!f.existsSync(x))throw new Error('missing '+x)}console.log('OK')"
```

---

### TASK T-004 · The isolation test (Law L3, L4, L5)

**DEPENDS ON:** T-003
**READ FIRST:** `src/systems/incidents/IncidentEngine.js` lines 1–20 only (to see what a singleton export looks like)
**CREATE:** `src/game3d/__tests__/isolation.test.js`

**CONTRACT:** a vitest file, `node` environment (the default — do not add a jsdom docblock), that:

1. Recursively lists every `.js` and `.jsx` file under `src/game3d/`, excluding `src/game3d/__tests__/`.
2. Reads each file as UTF-8 text.
3. Fails if any file's text matches any of these patterns:

```js
const FORBIDDEN = [
  { pattern: /from\s+['"].*store\/gameStore(\.js)?['"]/,      law: 'L3' },
  { pattern: /from\s+['"].*audio\/SoundEngine(\.js)?['"]/,    law: 'L4' },
  { pattern: /\bimport\s*\{[^}]*\beventBus\b[^}]*\}/,          law: 'L5' },
  { pattern: /\bimport\s*\{[^}]*\bincidentEngine\b[^}]*\}/,    law: 'L5' },
  { pattern: /\bimport\s*\{[^}]*\bsoundEngine\b[^}]*\}/,       law: 'L5' },
  { pattern: /\bimport\s*\{[^}]*\bdefaultMasteryEngine\b[^}]*\}/, law: 'L5' },
  { pattern: /\bimport\s*\{[^}]*\bworldStateResolver\b[^}]*\}/,law: 'L5' },
  { pattern: /\bimport\s*\{[^}]*\bconsequenceEngine\b[^}]*\}/, law: 'L5' },
]
```

4. The failure message must name the file, the law, and the offending line number.
5. The test must pass when `src/game3d/` contains only `.gitkeep` files.

**RULES:**
- Use `node:fs` and `node:path`. Do not add a dependency.
- Write the directory walk as a plain recursive function. Do not use `glob`.
- Export nothing.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/__tests__/isolation.test.js
```
**DONE WHEN:** 1 test file passes.
**THEN VERIFY IT ACTUALLY WORKS:** temporarily create `src/game3d/state/_probe.js` containing the single line `import { eventBus } from '../../engine/EventBus.js'`, re-run the command, confirm it **FAILS**, then delete `_probe.js` and confirm it passes again. A guard rail that has never failed is not a guard rail.

---

### TASK T-005 · The architecture test (Laws L1, L2, L18, L19)

**DEPENDS ON:** T-004
**READ FIRST:** `src/game3d/__tests__/isolation.test.js` (the file you just wrote — reuse its directory-walk function by copying it; do not extract a shared helper yet)
**CREATE:** `src/game3d/__tests__/architecture.test.js`

**CONTRACT:** a vitest file, `node` environment, that walks every `.js` file under `src/game3d/sim/` and fails on any of:

```js
const SIM_FORBIDDEN = [
  { pattern: /from\s+['"]three['"]/,               law: 'L1', hint: 'sim must not import three.js' },
  { pattern: /from\s+['"]@react-three\//,          law: 'L1', hint: 'sim must not import R3F' },
  { pattern: /from\s+['"]react['"]/,               law: 'L1', hint: 'sim must not import react' },
  { pattern: /\bwindow\./,                          law: 'L2', hint: 'sim must not touch window' },
  { pattern: /\bdocument\./,                        law: 'L2', hint: 'sim must not touch document' },
  { pattern: /\blocalStorage\b/,                    law: 'L2', hint: 'sim must not touch localStorage' },
  { pattern: /\bnavigator\./,                       law: 'L2', hint: 'sim must not touch navigator' },
  { pattern: /Math\.random\s*\(/,                   law: 'L18', hint: 'use the injected rng' },
  { pattern: /Date\.now\s*\(/,                      law: 'L19', hint: 'use the injected clock' },
  { pattern: /performance\.now\s*\(/,               law: 'L19', hint: 'use the injected clock' },
]
```

**RULES:**
- Same failure-message format as T-004: file, law, line number, hint.
- Do not apply these patterns outside `sim/`. `view/` is allowed to use all of them.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/__tests__/architecture.test.js
```
**THEN VERIFY:** create `src/game3d/sim/_probe.js` with `export const x = Math.random()`, confirm the test FAILS, delete it, confirm it passes.

---

### TASK T-006 · 3D persistence namespace (Law L7)

**DEPENDS ON:** T-005
**READ FIRST:** `src/store/persistence.js` (all 50 lines)
**CREATE:** `src/game3d/state/persistence3d.js`
**CREATE:** `src/game3d/state/persistence3d.test.js`

**CONTRACT:**
```js
// prefixes every key with '3d:' so the underlying wrapper stores it as
// 'redis-quest:3d:<key>' and can never collide with 2D save data.
export function load3d(key, fallback = null)   // -> parsed value or fallback
export function save3d(key, value)             // -> void, never throws
export function remove3d(key)                  // -> void, never throws
export function clearAll3d()                   // -> void, removes every 3d: key
export const NS = '3d:'
```

**RULES:**
1. Import `load`, `save`, `remove` from `../../store/persistence.js` and delegate. Do not touch `localStorage` directly except inside `clearAll3d`.
2. `clearAll3d` must enumerate `localStorage` keys starting with `redis-quest:3d:` and remove them, wrapped in try/catch, never throwing.
3. This file is in `state/`, not `sim/`, so `localStorage` is permitted here (L2 applies only to `sim/`).

**TEST CONTRACT** (`persistence3d.test.js`, add `// @vitest-environment jsdom` on line 1):
- `save3d('foo', {a:1})` then `load3d('foo')` returns `{a:1}`.
- `load3d('missing', 'X')` returns `'X'`.
- After `save3d('foo', 1)`, `localStorage.getItem('redis-quest:3d:foo')` is `'1'`.
- Saving through `save3d` never writes a key that a 2D `load('foo')` would read.
- `clearAll3d()` removes 3d keys and leaves a manually-set `redis-quest:twoD` key intact.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/state/persistence3d.test.js
```
**DONE WHEN:** 5 tests pass.

---

### TASK T-007 · Performance budgets file

**DEPENDS ON:** T-006
**READ FIRST:** nothing
**CREATE:** `src/game3d/config/budgets.js`

**CONTRACT:** export exactly this object as a named const. Values are authoritative; do not change them.

```js
export const BUDGETS = {
  frame: {
    totalMs: 16.6,
    simStepMs: 2.0,
    physicsMs: 2.5,
    redisMs: 0.5,
    sceneUpdateMs: 1.5,
    drawMs: 4.0,
    postMs: 3.5,
    hudMs: 0.5,
    headroomMs: 2.1,
  },
  scene: {
    maxDrawCalls: 220,
    maxLevelChunks: 12,
    maxRealtimeLightsPerRoom: 4,
    maxParticleSystems: 8,
    lod1DistanceM: 25,
    lod2DistanceM: 60,
    hardCullDistanceM: 90,
  },
  sim: {
    maxEntities: 400,
    fixedHz: 60,
    directorIntervalTicks: 15,
    scareIntervalTicks: 15,
  },
  audio: {
    maxPannerNodes: 24,
    scareBusHeadroomDb: 12,
    combatDuckDb: -4,
    combatDuckMs: 60,
  },
  quality: {
    degradeBelowFps: 50,
    restoreAboveFps: 58,
    dprMin: 0.6,
    dprMax: 2.0,
  },
  bundle: {
    max3dChunkGzipBytes: 2_200_000,
    max2dGrowthBytes: 4_096,
    maxChapterAssetBytes: 35_000_000,
  },
}
```

**RULES:** add a 4-line header comment explaining that these numbers are asserted by tests and must not be edited to make a failing test pass.

**ACCEPTANCE:**
```bash
node -e "import('./src/game3d/config/budgets.js').then(m=>{if(m.BUDGETS.sim.fixedHz!==60)process.exit(1);console.log('OK')})"
```

---

### TASK T-008 · Game-feel constants file (Law L21 support)

**DEPENDS ON:** T-007
**READ FIRST:** nothing
**CREATE:** `src/game3d/config/feel.js`

**CONTRACT:** export `FEEL` with exactly these fields and values:

```js
export const FEEL = {
  camera: { fovDefault: 75, fovSprint: 82, fovAdsMultiplier: 0.82,
            fovLerpMs: 180, headBobHz: 1.2, headBobAmplitude: 0.035,
            strafeRollDeg: 1.5, landingDipM: 0.12, landingDipMs: 220 },
  move:   { walkSpeed: 4.2, sprintSpeed: 7.0, crouchSpeed: 2.0,
            slideImpulse: 9.5, slideDurationMs: 650, jumpVelocity: 5.2,
            gravity: -18.0, airControl: 0.28, groundAccel: 48,
            groundFriction: 12, coyoteTimeMs: 120 },
  weapon: { recoilStiffness: 180, recoilDamping: 12, swayLagMs: 90,
            swayAmplitudeDeg: 1.8, adsLerpMs: 140, breathHz: 0.25,
            breathAmplitudeDeg: 0.35 },
  impact: { hitStopMs: 60, flashFrames: 3, cameraKickDeg: 2.4,
            shakeDecayPerSec: 6.0, shakeMaxDeg: 3.0 },
  ui:     { cardComposerSlowFactor: 0.35, terminalSlowFactor: 0.25,
            receiptVisibleMs: 500, hintIdleTriggerMs: 25_000 },
}
```

**RULES:** header comment must state: *"Every game-feel number lives here. Do not scatter timing constants into components — feel is iterated dozens of times and must be tunable from one file."*

**ACCEPTANCE:**
```bash
node -e "import('./src/game3d/config/feel.js').then(m=>{if(m.FEEL.impact.hitStopMs!==60)process.exit(1);console.log('OK')})"
```

---

### TASK T-009 · The 3D store (Law L3 compliance)

**DEPENDS ON:** T-008
**READ FIRST:** `src/store/gameStore.js` lines 773–800 only (to copy the `initialState()` shape convention). **Do not read the rest of that file.**
**CREATE:** `src/game3d/state/game3dStore.js`
**CREATE:** `src/game3d/state/game3dStore.test.js`

**CONTRACT:**
```js
import { create } from 'zustand'

export const useGame3DStore = create((set, get) => ({ ...initial3DState(), ...actions }))
export function initial3DState()
```

`initial3DState()` returns exactly:
```js
{
  phase: 'launcher',        // 'launcher' | 'loading' | 'playing' | 'paused' | 'debrief' | 'ended'
  chapter: 0,               // 0 = not started, 1..6
  seed: null,               // string | null
  ladderTier: 0,            // 0..3 — the interaction ladder (see plan section 8.2)
  fieldManualPages: [],     // array of page ids, in unlock order
  vocabStage: 'physical',   // 'physical' | 'mixed' | 'real'
  settings: {
    threat: 'normal',       // 'low' | 'normal' | 'high'
    puzzlePressure: 'normal',
    reducedScares: false,
    photosensitiveSafe: false,
    audioSpikeLimiter: false,
    predictableMode: false,
    headBob: true,
    cameraShake: true,
    subtitles: true,
    captions: true,
  },
  quality: 'auto',          // 'auto' | 'low' | 'medium' | 'high'
  lastCheckpoint: null,
}
```

Actions (all synchronous, all `set`-only, no side effects):
```js
setPhase(phase)
setChapter(n)
setSeed(seed)
setLadderTier(tier)          // clamps 0..3, never decreases
unlockManualPage(pageId)     // ignores duplicates, appends
setVocabStage(stage)
updateSettings(partial)      // shallow merge into settings
setQuality(q)
setCheckpoint(checkpoint)
reset3D()                    // back to initial3DState()
```

**RULES:**
1. **This store must never import `src/store/gameStore.js`.** Test T-004 enforces this.
2. No persistence calls inside the store. Persistence is wired in a later task.
3. `setLadderTier` must never lower the tier: `set({ ladderTier: Math.max(get().ladderTier, Math.min(3, Math.max(0, tier))) })`.

**TEST CONTRACT:** 8 tests — initial shape matches, each action mutates only its own field, `setLadderTier(1)` then `setLadderTier(0)` leaves tier at 1, `unlockManualPage` deduplicates, `reset3D` restores initial state.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/state/game3dStore.test.js
npx vitest run src/game3d/__tests__/isolation.test.js
```
**DONE WHEN:** both pass.

---

### TASK T-010 · Bootstrap — the 3D-owned runtime (Law L6)

**DEPENDS ON:** T-009
**READ FIRST:** `src/engine/engine.js` lines 1–40 and 440–470 only · `src/engine/EventBus.js` lines 1–30 only
**CREATE:** `src/game3d/bootstrap.js`
**CREATE:** `src/game3d/bootstrap.test.js`

**CONTRACT:**
```js
export function createRuntime({ seed = null, memoryLimit = 64 * 1024 * 1024, now = null } = {})
```
Returns a frozen object:
```js
{
  engine,      // a NEW MockRedisEngine from createEngine({ seed, memoryLimit, now })
  bus,         // a NEW EventBus({ logSize: 500 })
  rng,         // createRng(seed)
  seed,        // the seed used, string; if none given, generate 'seed-<n>' from Date.now() AT CALL SITE, not inside sim
  clock,       // () => number — the injected clock, or Date.now
  dispose(),   // unsubscribes everything, clears the bus, stops nothing else
}
```

**RULES:**
1. **Never accept an engine parameter.** This function creates its own. Law L6.
2. `memoryLimit` default is 64 MB — deliberately larger than the 2D default of 10 MB because the 3D world seeds far more keys.
3. `bootstrap.js` lives at `src/game3d/`, not in `sim/`, so it may call `Date.now()` for seed generation. The runtime it produces gives `sim/` an injected clock so `sim/` never needs to.
4. Wire one subscription: `engine.on('command', ...)` republishing onto the bus as `{ type: 'redis:command', payload: { name, args, reply }, source: 'engine' }`. Store the unsubscribe function and call it in `dispose()`.
5. Also republish `engine.on('expired', ...)` as `redis:expired`.
6. Use `Object.freeze` on the returned object.

**TEST CONTRACT** (`node` environment):
- Two `createRuntime()` calls return engines that are different objects.
- Writing a key in runtime A does not appear in runtime B (`rawExecute('SET','k','1')` then B's `GET k` returns nil). **This is the isolation proof.**
- `createRuntime({ seed: 'abc' })` twice produces identical `rng()` first values.
- A command on the engine emits `redis:command` on the bus.
- `dispose()` stops further bus events from that engine.
- The returned object is frozen.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/bootstrap.test.js
```
**DONE WHEN:** 6 tests pass.

---

### TASK T-011 · Launcher and lazy mount (Law L5 for the entry point)

**DEPENDS ON:** T-010
**READ FIRST:** `src/App.jsx` lines 1–30 and 110–130 only
**CREATE:** `src/game3d/index.js`
**CREATE:** `src/components/ModeLauncher.jsx`
**CREATE:** `src/components/ModeLauncher.test.jsx`
**MODIFY:** `src/App.jsx`

**CONTRACT — `src/game3d/index.js`:**
```js
// Default export ONLY here, because React.lazy requires a default export.
export default function Game3DRoot({ onExit })
```
For this task it renders a black full-screen `<div>` containing the text `PROTOCOL ZERO — BOOTING` and an EXIT button calling `onExit`. No three.js yet.

**CONTRACT — `src/components/ModeLauncher.jsx`:**
```js
export default function ModeLauncher({ onSelect })
```
Renders two panels. Left: `REDIS QUEST` / `Learn Redis commands` / `Terminal · Puzzle · RPG` / `Instant`, button labelled `PLAY 2D`, calls `onSelect('2d')`. Right: `PROTOCOL ZERO` / `Survive Facility NODE-7` / `Horror · Shooter · Story` / `~40 MB download · requires a GPU` / a warning line `⚠ Frequent jumpscares, loud audio, darkness`, button labelled `ENTER NODE-7`, calls `onSelect('3d')`.

**MODIFY `src/App.jsx`:**
1. Add at the top of the imports:
   ```js
   import { lazy, Suspense } from 'react'
   import ModeLauncher from './components/ModeLauncher.jsx'
   const Game3DRoot = lazy(() => import('./game3d/index.js'))
   ```
2. Add one state hook next to the existing ones: `const [appMode, setAppMode] = useState(null)`.
3. At the very start of the returned JSX, before everything else:
   ```jsx
   if (appMode === null) return <ModeLauncher onSelect={setAppMode} />
   if (appMode === '3d') return (
     <Suspense fallback={<div className="flex h-full items-center justify-center bg-black text-cyan font-mono">LOADING NODE-7…</div>}>
       <Game3DRoot onExit={() => setAppMode(null)} />
     </Suspense>
   )
   ```
4. **Change nothing else in App.jsx.** Do not touch the engine creation, the effects, or the existing layout.

**RULES:**
- The `lazy()` import is what keeps three.js out of the 2D bundle. Never import `game3d` statically anywhere in `src/components/` or `src/App.jsx`.
- `ModeLauncher.test.jsx` needs `// @vitest-environment jsdom` on line 1.

**TEST CONTRACT:** renders both panel titles; clicking `ENTER NODE-7` calls `onSelect` with `'3d'`; clicking `PLAY 2D` calls it with `'2d'`.

**ACCEPTANCE:**
```bash
npx vitest run src/components/ModeLauncher.test.jsx
npm test
npm run build
```
**DONE WHEN:** the new test passes, the full suite still reports **≥ 614 passed**, and the build succeeds.
**IF `npm test` DROPS BELOW 614:** you modified something in App.jsx you should not have. Revert App.jsx with `git checkout src/App.jsx` and redo step 3 only.

---

### TASK T-012 · Bundle-split verification

**DEPENDS ON:** T-011
**READ FIRST:** nothing
**CREATE:** `src/game3d/__tests__/bundleSplit.test.js`

**CONTRACT:** a `node`-environment test that reads `src/App.jsx` and every file under `src/components/` as text and asserts:
1. No file contains a **static** `import` from `'./game3d` or `'../game3d` — only the `lazy(() => import(...))` form is allowed.
2. `src/App.jsx` contains the exact substring `lazy(() => import('./game3d/index.js'))`.
3. No file under `src/components/` or `src/systems/` or `src/game/` imports `three`.

Detect the static form with: `/^\s*import\s+[^(].*from\s+['"]\.{1,2}\/game3d/m` (the `[^(]` excludes `import(`).

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/__tests__/bundleSplit.test.js
```

---

## PHASE 0 GATE — do not proceed until all of these pass

```bash
npm test
npm run build
npx vitest run src/game3d
```

**Required:** `npm test` ≥ 614 passed · build succeeds · all `src/game3d` tests pass · `git log` shows 12 commits, one per task.

---

# PART C — PHASE 1 · ENGINE CAPABILITIES

**Goal:** the four verified-missing capabilities from the plan (§3.3, §13). These land in the shared engine *code*; each mode still gets its own *instance*.
**Exit:** T-013 … T-026 green, `npm test` shows roughly 730+ passing.

---

### TASK T-013 · Stream data type — storage primitive

**DEPENDS ON:** T-012
**READ FIRST:** `src/engine/datatypes/LinkedList.js` (all) · `src/engine/datatypes/memory.js` lines 1–110
**CREATE:** `src/engine/datatypes/Stream.js`
**CREATE:** `src/engine/datatypes/Stream.test.js`

**CONTRACT:**
```js
export class StreamId {
  constructor(ms, seq)
  static parse(str)              // '1-2' -> StreamId; '-' -> MIN; '+' -> MAX; throws on bad input
  static min()                   // 0-0
  static max()                   // Number.MAX_SAFE_INTEGER - MAX_SAFE_INTEGER
  toString()                     // '1-2'
  compare(other)                 // -1 | 0 | 1
  isGreaterThan(other)           // boolean
}

export class RedisStream {
  constructor()
  entries                        // array of { id: StreamId, fields: Map<string,string> }
  lastId                         // StreamId
  groups                         // Map<groupName, ConsumerGroup>
  maxDeletedId                   // StreamId
  entriesAdded                   // number, monotonic, never decremented

  add(idSpec, fieldMap, nowMs)   // idSpec '*' | 'ms-*' | 'ms-seq'. -> StreamId. throws if id <= lastId
  range(startId, endId, count)   // -> entries array, ascending
  revRange(startId, endId, count)
  get length()                   // entries.length
  trimMaxLen(maxLen, approx)     // -> number removed
  del(ids)                       // -> number removed
}

export class ConsumerGroup {
  constructor(name, lastDeliveredId)
  name
  lastDeliveredId                // StreamId
  consumers                      // Map<consumerName, { name, seenTime, pending: Set<idString> }>
  pel                            // Map<idString, { id, consumer, deliveryTime, deliveryCount }>
  createConsumer(name, nowMs)
  ack(ids)                       // -> number acked
  claim(ids, toConsumer, nowMs, minIdleMs)  // -> claimed id array
}

export function streamBytes(stream)   // memory estimate, see rules
```

**RULES:**
1. `StreamId` ordering: compare `ms` first, then `seq`. Both are plain numbers.
2. `add('*', …, nowMs)`: if `nowMs > lastId.ms` use `(nowMs, 0)`, else use `(lastId.ms, lastId.seq + 1)`. This is real Redis behaviour and the tests will check it.
3. `add('5-*')`: seq is `lastId.seq + 1` if `lastId.ms === 5`, else `0`.
4. `add` with an explicit id that is `<=` lastId throws `Error('ERR The ID specified in XADD is equal or smaller than the target stream top item')`. The command layer converts this to an error reply.
5. `trimMaxLen(n, approx=false)` removes from the front until `length <= n`. When `approx` is true, only trim in blocks of 64 (the "~" behaviour) — if fewer than 64 would be removed, remove none.
6. `streamBytes` = `entries.length * 64` + sum of `utf8Bytes` of every field name and value + `pelSize * 48` summed over all groups. Import `utf8Bytes` from `./memory.js`.
7. No engine reference inside this file. Pure data structure. **No `Date.now()`** — `nowMs` is always passed in.

**TEST CONTRACT:** at least 22 tests covering: parse of `'1-2'`, `'-'`, `'+'`, `'5'` (→ `5-0`); auto-id monotonicity across the same millisecond; explicit-id rejection; range inclusive bounds; revRange ordering; trim exact and approx; group creation; ack of present and absent ids; claim respecting `minIdleMs`; `streamBytes` growing with content.

**ACCEPTANCE:**
```bash
npx vitest run src/engine/datatypes/Stream.test.js
```

---

### TASK T-014 · Stream memory accounting

**DEPENDS ON:** T-013
**READ FIRST:** `src/engine/datatypes/memory.js` (all 120 lines)
**MODIFY:** `src/engine/datatypes/memory.js`

**RULES:**
1. Add to `MEMORY_CONSTANTS`: `STREAM_ENTRY: 64`, `STREAM_PEL_ENTRY: 48`.
2. In `valueMemoryBytes(type, value)`, add a `case 'stream':` that calls `streamBytes(value)` imported from `./Stream.js`.
3. Change nothing else. Do not alter any existing constant — existing tests assert them.

**ACCEPTANCE:**
```bash
npm test
```
**DONE WHEN:** still ≥ 614 passing (this task adds no tests; it must break none).

---

### TASK T-015 · Stream commands — write path

**DEPENDS ON:** T-014
**READ FIRST:** `src/engine/commands/lists.js` lines 1–70 (the module pattern) · `src/engine/datatypes/Stream.js` (the file you wrote) · API Reference Card §A.5
**CREATE:** `src/engine/commands/streams.js`
**CREATE:** `src/engine/commands/streams.test.js`
**MODIFY:** `src/engine/registry.js`

**COMMANDS IN THIS TASK — exactly these five, no others:**

```
XADD    arity -5   XADD key [MAXLEN [~] count] <*|id> field value [field value ...]
XLEN    arity  2   XLEN key
XRANGE  arity -4   XRANGE key start end [COUNT n]
XREVRANGE arity -4 XREVRANGE key end start [COUNT n]
XDEL    arity -3   XDEL key id [id ...]
```

**RULES:**
1. Copy the exact structure of `lists.js`: a local `streamForWrite(engine, key)` helper using `engine._entryForWrite(key, 'stream')`, returning `{ entry, wrongType }`.
2. On a new stream entry, set `entry.value = new RedisStream()`.
3. After every mutation call `engine._bump(key, entry)` then `engine.emit('change')`. Copy this from `LPUSH`.
4. `XADD` on a wrong-type key returns `wrongType()`.
5. `XADD` returns `bulkReply(id.toString())`.
6. `XLEN` on a missing key returns `integerReply(0)`. On a wrong type, `wrongType()`.
7. `XRANGE` returns `arrayReply` of `arrayReply([bulkReply(id), arrayReply([bulkReply(f), bulkReply(v), ...])])` — the real nested RESP shape. Get this exactly right; chapter 3 depends on it.
8. Errors thrown by `RedisStream.add` are caught and returned as `errorReply(err.message)`.
9. Pass `engine.now()` as `nowMs` into `stream.add`. Never call `Date.now()`.
10. **Register the module:** in `src/engine/registry.js`, add `import * as streams from './commands/streams.js'` with the other imports and add `streams` to the `groups` array. Change nothing else in that file.

**TEST CONTRACT:** at least 18 tests. Must include: `XADD` auto-id then `XLEN` is 1; two `XADD`s in the same simulated millisecond produce `n-0` and `n-1`; `XADD` with a stale explicit id returns an error reply whose `value` starts with `'ERR The ID specified'`; `XRANGE - +` returns everything in order; `XRANGE` with `COUNT` truncates; `XREVRANGE` reverses; `XDEL` returns the removed count; every command on a string key returns WRONGTYPE. Use `createEngine({ now: () => fixedTime })` to control time.

**ACCEPTANCE:**
```bash
npx vitest run src/engine/commands/streams.test.js
npm test
```

---

### TASK T-016 · Stream commands — consumer groups

**DEPENDS ON:** T-015
**READ FIRST:** `src/engine/commands/streams.js` (your file) · `src/engine/datatypes/Stream.js`
**MODIFY:** `src/engine/commands/streams.js`
**MODIFY:** `src/engine/commands/streams.test.js`

**COMMANDS TO ADD — exactly these seven:**

```
XGROUP     arity -4  XGROUP CREATE key group <id|$> [MKSTREAM]
                     XGROUP DESTROY key group
                     XGROUP CREATECONSUMER key group consumer
                     XGROUP DELCONSUMER key group consumer
XREADGROUP arity -7  XREADGROUP GROUP g c [COUNT n] [NOACK] STREAMS key <>|id>
XACK       arity -4  XACK key group id [id ...]
XPENDING   arity -3  XPENDING key group [start end count [consumer]]
XCLAIM     arity -6  XCLAIM key group consumer min-idle-time id [id ...]
XAUTOCLAIM arity -7  XAUTOCLAIM key group consumer min-idle-time start [COUNT n]
XINFO      arity -3  XINFO STREAM key | XINFO GROUPS key | XINFO CONSUMERS key group
```

**RULES:**
1. `XGROUP CREATE` with `$` sets `lastDeliveredId` to the stream's current `lastId`. With `0` it sets `StreamId.min()`.
2. `XGROUP CREATE` on a missing key without `MKSTREAM` returns `errorReply('ERR The XGROUP subcommand requires the key to exist. Note that for CREATE you may want to use the MKSTREAM option to create an empty stream automatically.')`.
3. `XREADGROUP` with id `>` delivers entries after `lastDeliveredId`, advances it, and adds each to the group's PEL and the consumer's pending set — **unless `NOACK` is given**, in which case it skips the PEL entirely.
4. `XREADGROUP` with an explicit id replays **only that consumer's** already-pending entries with id greater than the one given. It does not deliver new entries and does not advance `lastDeliveredId`.
5. `XPENDING` short form (no start/end) returns `arrayReply([integerReply(count), bulkReply(minId), bulkReply(maxId), arrayReply([arrayReply([bulkReply(consumer), bulkReply(String(count))]), ...])])`. On an empty PEL return `arrayReply([integerReply(0), nilReply(), nilReply(), nilReply()])`.
6. `XAUTOCLAIM` returns `arrayReply([bulkReply(nextCursorId), arrayReply(entries), arrayReply(deletedIds)])`.
7. Idle time is computed as `engine.now() - pelEntry.deliveryTime`.
8. Every claim increments `deliveryCount`. This is what the game reads to decide when a worker becomes hostile.

**TEST CONTRACT:** at least 24 further tests. Must include: create group at `$` then `XREADGROUP >` returns nothing until a new `XADD`; PEL count is 1 after delivery and 0 after `XACK`; `NOACK` leaves the PEL empty; explicit-id replay returns the same entry twice without advancing; `XPENDING` reports the right consumer; `XCLAIM` with a `min-idle-time` above the actual idle returns empty; `XCLAIM` below it transfers ownership and increments `deliveryCount`; `XAUTOCLAIM` walks the PEL from a cursor; `XINFO GROUPS` reports the pending count.

**ACCEPTANCE:**
```bash
npx vitest run src/engine/commands/streams.test.js
npm test
```
**DONE WHEN:** ≥ 42 stream tests pass and the full suite is green.

---

### TASK T-017 · Real keyspace hit/miss statistics

**DEPENDS ON:** T-016
**READ FIRST:** `src/engine/engine.js` lines 55–115 and 300–365 · `src/engine/commands/server.js` lines 145–160
**MODIFY:** `src/engine/engine.js`
**MODIFY:** `src/engine/commands/server.js`
**CREATE:** `src/engine/hitstats.test.js`

**RULES:**
1. In the `MockRedisEngine` constructor, add to `this.stats`: `keyspaceHits: 0`, `keyspaceMisses: 0`.
2. Add an instance field `this._hitWindow = []` — a ring of `{ t, hit }` records.
3. Add a private field `this._readIntent = false`.
4. Define at module scope:
   ```js
   const READ_INTENT_COMMANDS = new Set([
     'GET','MGET','GETRANGE','STRLEN','HGET','HMGET','HGETALL','HKEYS','HVALS','HLEN',
     'HEXISTS','LRANGE','LINDEX','LLEN','SMEMBERS','SISMEMBER','SCARD','ZSCORE','ZRANK',
     'ZREVRANK','ZRANGE','ZREVRANGE','ZCARD','EXISTS','TYPE','TTL','PTTL','XRANGE',
     'XREVRANGE','XLEN','XREAD','XREADGROUP',
   ])
   ```
5. In `_executeTokens`, immediately before `reply = command(this, args)`, set `this._readIntent = READ_INTENT_COMMANDS.has(canon)`. In the `finally` path after the handler, set it back to `false`.
6. In `_get(key)`, **only when `this._readIntent` is true**, record a hit when a live entry is returned and a miss when null is returned (both the missing-key and the just-expired paths count as misses). Push `{ t: this.now(), hit }` onto `_hitWindow` and increment the matching stat.
7. Add a method:
   ```js
   hitRatio(windowMs = 30000) {
     const cutoff = this.now() - windowMs
     let hits = 0, total = 0
     for (let i = this._hitWindow.length - 1; i >= 0; i--) {
       if (this._hitWindow[i].t < cutoff) break
       total++
       if (this._hitWindow[i].hit) hits++
     }
     return total === 0 ? 1 : hits / total
   }
   ```
   Trim `_hitWindow` to its last 2000 records inside `_recordCommand` so it cannot grow without bound.
8. In `server.js` `INFO`, replace the two literal lines with `` `keyspace_hits:${engine.stats.keyspaceHits}\r\n` `` and the equivalent for misses.
9. Add `keyspaceHits` and `keyspaceMisses` to the `snapshot()` stats spread — they are already covered by `{ ...this.stats }`, so verify rather than add.

**CRITICAL:** a `SET` on a missing key must **not** count as a miss. Existing behaviour must be unchanged for every non-read command. This is the whole point of the intent flag.

**TEST CONTRACT** (`src/engine/hitstats.test.js`, at least 10 tests):
- `GET missing` → misses 1, hits 0.
- `SET k v` then `GET k` → hits 1, misses 1 (from the earlier miss only if one occurred; assert precisely).
- `SET k v` alone → hits 0, misses 0.
- `EXISTS missing` counts a miss.
- `hitRatio()` on a fresh engine returns 1.
- 3 hits and 1 miss → `hitRatio()` is 0.75.
- Records outside the window are excluded (use an injected clock).
- `_hitWindow` never exceeds 2000 entries after 3000 reads.
- `INFO stats` output contains the real numbers.
- **A regression guard: run 50 assorted write commands and assert `keyspaceMisses === 0`.**

**ACCEPTANCE:**
```bash
npx vitest run src/engine/hitstats.test.js
npm test
```
**IF THE FULL SUITE BREAKS:** you counted a non-read command. Re-check step 4's set and step 6's guard.

---

### TASK T-018 · Eviction policies

**DEPENDS ON:** T-017
**READ FIRST:** `src/engine/engine.js` lines 118–200 · `src/engine/commands/debug.js` lines 555–625
**CREATE:** `src/engine/eviction.js`
**CREATE:** `src/engine/eviction.test.js`
**MODIFY:** `src/engine/engine.js`
**MODIFY:** `src/engine/commands/debug.js`

**CONTRACT — `src/engine/eviction.js`:**
```js
export const EVICTION_POLICIES = [
  'noeviction', 'allkeys-lru', 'allkeys-random',
  'volatile-lru', 'volatile-random', 'volatile-ttl',
]

export const EVICTION_SAMPLE_SIZE = 5

// Choose ONE key to evict, or null if nothing is eligible.
export function pickEvictionCandidate(engine, policy)

// Evict until memoryBytes <= memoryLimit, or until nothing is eligible.
// Returns { keys: string[], freedBytes: number, policy }
export function runEvictionPass(engine, policy, maxEvictions = 200)
```

**RULES:**
1. `volatile-*` policies consider only keys where `entry.expiresAt !== null`. `allkeys-*` consider all keys in the **active db only**.
2. `*-lru`: sample `EVICTION_SAMPLE_SIZE` random eligible keys using `engine.random()` and pick the one with the **smallest `lruTick`**. This approximation is what real Redis does; do not implement exact LRU.
3. `volatile-ttl`: sample 5 and pick the **soonest `expiresAt`**.
4. `*-random`: sample 1.
5. `noeviction`: `pickEvictionCandidate` returns `null` always; `runEvictionPass` returns `{ keys: [], freedBytes: 0, policy }`.
6. `runEvictionPass` must recompute `engine.memoryBytes` between evictions (the getter handles the dirty cache) and stop as soon as it is within the limit.
7. Use `engine._delete(key)`. Never `engine.store.delete` directly.

**MODIFY `engine.js`:**
8. Constructor: `this.maxmemoryPolicy = 'noeviction'`.
9. Add a method `maybeEvict()`:
   ```js
   maybeEvict() {
     if (this.maxmemoryPolicy === 'noeviction') return null
     if (this.memoryBytes <= this.memoryLimit) return null
     const result = runEvictionPass(this, this.maxmemoryPolicy)
     if (result.keys.length > 0) {
       this.emit('evicted', result)
       this.emit('change')
     }
     return result
   }
   ```
10. Call `this.maybeEvict()` in `_executeTokens`, **after** the handler returns and **before** the `command` event is emitted, and only when the reply is not an error.
11. Add `maxmemoryPolicy` to `snapshot()` and `restore()`.

**MODIFY `debug.js`:**
12. `CONFIG GET maxmemory-policy` returns `engine.maxmemoryPolicy` instead of the literal.
13. `CONFIG SET maxmemory-policy <v>` validates against `EVICTION_POLICIES`, sets `engine.maxmemoryPolicy`, returns `okReply()`; an unknown value returns `errorReply("ERR Invalid argument 'x' for CONFIG SET 'maxmemory-policy'")`.

**TEST CONTRACT** (at least 14 tests): each policy name is accepted; `noeviction` never evicts and memory is allowed to exceed the limit; `allkeys-lru` evicts the least-recently-touched of a sampled set; `volatile-lru` never touches a key without a TTL; `volatile-ttl` picks the soonest expiry; the `evicted` event fires with the right `keys` and a positive `freedBytes`; eviction stops once under the limit; a seeded engine evicts deterministically; `CONFIG GET` reflects a prior `CONFIG SET`; an invalid policy is rejected.

**ACCEPTANCE:**
```bash
npx vitest run src/engine/eviction.test.js
npm test
```
**IF THE FULL SUITE BREAKS:** the default policy must remain `noeviction`, so nothing evicts unless a test opts in. If existing tests now lose keys, step 8 is wrong.

---

### TASK T-019 · Latency model

**DEPENDS ON:** T-018
**READ FIRST:** `src/engine/engine.js` lines 300–365
**CREATE:** `src/engine/latency.js`
**CREATE:** `src/engine/latency.test.js`
**MODIFY:** `src/engine/engine.js`

**CONTRACT:**
```js
export const BASE_COST_MS = 0.05

// Estimated milliseconds this command would cost a single-threaded server.
export function estimateCommandCost(engine, canonicalName, args, reply)
```

**COST TABLE — implement exactly:**

| Command | Cost |
|---|---|
| Default (any O(1)) | `BASE_COST_MS` |
| `KEYS` | `BASE_COST_MS + 0.002 * engine.store.size` |
| `SCAN`, `HSCAN` | `BASE_COST_MS + 0.0002 * engine.store.size` |
| `DEL`, `UNLINK` (per key) | `BASE_COST_MS + 0.0008 * elementCount(entry)` — **but `UNLINK` is capped at `BASE_COST_MS * 2` because it reclaims asynchronously** |
| `LRANGE`, `SMEMBERS`, `HGETALL`, `ZRANGE`, `XRANGE` | `BASE_COST_MS + 0.0008 * returnedItemCount` |
| `FLUSHDB`, `FLUSHALL` | `BASE_COST_MS + 0.0008 * engine.store.size` |
| `EVAL` | `BASE_COST_MS + 0.01 * scriptLineCount` |
| `DEBUG SLEEP n` | `n * 1000` |

`elementCount(entry)` returns: strings → 1; Map/Set → `.size`; list → `.length`; zset → member count; stream → `entries.length`. Guard every branch — a missing key contributes 0.

**MODIFY `engine.js`:**
1. Constructor: `this.lastCommandCostMs = 0`.
2. In `_executeTokens`, after the handler returns: `this.lastCommandCostMs = estimateCommandCost(this, canon, args, reply)`.
3. Include `costMs: this.lastCommandCostMs` in the `command` event payload — the payload becomes `{ name, args, reply, costMs }`. **Existing subscribers ignore unknown fields, so this is additive and safe.**

**TEST CONTRACT** (at least 10 tests): `GET` costs `BASE_COST_MS`; `KEYS *` on a 1000-key db costs more than on a 10-key db; `DEL` of a 5000-element list costs more than `UNLINK` of the same; `UNLINK` never exceeds `BASE_COST_MS * 2`; `DEBUG SLEEP 0.1` costs 100; the `command` event carries `costMs`; a missing key costs the base amount.

**ACCEPTANCE:**
```bash
npx vitest run src/engine/latency.test.js
npm test
```

---

### TASK T-020 · Blocking-command replies

**DEPENDS ON:** T-019
**READ FIRST:** `src/engine/commands/lists.js` — find `BLPOP` and read its full implementation
**MODIFY:** `src/engine/commands/lists.js`
**MODIFY:** `src/engine/commands/zsets.js`
**CREATE:** `src/engine/blocking.test.js`

**RULES:**
1. When `BLPOP` / `BRPOP` / `BZPOPMIN` / `BZPOPMAX` find no data, instead of returning nil they return:
   ```js
   { type: 'blocked', value: null, resumeOn: [key1, key2], timeoutAt: timeoutSeconds === 0 ? null : engine.now() + timeoutSeconds * 1000 }
   ```
2. When data **is** available, behaviour is completely unchanged.
3. `timeoutAt: null` means block forever — this is what makes `BLPOP key 0` a physical trap in the game.
4. Add `'blocked'` to the reply-type documentation comment at the top of `src/engine/reply.js`. Add a helper there:
   ```js
   export function blockedReply(resumeOn, timeoutAt) {
     return { type: 'blocked', value: null, resumeOn, timeoutAt }
   }
   ```

**RISK — READ THIS:** existing tests may assert that `BLPOP` on an empty key returns nil. **Run `npm test` first and record which tests touch blocking commands.** If any assert the nil behaviour, update **only those assertions** to the new shape, and note each change in the commit message. Do not delete a test.

**TEST CONTRACT** (at least 8 tests): `BLPOP` on an empty key returns type `'blocked'` with the right `resumeOn`; timeout `0` gives `timeoutAt: null`; timeout `5` gives `now + 5000`; `BLPOP` on a populated key returns the normal array reply; the same four cases for `BZPOPMIN`.

**ACCEPTANCE:**
```bash
npx vitest run src/engine/blocking.test.js
npm test
```

---

### TASK T-021 · Objective predicate extensions

**DEPENDS ON:** T-020
**READ FIRST:** `src/systems/incidents/IncidentEvaluator.js` (all)
**MODIFY:** `src/systems/incidents/IncidentEvaluator.js`
**CREATE:** `src/systems/incidents/IncidentEvaluator.extended.test.js`

**RULES:** add these `case` blocks to the existing `switch` in `evaluatePredicate`, in this order, following the existing style exactly (each returns a boolean, each guards a missing key):

```js
'streamLengthAbove'   { key, min }        entry.type==='stream' && entry.value.length > min
'streamLengthBelow'   { key, max }        missing key counts as length 0
'pendingCountBelow'   { key, group, max } sum of the group's PEL size
'consumerGroupExists' { key, group }
'hitRatioAbove'       { min }             engine.hitRatio() > min
'memoryBelowRatio'    { max }             engine.memoryBytes / engine.memoryLimit < max
'keyCountBelow'       { max }             engine.store.size < max
'allKeysHaveTtl'      { pattern }         every key matching the glob has expiresAt !== null
'lockHeldWithFence'   { key, minFence }   value parses as an integer >= minFence
'evictionCountBelow'  { max }             (engine.stats.keysEvicted ?? 0) < max
```

For `allKeysHaveTtl`, import the existing glob matcher from `src/engine/datatypes/glob.js`. **Read that file first to get the exported function's real name — do not guess it.**

Also add `keysEvicted: 0` to `engine.stats` in the constructor and increment it inside `maybeEvict` (T-018) by `result.keys.length`.

**TEST CONTRACT:** two tests per predicate — one true case, one false case — plus one test per predicate proving a missing key does not throw. Minimum 30 tests.

**ACCEPTANCE:**
```bash
npx vitest run src/systems/incidents/IncidentEvaluator.extended.test.js
npm test
```

---

### TASK T-022 · Minor commands

**DEPENDS ON:** T-021
**READ FIRST:** `src/engine/commands/strings.js` lines 1–60 · `src/engine/commands/debug.js` lines 1–40
**MODIFY:** `src/engine/commands/strings.js` (add `SETNX`)
**MODIFY:** `src/engine/commands/debug.js` (add `DEBUG SLEEP` and `OBJECT FREQ` if `OBJECT` lives there — otherwise `src/engine/commands/keys.js`; **grep for `export const OBJECT` to find out, do not guess**)
**CREATE:** `src/engine/commands/minor.test.js`

```
SETNX        arity 3   Set key to value only if it does not exist. -> integer 1 or 0
DEBUG SLEEP  arity 3   DEBUG SLEEP <seconds>. Returns OK. Cost handled by T-019.
OBJECT FREQ  arity 3   Returns integer access frequency. Use entry.lruTick as the proxy.
MEMORY USAGE arity -3  Returns integer bytes for one key, via entryMemoryBytes.
```

**RULES:** `SETNX` must clear TTL like `SET` does (call `engine._clearTtl`). It is exactly `SET key value NX` with an integer reply.

**TEST CONTRACT:** 8 tests.

**ACCEPTANCE:**
```bash
npx vitest run src/engine/commands/minor.test.js
npm test
```

---

### TASKS T-023 … T-026 · Phase 1 consolidation

| Task | Work | Acceptance |
|---|---|---|
| **T-023** | Add a `case 'stream':` branch to the `switch (entry.type)` at **`src/components/MemoryInspector.jsx:25`** so the 2D inspector does not crash on stream keys. Render `${entry.value.length} entries`. Read lines 1–60 of that file only; change nothing else. | `npx vitest run src/components/MemoryInspector.test.jsx` |
| **T-024** | Add stream serialization to `engine.snapshot()` / `restore()` — `serializeEntryValue` must tag streams as `{ __t: 'stream', v: {...} }` and `deserializeEntryValue` must rebuild a `RedisStream`. Read `src/engine/engine.js` lines 380–450. | New test: add 200 stream entries, snapshot, restore into a fresh engine, `XLEN` matches |
| **T-025** | Write `src/engine/phase1.integration.test.js`: one test that seeds 5000 keys, sets `maxmemory-policy allkeys-lru`, lowers `memoryLimit`, and asserts eviction fired, `keysEvicted > 0`, and `memoryBytes <= memoryLimit`. A second test that runs a full stream producer/consumer cycle end to end: `XADD` ×100 → `XGROUP CREATE` → `XREADGROUP` ×100 → `XACK` ×50 → `XPENDING` reports 50. | `npx vitest run src/engine/phase1.integration.test.js` |
| **T-026** | Update `AGENTS.md`: add a `## Streams, Eviction & Latency` section, 5 lines maximum, pointing at the new files. Follow the existing terse style — do not write prose. | manual read |

## PHASE 1 GATE

```bash
npm test
npm run build
```
**Required:** ≥ 730 tests passing, zero failures, build succeeds.

---

# PART D — PHASE 2 · SIMULATION CORE

**Every file in this phase obeys L1, L2, L18, L19.** The architecture test from T-005 enforces it. Run it after every task in this phase.

---

### TASK T-027 · Entity store

**DEPENDS ON:** T-026
**READ FIRST:** `src/game3d/config/budgets.js`
**CREATE:** `src/game3d/sim/entity/EntityStore.js` + `.test.js`

**CONTRACT:**
```js
export const MAX_ENTITIES = 400   // must equal BUDGETS.sim.maxEntities

export function createEntityStore(capacity = MAX_ENTITIES)
// returns:
{
  capacity,
  count,                    // number of live entities
  alive:      Uint8Array,   // capacity
  archetype:  Uint8Array,   // capacity — index into ARCHETYPES
  posX, posY, posZ:  Float32Array,
  velX, velY, velZ:  Float32Array,
  prevX, prevY, prevZ: Float32Array,   // for render interpolation
  yaw:        Float32Array,
  health:     Float32Array,
  maxHealth:  Float32Array,
  state:      Uint8Array,   // AI state index
  stateTime:  Float32Array, // seconds in current state
  ttlAt:      Float64Array, // absolute ms, 0 = no ttl
  flags:      Uint16Array,  // bitfield
  keyRef:     Array,        // string | null — the Redis key this entity mirrors
  spawn(archetypeIndex, x, y, z) -> id | -1
  despawn(id)
  reset()
  forEachAlive(fn)          // fn(id)
}
```

**RULES:**
1. Struct-of-arrays, not an array of objects. **All typed arrays are allocated once in `createEntityStore` and never reallocated** (Law L10).
2. `spawn` reuses the lowest free slot via a free-list `Int32Array`. Returns `-1` when full — never grows.
3. `despawn` sets `alive[id] = 0`, clears `keyRef[id] = null`, pushes the slot to the free list.
4. `forEachAlive` must not allocate — plain `for` loop, no `filter`, no `map`, no closures over new arrays.
5. Export `FLAGS` as a frozen object of bit constants: `HOSTILE: 1, INVULNERABLE: 2, TTL_BOUND: 4, MARKED: 8, BLOCKED: 16, STALKER: 32`.

**TEST CONTRACT:** 12 tests including a full spawn-to-capacity → `-1` → despawn → spawn-succeeds cycle, and a no-allocation check (spawn/despawn 10,000 times and assert `store.capacity` never changed).

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/sim/entity/EntityStore.test.js
npx vitest run src/game3d/__tests__/architecture.test.js
```

---

### TASK T-028 · Spatial hash

**DEPENDS ON:** T-027
**CREATE:** `src/game3d/sim/entity/spatialHash.js` + `.test.js`

**CONTRACT:**
```js
export function createSpatialHash(cellSize = 4)
hash.rebuild(entityStore)                       // clears and reinserts every alive entity
hash.queryRadius(x, z, radius, outArray)        // fills outArray with ids, returns count
hash.queryNearest(x, z, maxRadius, filterFn)    // -> id | -1
```

**RULES:** 2D grid on X/Z only (Y is ignored — the levels are floor-based). `outArray` is supplied by the caller and reused; `queryRadius` never allocates. Cell key is `(cellX * 73856093) ^ (cellZ * 19349663)` stored in a `Map<number, number[]>` whose arrays are reused via a length reset, not recreated.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/sim/entity/spatialHash.test.js
```

---

### TASK T-029 · SimWorld skeleton

**DEPENDS ON:** T-028
**READ FIRST:** `src/game/GameLoop.js` · `src/game3d/bootstrap.js`
**CREATE:** `src/game3d/sim/SimWorld.js` + `.test.js`

**CONTRACT:**
```js
export function createSimWorld({ runtime, seed, clock })
// runtime is the object from createRuntime(). clock is () => ms.

world.entities            // the EntityStore
world.hash                // the spatial hash
world.tick                // integer, increments once per step
world.timeMs              // simulated elapsed ms
world.timeScale           // 1.0 normally; 0.35 in the card composer; 0.25 in the terminal
world.rng                 // seeded
world.engine              // the runtime's engine
world.bus                 // the runtime's bus
world.systems             // ordered array
world.step(dtSeconds)     // advances exactly one fixed tick
world.addSystem(system)   // { name, order, update(world, dt) }
world.snapshot()          // JSON-safe sim state
world.restore(snap)
world.stateHash()         // deterministic string hash of the whole sim state
```

**RULES:**
1. `step(dt)` applies `timeScale`: the effective dt is `dt * world.timeScale`, but `world.tick` still increments by exactly 1.
2. Systems run in ascending `order`. Fixed order constants:
   ```js
   export const SYSTEM_ORDER = {
     INPUT: 10, REDIS: 20, MOVEMENT: 30, PHYSICS_SYNC: 40, AI: 50,
     COMBAT: 60, TTL_LIFE: 70, MEMORY_PRESSURE: 80, LATENCY: 90,
     OBJECTIVE: 100, DIRECTOR: 110, SCARE: 120, TEACHING: 130,
   }
   ```
3. `stateHash()` uses `hash32` from `src/engine/rng.js` over a canonical string built from: tick, every alive entity's rounded position (3 decimals) and health, and the sorted key list of the engine's active db. **Rounding is mandatory** — float noise breaks determinism tests.
4. No `Date.now()`. Time comes from the injected `clock` only, and only for wall-clock-dependent systems that ask for it.

**TEST CONTRACT:** 10 tests including: 100 steps advances tick to 100; systems run in order (use an array of push-recording stubs); `timeScale = 0.5` halves the dt seen by systems; `stateHash()` is stable across two identical runs and differs after one entity moves.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/sim/SimWorld.test.js
npx vitest run src/game3d/__tests__/architecture.test.js
```

---

### TASKS T-030 … T-040 · Remaining Phase 2 systems

Each follows the same card shape. Contract summaries:

| Task | File | Contract |
|---|---|---|
| **T-030** | `sim/systems/MovementSystem.js` | Reads `velX/velY/velZ`, integrates position, applies `FEEL.move.groundFriction` and gravity. Writes `prevX/Y/Z` before integrating. No allocation. |
| **T-031** | `sim/systems/AISystem.js` | Per-archetype FSM. States as integers, not strings. `stateTime` accumulates. Behaviours: `IDLE, PATROL, ALERT, CHASE, ATTACK, FLEE, DYING`. Uses `hash.queryNearest` for targeting. |
| **T-032** | `sim/systems/CombatSystem.js` | Damage queue drained per tick, i-frames via `FLAGS.INVULNERABLE` + a timer array, hit-stop by setting `world.hitStopUntilMs`. Emits `sim:damage` and `sim:death` on the bus. |
| **T-033** | `sim/redis/CommandIntent.js` | `buildIntent(toolId, targetKey, modifiers)` → `{ line, toolId, targetKey }`. **One place where every tool becomes a command string.** Never string-concatenate a command anywhere else. |
| **T-034** | `sim/redis/RedisActionBridge.js` | `flush(world)` drains the intent queue, calls `world.engine.execute(intent.line)`, publishes `sim:commandResult` with `{ intent, reply, costMs }`. Max 8 intents per tick. |
| **T-035** | `sim/systems/TtlLifeSystem.js` | Reads `PTTL session:7742` every 6 ticks; maps remaining ms to player health 0..1; fires `sim:playerExpired` at zero. **This is the spine mechanic — see plan §6.4.** |
| **T-036** | `sim/systems/MemoryPressureSystem.js` | `pressure = engine.memoryBytes / engine.memoryLimit`, clamped 0..1. Writes `world.memoryPressure`. Drives Evictor speed as `0.6 + 1.4 * pressure` m/s. |
| **T-037** | `sim/systems/LatencySystem.js` | Consumes `engine.lastCommandCostMs`; if `> 8 ms`, sets `world.stallUntilMs = clock() + costMs` so the view can render a real hitch. Maintains a p99 estimate over the last 100 commands for REX degradation. |
| **T-038** | `sim/systems/ObjectiveSystem.js` | Wraps `evaluateObjectives` from the existing evaluator. Re-evaluates every 12 ticks, not every tick. Publishes `sim:objectiveChanged` only on transitions. |
| **T-039** | `sim/replay/InputLog.js` | `record(tick, intent)`, `serialize()`, `deserialize(json)`. Fixed-size ring of 20,000 entries. |
| **T-040** | `sim/replay/ReplayHarness.js` | `runHeadless({ seed, inputs, ticks })` → `{ stateHash, beatsPlayed, ending, tick }`. Creates its own runtime; never touches the DOM. |

**PHASE 2 GATE — the keystone test.** Create `src/game3d/sim/determinism.test.js`:

```js
it('reproduces an identical run from the same seed and input log', () => {
  const a = runHeadless({ seed: 'gate-1337', inputs: FIXTURE, ticks: 3600 })
  const b = runHeadless({ seed: 'gate-1337', inputs: FIXTURE, ticks: 3600 })
  expect(a.stateHash).toBe(b.stateHash)
})
it('diverges on a different seed', () => {
  const a = runHeadless({ seed: 'gate-1337', inputs: FIXTURE, ticks: 3600 })
  const c = runHeadless({ seed: 'gate-9999', inputs: FIXTURE, ticks: 3600 })
  expect(a.stateHash).not.toBe(c.stateHash)
})
it('runs 3600 ticks inside the sim budget', () => {
  const t0 = process.hrtime.bigint()
  runHeadless({ seed: 'perf', inputs: FIXTURE, ticks: 3600, entities: 400 })
  const msPerTick = Number(process.hrtime.bigint() - t0) / 1e6 / 3600
  expect(msPerTick).toBeLessThan(BUDGETS.frame.simStepMs)
})
```

**If the determinism test fails, stop the entire build and fix it before Phase 3.** Everything downstream — replays, bug reports, Director balance testing, speedruns — depends on it.

---

# PART E — PHASES 3–6 · TASK CARD TEMPLATES

Phases 3 through 6 follow the identical card format. Rather than list 60 more cards, here is the **exact template** plus the task inventory. Fill one card per row before starting it, and keep the card in `BUILD-STATUS.md`.

### E.1 The card template — copy this shape exactly

```markdown
### TASK T-XXX · <imperative title, max 8 words>

**DEPENDS ON:** T-YYY
**READ FIRST:** <file paths, with line ranges where the file exceeds 200 lines>
**DO NOT READ:** <large files the model might be tempted by>
**CREATE:** <exact paths>
**MODIFY:** <exact paths + the anchor text to search for>

**CONTRACT:**
```js
<every export, with its full signature and return shape>
```

**RULES:**
1. <numbered, imperative, unambiguous>
2. <state exact constant values, never "reasonable" or "appropriate">
3. <name the Hard Laws this task must satisfy>

**TEST CONTRACT:**
<the exact test cases, as a numbered list. Minimum count stated.>

**ACCEPTANCE:**
```bash
<the exact command>
```
**DONE WHEN:** <binary condition>
**IF IT FAILS:** <the specific remediation, not "debug it">
```

### E.2 Phase 3 inventory — player, physics, feel (view layer begins)

| Task | File | Key contract points |
|---|---|---|
| T-041 | `view/Game3DRoot.jsx` | `<Canvas>` with `dpr={[0.6,2]}`, `gl={{ antialias:false, powerPreference:'high-performance' }}`, `<AdaptiveDpr pixelated />`. Creates the runtime once in a `useRef`, disposes on unmount (L13, L14). |
| T-042 | `view/SimProvider.jsx` | React context exposing `{ world, runtime }`. **Exposes refs, not state** (L9). Runs `GameLoop` in a `useEffect`, stops on cleanup. |
| T-043 | `view/player/CharacterController.jsx` | Rapier `KinematicCharacterController`. Capsule 0.4 r × 1.8 h. Offset 0.01. `setApplyImpulsesToDynamicBodies(true)`. Reads `FEEL.move`. |
| T-044 | `view/player/PlayerRig.jsx` | `PointerLockControls` from drei. Head bob and strafe roll from `FEEL.camera`. FOV lerp on sprint. |
| T-045 | `view/player/WeaponRig.jsx` | Spring-damper recoil (`FEEL.weapon`). Sway lags camera velocity. **All math in `useFrame` with pre-allocated `Vector3`s declared outside the component** (L10). |
| T-046 | `view/fx/PostChain.jsx` | The exact chain and order from plan §14.2. Every parameter bound to a sim value via a ref, not state. |
| T-047 | `config/quality.js` | The degrade ladder from plan §14.4, in the stated order. Hysteresis: degrade below 50 fps, restore above 58. |
| T-048 | `view/level/LevelLoader.jsx` | `useGLTF` with Draco. Colliders from the manifest, never generated at runtime. Suspense boundary per chapter. |
| T-049 | `view/entities/EnemyInstances.jsx` | One `InstancedMesh` per archetype. Matrices written from the entity store's Float32Arrays in `useFrame`. Zero React re-renders. |
| T-050 | `view/debug/SimInspector.jsx` | Dev-only overlay: fps, ms per stage vs `BUDGETS`, entity count, draw calls, active beat, ledger values. Toggled with F3. |

### E.3 Phase 4 inventory — the teaching layer (highest risk; see plan §8)

| Task | File | Key contract points |
|---|---|---|
| T-051 | `sim/teaching/LadderState.js` | Tiers 0–3, never decreasing. `canUseTier(n)` gates by chapter. Records tier usage per concept for the ledger. |
| T-052 | `sim/teaching/VocabularyLadder.js` | `nameFor(conceptId, stage)` → the physical / game / real string. Stage advances on debrief completion, never on a timer. |
| T-053 | `content/vocabulary.js` | **Data only.** One row per concept: `{ id, physical, game, real, firstSeenChapter }`. Minimum 24 concepts. |
| T-054 | `view/hud/CardComposer.jsx` | The radial. Hold-RMB opens, release fires. Slows time to `FEEL.ui.cardComposerSlowFactor`. **Must display the assembled real command string as it builds.** Target: under 1.5 s per action once learned. |
| T-055 | `view/hud/ReceiptLine.jsx` | Two-column line: plain-language left, real syntax right. Visible `FEEL.ui.receiptVisibleMs`. Fades, never blocks. |
| T-056 | `sim/teaching/DebriefQueue.js` | Enqueues on incident resolve. **Never dequeues while `scareDirector.isActive` is true** (plan §7.2 fairness). |
| T-057 | `view/hud/DebriefCard.jsx` | The exact six-field layout from plan §8.4. Fully pauses the sim (`world.timeScale = 0`). |
| T-058 | `content/chapters/ch1/debriefs.js` | Data only. Six fields per debrief, all prose written for a non-technical reader. |
| T-059 | `sim/teaching/FieldManual.js` | Page store, dedup, ordering, and `exportMarkdown()` producing a real runbook document. |
| T-060 | `sim/teaching/RecallGate.js` | Chapter-open retrieval check. 45 s. No hint. Failure re-opens the prior debrief and is recorded, not punished. |

### E.4 Phase 5 inventory — the horror layer (see plan §7)

| Task | File | Key contract points |
|---|---|---|
| T-061 | `sim/horror/scareTypes.js` | The eight types T1–T8 as data: `{ id, baseEffectiveness, cooldownMs, minTension, requiresLineOfSight, audioCue }`. |
| T-062 | `sim/horror/FlinchMeter.js` | Samples input deltas for 400 ms after a scare. `flinch = w1*mouseJerk + w2*inputReversal + w3*inputFreeze`, normalised 0..1. Weights: 0.5 / 0.3 / 0.2. |
| T-063 | `sim/horror/ScareDirector.js` | Cadence table from plan §7.2. Fatigue per type, decaying over 240 s. Selection weight `base × (1 − fatigue) × contextFit`. |
| T-064 | `sim/horror/scareFairness.js` | The five hard rules as pure predicates so they can be property-tested independently. |
| T-065 | `audio/AudioDirector.js` | The six-bus graph from plan §15.1, including the scare bus with 12 dB reserved headroom. |
| T-066 | `audio/ProceduralSfx.js` | A synthesised fallback for every sound id, so the game ships before any sample is downloaded. |
| T-067 | `sim/horror/scareFairness.test.js` | **Property test: 1000 seeded 20-minute runs.** Assert no fairness rule is ever violated and no type repeats within four events. |

### E.5 Phase 6 inventory — Chapter 1 vertical slice

| Task | Deliverable |
|---|---|
| T-068 | `content/chapters/ch1/level.json` — grey-box geometry, spawn points, collider manifest |
| T-069 | `content/chapters/ch1/beats/*.js` — eight beats with gates, weights, cooldowns |
| T-070 | `content/residents/margit.js`, `delacroix.js` — three states each, dialogue, the lesson each carries |
| T-071 | `content/clues/ch1/*.js` — six clues across the six types |
| T-072 | `content/enemies/crawler.js` — archetype, FSM tuning, spawn cost |
| T-073 | `content/enemies/evictor.js` — the stalker; speed bound to `world.memoryPressure` |
| T-074 | `sim/director/Director.js` — the weighted stress model from plan §11.1 |
| T-075 | `sim/story/StoryGraph.js` + `DramaLedger.js` — plan §11.2 and §11.4 |
| T-076 | `sim/director/EncounterBuilder.js` — beat → world mutation via `silentExecute` |
| T-077 | Chapter 1 integration test: headless 30-minute run reaching the chapter-end flag |

---

# PART F — FAILURE PLAYBOOK

Symptom on the left, **exact** action on the right. Do not improvise.

| Symptom | Action |
|---|---|
| `npm test` drops below the previous count | `git stash`, re-run, confirm the count returns. The last task broke an existing test. Read the failure name, open **only** that test, and find which of your changes altered its assumption. |
| `npm install` reports a React peer conflict | A dependency version is wrong. Re-read T-002 character by character. Never use `--force` or `--legacy-peer-deps`. |
| Architecture test fails with "sim must not import three" | Move the offending code to `view/`. Do not add an exception to the test. |
| Isolation test fails on `eventBus` | You imported the singleton. Change to `import { EventBus }` and `new EventBus()`. |
| Determinism test fails intermittently | Search `sim/` for `Math.random`, `Date.now`, `performance.now`, `Object.keys` iteration over an object, and `Set`/`Map` iteration whose insertion order varies. Sort before iterating. |
| Determinism test fails consistently after a change | Your `stateHash` inputs include an unrounded float. Round to 3 decimals. |
| Frame rate below 50 with few entities | Open the F3 inspector. If `drawMs` is high, you are not instancing. If `sceneUpdateMs` is high, you are allocating in `useFrame`. |
| "Cannot read property of undefined" in a system | A system ran before its dependency. Check `SYSTEM_ORDER`; the numbers are authoritative. |
| React warns "Maximum update depth exceeded" | You put per-frame data in `useState`. Law L9. Convert to a ref. |
| WebGL context lost after a hot reload | Expected in dev. Ensure `Game3DRoot` disposes on unmount (L14) and reload the page. |
| The model produces TypeScript | Re-paste the session preamble. It drifted. |
| The model rewrites an unrelated file | Revert with `git checkout <file>`, re-paste the preamble, re-paste the card. |
| The model claims a test passes without running it | Ignore the claim. You run the command. This is why step 8 of the task loop exists. |
| The model invents a helper that does not exist | It skipped the API Reference Card. Paste §A.5 into the session and retry. |
| A task takes more than two model attempts | Split the card in half and run each half as its own session. Small models fail on card size, not on difficulty. |

---

# PART G — ANTI-SLOP RULES

Specific mistakes that small models make in React/three.js game code. Each one is a review-blocking defect.

| # | Never | Instead |
|---|---|---|
| G1 | `useState` for position, health, or timers | A ref, or the entity store's typed array |
| G2 | `new THREE.Vector3()` inside `useFrame` | Declare it at module scope and reuse it |
| G3 | `<mesh>` per enemy | One `InstancedMesh` per archetype |
| G4 | `useEffect` with no cleanup | Every subscription, listener and timer is cancelled |
| G5 | `setInterval` for game logic | The fixed-timestep `GameLoop` |
| G6 | `Math.random()` for gameplay | `world.rng()` |
| G7 | `Date.now()` in a system | The injected clock |
| G8 | Loading a texture per component | A shared loader with a cache |
| G9 | `JSON.parse(JSON.stringify(x))` to clone | An explicit copy of the fields you need |
| G10 | `array.filter().map()` in a hot loop | One `for` loop, no intermediates |
| G11 | `async` in a system update | Systems are synchronous. Queue the work. |
| G12 | Inline string literals for player-facing text | A content file (L21) |
| G13 | A magic number in a component | A named constant in `config/feel.js` or `config/budgets.js` |
| G14 | `try/catch` that swallows silently | Either handle it or let it throw. Never `catch {}`. |
| G15 | A "TODO: implement" left in a completed task | Finish it or mark the task BLOCKED |
| G16 | Renaming an existing export "for clarity" | Leave existing APIs exactly as they are |
| G17 | Adding a dependency to solve a small problem | Write the 20 lines |
| G18 | A comment restating the code | Comment the *why*, never the *what* |
| G19 | Deleting a failing test | Fix the code, or mark the task BLOCKED |
| G20 | `export default` in a sim or system module | Named exports only. `export default` is allowed **only** in `.jsx` components and `game3d/index.js`. |

---

# PART H — DEFINITION OF DONE

A task is complete only when **every** box is true.

```
[ ] The acceptance command was run by the operator and passed
[ ] `npm test` reports at least the previous passing count
[ ] `npm run build` succeeds
[ ] `npx vitest run src/game3d/__tests__/` passes (both guard rails)
[ ] The new file has a header comment explaining its purpose
[ ] No semicolons, 2-space indent, single quotes, named exports
[ ] No console.log
[ ] Every Hard Law named in the card is satisfied
[ ] A test file exists for every new module (L16)
[ ] BUILD-STATUS.md updated to DONE with the commit hash
[ ] Committed with the message `T-XXX: <title>`
```

A **phase** is complete only when its gate command passes and a human has played the result.

---

# PART I — QUICK REFERENCE CARD

Print this. It is what a model needs in front of it at all times.

```
REPO      E:\personal projects\redis-quest
STACK     React 18.3.1 · Vite 8 · Vitest 4 · Zustand 5 · Tailwind 3
3D STACK  three 0.171.0 · R3F 8.18.0 · drei 9.122.0 · rapier 1.5.0 · pp 2.19.1
STYLE     ESM · no semicolons · 2 spaces · single quotes · named exports
TEST ENV  node by default · `// @vitest-environment jsdom` on line 1 for DOM tests
BASELINE  614 tests passing at commit 9e95e0b

sim/  = no three, no react, no window, no Date.now, no Math.random
view/ = three and react allowed, no gameplay state
game3d/ = never imports gameStore, SoundEngine, or any exported singleton

FULL SUITE      npm test
ONE FILE        npx vitest run <path>
GUARD RAILS     npx vitest run src/game3d/__tests__
BUILD           npm run build
DEV             npm run dev

WHEN UNSURE     output "BLOCKED: <reason>" and stop.
                A blocked task is a good outcome.
                A guessed task is a bad outcome.
```

---

*End of manual. The three instructions that matter most, in order: one task card per session; the operator runs the acceptance command, not the model; and a blocked task is always better than a guessed one.*
