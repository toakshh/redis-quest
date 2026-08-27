# REDIS QUEST — PROTOCOL ZERO
### Master Plan for the 3D Horror Game Mode

**Document status:** Implementation blueprint · v2.0 · 2026-08-19
**What this is:** A dark horror, jumpscare-driven 3D game — a **completely separate game mode** from the existing 2D game — designed so that a player with **no technical background** can play it, learn real production Redis skills through it, and use those skills at work afterwards.

> **v2.0 changes from v1** (all four were owner corrections):
> 1. 2D and 3D are now **fully isolated modes** — separate engine instances, separate saves, separate progression. The v1 shared-keyspace idea is removed entirely.
> 2. Audience is now **non-technical players first**. Typing commands is no longer the primary interaction; it is the top rung of a four-tier ladder. Real-world skill transfer is now an explicit, measured system (§8).
> 3. Characters, clues and mid-game events are now a **formal curriculum system** (§9), not set dressing.
> 4. Horror intensity is raised to **frequent jumpscares** with a dedicated adaptive Scare Director (§7). My earlier "no gore, dread only" recommendation is withdrawn.

---

## 1. Directives, derivations, and assumptions

To keep this reviewable, everything in this plan is tagged by where it came from. **Strike anything in the ASSUMED column freely — none of it is load-bearing.**

### 1.1 DIRECTED — given by the owner, treated as fixed requirements

| # | Directive |
|---|---|
| D-1 | A 3D AAA-quality game mode inside redis-quest |
| D-2 | Fast-paced mystery / horror / shooting |
| D-3 | Teaches and uses **real production** Redis skills — caching, load balancing, rate limiting, queues, and other production use cases |
| D-4 | Storyline-driven; must feel like a high-quality studio product with detail and smooth animation |
| D-5 | React, three.js, plus libraries for physics and sound |
| D-6 | Unpredictable storyline that keeps changing based on player **actions and timing** |
| D-7 | Player is attacked, must escape, complete missions, learn skills, use skills, and solve problems to move ahead |
| D-8 | SFX and sound must be extremely aggressive |
| D-9 | Use available internet assets, without compromising quality or storyline |
| D-10 | **2D and 3D are separate, individual modes — do not mix them** |
| D-11 | **Non-technical players must be able to play, learn, and carry the skills into real production** |
| D-12 | **People, characters, events and clues in the mid-game must each teach something valuable** |
| D-13 | **Dark horror theme with frequent, intense jumpscares** |

### 1.2 DERIVED — read from this repository, verifiable, not opinion

Everything in §3 (current-state audit), §4 (post-mortem of the deleted 3D attempt), §13 (engine capability gaps) and the dependency compatibility findings in §12.2. Each carries a file and line reference. These are facts about the codebase, checked today.

### 1.3 ASSUMED — my creative and engineering choices; overrule at will

| # | Assumption | Where | Cheap to change? |
|---|---|---|---|
| A-1 | Setting: an abandoned datacenter, "Facility NODE-7" | §6 | Yes — swap the skin, keep the systems |
| A-2 | The player's health is a live TTL on their own session key | §6.4 | **No** — this is the spine of the teaching design |
| A-3 | The antagonist is the eviction policy personified | §6.3 | Medium — the mechanic matters more than the character |
| A-4 | Six chapters, roughly 3 hours | §6.6 | Yes |
| A-5 | REX (the existing 2D companion) returns as a drone | §9.2 | Yes |
| A-6 | Four endings driven by player behaviour | §6.7 | Yes |
| A-7 | Character names and specific dialogue beats | §9 | Yes — placeholders |
| A-8 | Milestone ordering and day estimates | §19 | Yes |

---

## 2. Product definition

### 2.1 Two separate products, one shell

| | **2D — Redis Quest** (exists) | **3D — Protocol Zero** (this plan) |
|---|---|---|
| Genre | Terminal puzzle / RPG | Survival horror shooter |
| Audience | Developers learning Redis commands | **Anyone. No prior technical knowledge required.** |
| Primary input | Typing commands | Physical action and a card-based composer; typing is optional and unlocked later |
| Engine instance | `App.jsx`'s singleton | **Its own, separate instance** |
| Save data | `redis-quest:*` | `redis-quest:3d:*` |
| Progression | XP, achievements, skill tree | Independent: Field Manual, Fluency, chapter ranks |
| Teaches | Command syntax and data types | Production behaviour and the judgement to apply it at work |

**They share code. They never share state.** The rules and enforcement are in §5.

### 2.2 Design pillars

- **P1 — Playable by anyone on minute one.** If a player who has never heard the word "cache" cannot survive the first five minutes, the design has failed. Every mechanic is introduced physically before it is ever named.
- **P2 — Mechanically honest.** No mechanic may teach something false about Redis. A `DEL` of a huge collection *will* stutter the frame; `UNLINK` will not. That hitch is the lesson.
- **P3 — Terror is the teacher.** Concepts arrive as symptoms in the dark, under pressure, never as tutorial text. Fear makes the lesson stick; the debrief afterwards makes it usable.
- **P4 — Every run diverges.** Different incident order, different beats, different scares, different ending.
- **P5 — Aggression in every frame.** Sub-bass on every impact, 60 ms hit-stop, brutal audio. Nothing feels papery.
- **P6 — It has to transfer.** The player finishes with a real, exportable runbook of things they can do at work on Monday. This is measured (§8.6), not hoped for.
- **P7 — 60 FPS is a feature.** A game about latency that stutters is a broken argument.

### 2.3 Target experience

- 25–35 minutes per chapter, six chapters, roughly 3 hours; plus an endless "Pager Duty" mode.
- Desktop Chromium / Firefox / Safari, WebGL2, mouse and keyboard.
- 60 FPS at 1080p on a 2020 mid-range laptop iGPU; 30 FPS floor with automatic quality reduction.
- **Content warning at launch**: frequent jumpscares, sustained dread, loud sudden audio, darkness, flashing. With accessibility options that reduce each without removing the game (§18.3).

---

## 3. Verified current state (audit)

Read from the repository, not assumed.

### 3.1 What exists and is reusable **as code, not as shared state**

| Asset | Location | Reuse mode for 3D |
|---|---|---|
| `MockRedisEngine` — 130+ commands, 16 DBs, TTL, MULTI/EXEC/WATCH, EVAL, pub/sub, memory accounting, seeded RNG, snapshot/restore | [engine.js](src/engine/engine.js) | **Instantiate a second, independent engine** via `createEngine()`. Same class, separate object. |
| `RedisGameBridge` — diffs the store after each command, emits 18 kinds of typed visual-effect events | [RedisGameBridge.js](src/engine/RedisGameBridge.js) | Instantiate a 3D-owned bridge against the 3D engine |
| `EventBus` **class** | [EventBus.js](src/engine/EventBus.js) | Use the class. **Never** the exported `eventBus` singleton |
| `IncidentEvaluator` — 11 pure objective predicates over store state | [IncidentEvaluator.js](src/systems/incidents/IncidentEvaluator.js) | Pure functions, no state — safe to import directly |
| `IncidentEngine` **class** — DORMANT → ACTIVE → ESCALATING → MITIGATED → RESOLVED/FAILED with pressure and health drain | [IncidentEngine.js](src/systems/incidents/IncidentEngine.js) | Use the class. **Never** the exported `incidentEngine` singleton |
| `GameLoop` — fixed timestep, spiral-of-death guard, manual `step()` for headless tests | [GameLoop.js](src/game/GameLoop.js) | Instantiate a 3D-owned loop |
| `ScoreEngine`, `MasteryEngine`, `HintEngine` | [systems/](src/systems/) | Classes reused; 3D creates its own instances with 3D-specific tuning |
| Test suite: **36 files / 614 tests, all green (22 s)** | `npm test` | The regression fence at every milestone |

### 3.2 Test harness reality

- Vitest defaults to the `node` environment ([vite.config.js](vite.config.js)); component tests opt in per file with `// @vitest-environment jsdom`.
- jsdom has **no WebGL and no `HTMLCanvasElement.getContext`** — the suite already emits `Not implemented: getContext()` warnings.
- **Consequence:** no 3D test may require a GL context. This constraint shapes §12 and §19.

### 3.3 Verified capability gaps (must be built — §13)

| Gap | Evidence | Blocks |
|---|---|---|
| **No Streams.** No `XADD` / `XLEN` / `XRANGE` / `XGROUP` / `XREADGROUP` / `XACK` / `XPENDING` / `XAUTOCLAIM` in the registry | full command dump of [src/engine/commands/](src/engine/commands/) | The entire queue chapter and consumer-group pedagogy (D-3) |
| **Cache hit/miss is fake.** `keyspace_hits:0` and `keyspace_misses:0` are string literals | [server.js:152](src/engine/commands/server.js:152) | Hit-ratio-driven darkness; caching lessons |
| **No eviction.** `maxmemory-policy` returns a constant `'noeviction'`; `lruTick` is recorded but never consumed | [debug.js:569](src/engine/commands/debug.js:569), [engine.js:144](src/engine/engine.js:144) | The antagonist and the finale |
| **No blocking or latency model.** `BLPOP`/`BRPOP` exist but cannot block; no slow-command simulation | [lists.js](src/engine/commands/lists.js) | The `DEL`-vs-`UNLINK` lesson; the Blocked enemy |
| **No standalone `SETNX`** (only `SET … NX`) | command dump | Lock-idiom teaching (trivial to add) |

### 3.4 Hygiene noted in passing (not fixed by this plan)

- Duplicated modules: `src/systems/ConsequenceEngine.js` vs `src/systems/consequences/ConsequenceEngine.js`; likewise `HintEngine` and `WorldStateResolver`. The 3D mode imports the **subdirectory** versions, which are the ones AGENTS.md documents.
- [SoundEngine.js](src/audio/SoundEngine.js) fetches BGM from `/src/assets/audio/*.mp3` — a dev-server path that will break in a production build. The 3D mode has its own audio stack and is unaffected, but the 2D bug is real.
- Stray `test_fix.txt`, `test_fix2.txt` in the repository root.

---

## 4. Post-mortem: why the last 3D attempt was deleted

Commit `9e95e0b` removed `src/components/Game3D/` — an 862-line hand-rolled `Engine3D.js`, a 377-line canvas component, and the `ModeSelector`. From reading the deleted code:

| Failure | Evidence | Rule it produces |
|---|---|---|
| Simulation welded to the renderer | `Engine3D` constructor builds scene, camera, renderer **and** `this.bossHp`, `this.projectiles` | **R1: no gameplay state in any module that imports three.js** |
| Tests forced a fake renderer | `console.error = () => {}` … `catch (e) { this.renderer = { render: () => {} } }` | **R2: the simulation must be testable with zero graphics stubs** |
| Redis was decorative | `castSetCommand()` pushes a projectile; no `engine.rawExecute` anywhere | **R3: every player action must round-trip through a real engine** |
| No content pipeline | arena, enemies and boss hardcoded inside the engine class | **R4: content is data, never code inside the engine** |
| Bundle cost paid by everyone | `three` a top-level dependency, eagerly imported | **R5: the 3D chunk is lazy-loaded and never in the 2D critical path** |

R1–R5 are acceptance criteria for every pull request. §5 adds **R6**, the mode-isolation rule.

---

## 5. Mode isolation (D-10)

The 2D game and the 3D game are two separate products that happen to live in one repository and share a build. They share **classes and pure functions**. They share **no runtime state whatsoever**.

### 5.1 The isolation contract

| Resource | 2D | 3D | Shared? |
|---|---|---|---|
| Redis engine instance | `App.jsx`'s `createEngine()` | `game3d` calls `createEngine()` itself | ❌ Never |
| Keyspace | its own 16 DBs | its own 16 DBs | ❌ Never |
| Zustand store | `store/gameStore.js` | `game3d/state/game3dStore.js` | ❌ Never |
| localStorage namespace | `redis-quest:` | `redis-quest:3d:` | ❌ Never |
| Progression (XP, achievements, skills) | existing | independent (Field Manual, Fluency, ranks) | ❌ Never |
| Audio engine | `audio/SoundEngine.js` | `game3d/audio/AudioDirector.js` | ❌ Never |
| Event bus | exported `eventBus` singleton | its own `new EventBus()` | ❌ Never |
| Incident engine | exported `incidentEngine` singleton | its own `new IncidentEngine()` | ❌ Never |
| Engine **class**, `GameLoop`, `EventBus` class, evaluator predicates, `rng` | — | — | ✅ Code only |

### 5.2 Forbidden imports, enforced by test

**R6:** no file under `src/game3d/` may import any of:

```
../store/gameStore.js          // 2D store
../audio/SoundEngine.js        // 2D audio singleton
{ eventBus }                   // the exported singleton, from anywhere
{ incidentEngine }             // the exported singleton
{ defaultMasteryEngine }       // the exported singleton
{ soundEngine }                // the exported singleton
```

Importing the **classes** (`EventBus`, `IncidentEngine`, `MasteryEngine`) is allowed and expected. `src/game3d/__tests__/isolation.test.js` walks every file under `game3d/` and fails the build on violation. Written in M0, before any gameplay code exists.

### 5.3 Entry point

Not a header toggle. A **launcher screen** on first load, presenting two distinct products:

```
┌───────────────────────────────┬───────────────────────────────┐
│  REDIS QUEST                  │  PROTOCOL ZERO                │
│  Learn Redis commands         │  Survive Facility NODE-7      │
│  Terminal · Puzzle · RPG      │  Horror · Shooter · Story     │
│  Instant                      │  ~40 MB download · needs GPU  │
│                               │  ⚠ Frequent jumpscares        │
└───────────────────────────────┴───────────────────────────────┘
```

`Game3DRoot` is loaded through `React.lazy`. A player who never clicks the right-hand panel downloads none of it.

### 5.4 Why complete isolation is right, not merely tidy

- **A non-technical player's first session must not inherit a developer's leftover keyspace.** The 3D onboarding depends on a known-empty, known-shaped world.
- Horror pacing depends on the world state being authored. A stray `FLUSHALL` from the 2D terminal would silently destroy a chapter.
- Independent save data means either mode can be reset, replayed or version-migrated without touching the other.
- Testability: a 3D determinism test cannot be deterministic if a shared singleton is mutated from outside.

---

## 6. Creative direction

### 6.1 Logline

> At 03:47 a maintenance contractor is sent into a datacenter that was shut down four years ago. It is still running. Inside are eleven thousand stored lives, something that has been alone with them, and a policy that says when memory runs out, something must be deleted.

### 6.2 Facility NODE-7

Six levels beneath a decommissioned exchange. **Wet concrete brutalism, failing amber emergency lights, cathedral rows of server racks, water on the floor.** Not neon cyberpunk — cold, industrial, real, and mostly dark. The horror is bureaucratic: this place is doing its job, correctly, and the job requires deletions.

**Diegetic rule:** every screen and readout in the world shows real output from the live 3D engine. Wall panels show actual key counts. When memory rises, the numbers on the walls rise. Nothing is fake set dressing — which means observant players learn to read the environment as a dashboard without being told they are doing so.

| Level | Name | Production topic | Horror texture |
|---|---|---|---|
| **-1** | Badge Hall | what a key is; TTL | Empty lobby; your own name on a countdown |
| **-2** | The Read Floor | caching, cache misses, stampede | Endless identical racks; things multiply in the dark when you miss |
| **-3** | The Catacombs | queues, streams, backlogs | Flooded conveyor tunnels; unfinished work whispers |
| **-4** | The Tollgate | rate limiting, load balancing | A vast mechanical throttle; whatever exceeds the rate is crushed |
| **-5** | The Mirror | replication, failover, split-brain | The level exists twice and the two disagree |
| **-6** | Cold Storage | eviction, capacity, out-of-memory | Where deleted things are kept. They are still awake. |

### 6.3 Cast

- **YOU — Contractor 7742.** On badge-in, the facility stored you. You are now a key with an expiry time. You have no name, only an identifier.
- **REX** — a battered maintenance drone clamped to your shoulder. The hint system made diegetic, and the primary teacher for non-technical players. **His voice degrades as the system slows down**: clear when healthy, clipped and stuttering under load, unintelligible when the facility is dying. Players learn to read system latency by how their only friend sounds.
- **THE EVICTOR** — the antagonist. Slow, unkillable, patient. It frees memory. It is not malicious; it is *correct*, which is worse. It cannot be shot; it can only be **delayed by needing less**. Its speed and reach scale with how full the facility's memory is.
- **THE ARCHIVIST** — a voice on the PA through chapters 1–5. A decommissioned operator persona; the only entity that believes the facility should keep running. An unreliable narrator whose true nature is revealed in chapter 6, differently depending on how the player has behaved.
- **The Residents** — six survivor-echoes met through the mid-game. Each one is a person who made one specific production mistake and is still living inside its consequence. They are the curriculum (§9).

### 6.4 The spine: your life is an expiry timer

```
        ┌───────────────────────────────────────────────────────┐
        │  YOUR LIFE = the countdown on session:7742 (real)      │
        └───────────────────────────────────────────────────────┘
                  │                                    ▲
   extend it by   │                                    │ it ticks down in real time,
   storing more   ▼                                    │ whether you act or not
        ┌────────────────┐   fills up   ┌────────────────────────┐
        │ facility memory│─────────────▶│  THE EVICTOR gets faster│
        └────────────────┘              └────────────────────────┘
                  ▲                                    │
   everything you │                                    │ it deletes things
   store to survive│                                   ▼
        ┌───────────────────────────────────────────────────────┐
        │ deleted = doors that no longer open, people who stop   │
        └───────────────────────────────────────────────────────┘
```

**Everything you do to survive strengthens the thing hunting you.** Winning means learning to survive while storing *less* — which is the actual production skill of capacity planning, arrived at through fear rather than a lecture.

### 6.5 The moment-to-moment loop

```
 hear a symptom  →  investigate in the dark  →  get attacked  →  escape or fight
        ↓                                                              ↓
   REX names it                                             act (Tier 0/1/2/3, §8)
        ↓                                                              ↓
   world reacts visibly ←──────────── consequence lands ←──────── it worked / it did not
        ↓
   30-second Production Debrief: "what you just did is called X, here is the real thing"
```

### 6.6 Chapters

| # | Title | Production skill (D-3) | Non-technical framing | Climax |
|---|---|---|---|---|
| 1 | **COLD START** | Keys, values, expiry times | "Everything here is a labelled box. Some boxes have a timer." | Choose: extend your own timer, or a stranger's |
| 2 | **THE STAMPEDE** | Caching, cache misses, stampede, staggered expiry, hot keys | "Asking the slow room costs you. Everyone asking at once kills you." | The Herd — survivable only by making just one request instead of a thousand |
| 3 | **BACKPRESSURE** | Queues, work distribution, acknowledgement, retries, dead letters | "Work that nobody confirmed finishing comes back." | Drain a huge backlog while your own unfinished work turns hostile |
| 4 | **THE TOLLGATE** | Rate limiting, load balancing, atomicity | "How many are allowed through per second — and who counts them?" | A boss that only takes damage from an action that cannot be interrupted |
| 5 | **THE MIRROR** | Replication, failover, split-brain, consistency | "There are two copies of this floor and they disagree about what happened." | Choose which copy is the truth, and defend that choice |
| 6 | **PROTOCOL ZERO** | Eviction policy, capacity planning, out-of-memory | "There is not enough room. Something has to go. You decide the rule." | THE EVICTOR. Unkillable. You pick the deletion rule and live with it. |

Load balancing appears twice on purpose: as **distribution** (spreading load across nodes, chapter 4) and as **failover** (what happens when a node dies, chapter 5), because production practitioners need both halves.

### 6.7 Endings — chosen by behaviour, not a dialogue menu

| Ending | Gate | What it means |
|---|---|---|
| **CAPACITY** | Stayed under the memory limit for the last 8 minutes without deleting anyone | The hardest, and the only clean one. You planned ahead. |
| **TRIAGE** | Deleted only things you had personally given a timer to | Pragmatic and honest. You marked what was expendable in advance. |
| **POLICY** | Let the facility's automatic rule choose | The coldest ending. You did not decide; the machine did. |
| **PURGE** | Wiped everything to make the problem stop | The "I fixed it" ending. Achievement named accordingly. |

---

## 7. Horror and the Jumpscare System (D-13)

Frequent jumpscares are a hard requirement, and frequent jumpscares are also the fastest thing in games to become boring. Doing this well requires a real system, not a list of scripted moments.

### 7.1 Scare taxonomy

| Type | Description | Typical cost | Notes |
|---|---|---|---|
| **T1 · Proximity lunge** | Something already in the room animates and lunges when the player closes in | Cheap | Placement is everything; must be visible-but-unnoticed beforehand |
| **T2 · Sting reveal** | Silence, then a full-mix hit plus an entity already in frame | Cheap | Depends entirely on the silence that precedes it |
| **T3 · False scare** | A pipe bursts, a rack topples, a rat runs — nothing is there | Cheap | **~35% of all scares.** These are what keep the real ones lethal |
| **T4 · Behind-you** | Spawns behind the player; breathing audio; visible only on turning | Medium | Never spawns inside the view frustum |
| **T5 · Interface invasion** | The HUD corrupts; the terminal types by itself; a face appears in the visor reflection | Cheap, very effective | Breaks the safety of the UI itself |
| **T6 · Diegetic Redis scare** | A resident is deleted mid-sentence; the thing you were holding expires and what it held back gets out | Medium | **The best type — the scare and the lesson are the same event** |
| **T7 · Relief punish** | Fires 2–4 s after a safety cue (door seals, music resolves, lights return) | Medium | Used sparingly; devastating when it lands |
| **T8 · Stalker reveal** | THE EVICTOR appears somewhere it should not be | Expensive | Reserved for chapter beats and memory-pressure spikes |

### 7.2 The Scare Director (`sim/horror/ScareDirector.js`)

Runs alongside the pacing Director (§11.1) and owns cadence, selection, and fairness.

**Cadence targets**

| Tension state | Target interval between scare events |
|---|---|
| High (combat, active incident) | 40–75 s |
| Medium (traversal under threat) | 60–120 s |
| Low (respite, exploration) | 2–4 min, and heavily weighted toward T3 false scares |
| During a Production Debrief | **Never.** Learning is protected (§8.4) |

That averages out to roughly **25–40 scare events per chapter** — frequent, per D-13, while remaining structured rather than random.

**Anti-habituation model.** Every type carries a fatigue value that rises on use and decays over roughly four minutes. Selection weight is `baseEffectiveness × (1 − fatigue) × contextFit`. Practical results: the same type never fires twice within four events, and a player who is being spammed with proximity lunges will start getting interface invasions instead.

**Adaptive intensity via measured flinch.** Within 400 ms of a scare the director samples the player's input: mouse-velocity spike, movement reversal, sudden stop, or the total absence of any of these.

```js
flinch = w1*mouseJerk + w2*inputReversal + w3*inputFreeze   // normalised 0..1
```

A rolling average of `flinch` becomes `playerDesensitisation`. Low flinch over five consecutive scares escalates: longer silences beforehand, more T7 relief-punishes, and a stalker beat brought forward. High flinch backs off slightly and lengthens respite. **This is D-6 — the story reacting to actions and timing — applied to fear itself.**

**Fairness rules, hard-coded.** No scare within 3 s of a required precise input, unless the beat is explicitly a pressure test. No scare that spawns an instant-kill without a readable telegraph. No scare during a debrief. No two identical types within four events. Every scare has an audio cue reachable at 40 m so headphone players can theoretically anticipate it.

### 7.3 Scares that teach (T6 — the design centrepiece)

The best scares in this game are the ones where the horror *is* the lesson:

| Scare | What it teaches |
|---|---|
| The resident you are talking to stops mid-word and is gone — their timer ran out while you were listening | Expiry is real time; it does not wait for you |
| You are carrying a light source; its timer expires; the room goes black and something is already close | Things with a timer are borrowed, not owned |
| You ask a question the facility has to look up (a miss). The lookup is loud. Something heard it. | Every miss costs latency *and* is visible to the rest of the system |
| Work you dispatched and never confirmed comes back wearing your equipment | Unacknowledged work does not vanish — it retries |
| Memory hits the ceiling; a whole corridor of doors deletes itself behind you while you are running | Out-of-memory is not an error message; it is a deletion |
| The mirror floor's copy of you performed a different action, and it committed first | Split-brain, felt rather than read |

### 7.4 Non-jumpscare horror layer

Constant dread beneath the spikes, or the spikes stop working: darkness scaled to cache hit ratio, distance-attenuated footsteps that are not yours, doors that are open when you return, residents who reference things you did in a previous chapter, and the persistent sound of a machine getting fuller.

### 7.5 Accessibility for horror (options, not dilution)

Default is full intensity. Options: **Reduced Scares** (halves cadence, disables T7 and T5), **Photosensitive Safe** (caps flash duration and strobe frequency, disables the glitch pass), **Audio Spike Limiter** (compresses transient peaks by 12 dB), and **Predictable Mode** (a subtle 1.5 s audio pre-cue before every scare) for players who want the story without the shocks. All are toggleable mid-run from the pause menu, because a player should not need to restart a chapter to make the game bearable.

---

## 8. Teaching non-technical players (D-11) — the core of this revision

This is the hardest requirement in the brief and it dictates more of the design than the horror does.

### 8.1 The problem, stated honestly

A person with no technical background cannot type `SET user:42 "x" EX 60 NX` while something is chasing them. If typing is the interaction, the game is unplayable for the target audience. But if the player never encounters real syntax, nothing transfers to real production and D-3 fails.

**The resolution is a four-tier ladder.** The player begins with no typing at all and can finish the campaign without typing — yet sees real syntax on screen thousands of times, in context, always attached to a consequence they caused.

### 8.2 The Interaction Ladder

**Tier 0 — PHYSICAL** *(Chapter 1, roughly the first 20 minutes)*
No text input of any kind. You find a glowing shard and slam it into a slot labelled `user:42`. The action is a shoulder-charge, not a keystroke.
A **receipt** prints at the bottom of the screen for half a second:

```
   ▸ stored  user:42 = "amber"                       SET user:42 "amber"
```

The player reads the left side. The right side goes in anyway. No quiz, no popup, no acknowledgement required.

**Tier 1 — CARDS** *(Chapter 1 onward — the primary interaction for the whole game)*
Hold right mouse → a radial of four to six **verb cards** appears; the game slows to 0.35×.

```
                    ⌁ READ
          ⌁ DELETE      ⌁ STORE
              ⌁ TIMER  ⌁ SHIELD
```

Pick a verb; the target you are aiming at auto-fills; modifier slots take **modifier cards** you have collected — a "60-second fuse" card is `EX 60`; a "only if empty" card is `NX`. The assembled command is displayed in full, real syntax as it builds, then executes for real.

Roughly 1.2 s per action once learned — fast enough for combat. **A player can complete all six chapters at Tier 1.**

**Tier 2 — GUIDED TYPING** *(unlocks in Chapter 3; entirely optional)*
The terminal appears with the blanks pre-shaped:

```
   SET ______ ______ EX ____
        ↑ tab between blanks · autocomplete on every field
```

Roughly 0.8 s per action. Grants a **Fluency** bonus and unlocks optional side-objectives that Tier 1 cannot reach.

**Tier 3 — FREE TYPING** *(unlocks in Chapter 4; optional forever)*
Full terminal, no scaffolding, the fastest option, the highest score, and the only way to attempt the four optional "Runbook" challenges. This is where a developer who arrived from the 2D mode lives.

**The ladder is never forced.** The game nudges with speed and score, and REX occasionally offers ("you can just type that, you know"), but every objective in the critical path is completable at Tier 1. Players self-select, and analytics on tier usage tell us whether the ladder is working.

### 8.3 The Vocabulary Ladder

Every concept carries three names, revealed in sequence:

| Stage | Example: TTL | Example: cache miss | Example: consumer group |
|---|---|---|---|
| **Physical** (first meeting) | "the fuse" | "the slow room" | "the work crew" |
| **Game** (after first use) | "Mark" | "a Miss" | "a Crew" |
| **Real** (after the debrief) | **TTL / EXPIRE** | **cache miss** | **consumer group** |

The HUD shows the physical name first, then physical + real, then real alone by chapter 4. **The player becomes fluent in real terminology without ever sitting through a vocabulary lesson.** A glossary toggle (`G`) shows all three columns at any time.

### 8.4 The Production Debrief

After each incident resolves — and *never* during a scare — a 30-second card appears. Time is fully paused, the music drops to a bed, and the lights come up slightly. This is the one moment of safety in the game, which is exactly why it is where the learning lands.

```
┌─────────────────────────────────────────────────────────────┐
│  WHAT JUST HAPPENED                                          │
│  Everyone asked for the same thing at the same second, and   │
│  the slow room could not keep up.                            │
│                                                              │
│  WHAT YOU DID                                                │
│  Let one request through and made the rest wait for it.      │
│                                                              │
│  IN THE REAL WORLD THIS IS CALLED                            │
│  Cache stampede protection · single-flight locking           │
│                                                              │
│  THE ACTUAL COMMAND                                          │
│    SET lock:product:9 <token> NX PX 3000                     │
│                                                              │
│  WHEN YOU WOULD USE IT AT WORK                               │
│  Any cache entry that is expensive to rebuild and popular    │
│  enough that many requests will miss it simultaneously.      │
│                                                              │
│  IF YOU GET IT WRONG                                         │
│  Your database receives every request at once. This is a     │
│  common cause of outages at exactly the wrong moment.        │
│                                                              │
│              [ SPACE — back to the dark ]        [ 📓 saved ] │
└─────────────────────────────────────────────────────────────┘
```

Skippable. Skipping costs nothing mechanically but is tracked, because if most players skip, the format is wrong and needs redesigning.

### 8.5 The Field Manual

Every debrief writes a page into a persistent codex, written as a **real runbook page**, not as game lore: symptom, diagnosis, command, when to use, failure mode, and how to verify it worked. It is readable in-game (`M`), searchable, and organised by production topic rather than by chapter.

**At the end of the campaign the game exports the Field Manual as a Markdown file** the player can keep, print, or paste into their team wiki. That artefact is the literal fulfilment of D-11: something they take to work on Monday.

### 8.6 Making the transfer measurable

Learning claims are worthless unless they are checked, so three mechanisms verify transfer:

1. **The Recall Gate.** Every chapter opens with a 45-second sequence that requires the *previous* chapter's skill, with no prompt and no hint. Spaced repetition, disguised as gameplay. Failing it is survivable but re-opens the earlier debrief.
2. **Transfer Encounters.** Each concept reappears at least once in a **different disguise**. Rate limiting is first learned as a door that only admits so many people per second; it reappears in chapter 5 as a resident's heartbeat that must not exceed a rate. Recognising the same idea in a new costume is the definition of transfer.
3. **The Exit Interview.** The final scene of chapter 6 is diegetic assessment: the Archivist asks six questions about what actually happened in the facility. Every answer maps to a production concept. **The score is reported as "you can now do these things at work", never as a grade**, and the specific concepts a player fumbles are flagged in the exported Field Manual as "worth reviewing".

Design target, measured at M7: **players with no prior Redis experience score ≥ 70% on the Exit Interview**, and can articulate what a cache miss costs. If they cannot, the chapter is redesigned before it ships — this is a milestone exit criterion, not an aspiration.

### 8.7 Difficulty is two independent axes

Non-technical players are not necessarily bad at shooters, and developers are not necessarily good at them. Two separate sliders:

- **Threat** — enemy damage, spawn density, scare cadence.
- **Puzzle pressure** — incident timers, TTL decay speed, hint availability.

A player can run maximum horror with generous puzzle timers, or a calm walk with brutal deadlines. Neither combination is labelled "easy".

---

## 9. Characters, clues and events as curriculum (D-12)

Every person, artefact and mid-game event carries exactly one production lesson. Nothing in the world is decoration.

### 9.1 The Residents — six survivors, six real mistakes

Each is met in the mid-game, each is trapped inside the consequence of one specific error, and each teaches by living in it. They are not quest-givers; they are cautionary tales that talk.

| Resident | Their mistake | What the player learns | Where |
|---|---|---|---|
| **MARGIT**, the archivist who kept everything | Stored data with no expiry, for years | Unbounded growth is not free. Memory is a budget with a hard edge. | Ch. 1 → recurs Ch. 6 |
| **DELACROIX**, who asked the slow room every time | Never cached; every request went to the source | What caching *is*, and what it costs not to have it | Ch. 2 |
| **VOSS**, who woke everyone at once | Gave ten thousand entries the same expiry time | Synchronised expiry is a self-inflicted outage. Stagger your timers. | Ch. 2 |
| **HANNE**, who listed every key to find one | Ran the "show me everything" command on a live system | Some operations are O(n) and block everything. Use the incremental one. | Ch. 3 |
| **OKONKWO**, who never confirmed the work | Dispatched jobs and never acknowledged completion | At-least-once delivery, pending work, retries, dead letters | Ch. 3 → payoff Ch. 4 |
| **THE TWINS**, who each believed they were in charge | Two nodes, no quorum, both accepted writes | Split-brain, and why a lock without a fence is not a lock | Ch. 5 |

Each resident has three states across the campaign — **encountered, understood, resolved** — and whether they reach "resolved" depends on the player applying the lesson later, not on dialogue choices. Margit survives chapter 6 only if the player has been disciplined about memory. **The residents are the Drama Ledger made flesh.**

### 9.2 REX, the teacher for a non-technical player

REX is the single most important accessibility feature in the game. He:

- **Names symptoms before concepts.** "It's slow because it's asking the far room every time" precedes the word "cache" by several minutes.
- **Escalates hints on a three-tier ladder** (existing `HintEngine`): observation → concept → the exact action. Tier 1 is free and automatic when the player is stuck for 25 s. Tiers 2 and 3 cost score and are always offered, never withheld.
- **Degrades audibly with system latency**, which teaches latency as a felt quantity.
- **Never says a real technical term before its debrief.** He is bound by the Vocabulary Ladder like everything else.

### 9.3 Clue types

| Type | Form | Teaching function |
|---|---|---|
| **Incident reports** | Pinned printouts of previous outages, with a redacted root cause | The player diagnoses the cause; correct diagnosis unlocks the full page |
| **Terminal histories** | A dead engineer's last commands, still in the scrollback | Reading real command sequences in context — powerful for non-technical players, who absorb syntax by exposure rather than instruction |
| **Whiteboards** | Half-erased architecture diagrams | Systems thinking; how the pieces connect |
| **Audio logs** | Voice recordings, positionally placed | Narrative plus concept, hands-free while moving |
| **Graffiti and warnings** | Scratched into walls by people who learned the hard way | Compressed rules of thumb: "NEVER LIST THE WHOLE ROOM" |
| **The Ledger Wall** (Ch. 6) | Every key you personally created, listed, with its timer | The player confronts their own memory footprint as a physical wall |

Clues are also the **soft hint layer**: a player who is stuck will find the level's clues resolve their confusion, so exploration is rewarded with understanding rather than with collectibles.

### 9.4 Mid-game events that demonstrate rather than tell

Authored set-pieces that show a concept happening at scale, live, before the player is asked to handle it themselves:

- **The Cascade** (ch. 2): watching from a gantry as one expired entry causes a visible wave of failures across the floor below. The player does nothing. They simply see what a stampede *is*.
- **The Backlog** (ch. 3): a conveyor visibly accelerating past what the crews can process, with the queue depth painted on the wall in three-metre numerals.
- **The Throttle** (ch. 4): the Tollgate crushing everything above its rate, in an unbroken rhythm the player learns to count.
- **The Divergence** (ch. 5): the same event playing out differently through two windows, at the same moment.
- **The Deletion** (ch. 6): the facility freeing memory, and the player watching precisely which things it chooses.

Each is 40–90 seconds, non-interactive or barely-interactive, and each is immediately followed by an encounter requiring the player to act on what they just saw. **Show, then require.**

---

## 10. Redis pedagogy → mechanics

The mechanic must *be* the lesson, not a mnemonic for it.

### 10.1 Tools

| Tool | Real command(s) | Mechanic | What it actually teaches |
|---|---|---|---|
| **PROBE** | `GET`, `TYPE`, `TTL` | Reveals an object's label, contents and remaining timer. A **hit is instant and silent; a miss takes 400 ms and makes a loud noise that attracts things** | Reads are not free; misses cost latency and are visible to everything nearby |
| **STORE** | `SET`, `SETEX` | Writes objects into the world as cover, bridges and light. Every write raises the memory level shown on the walls | Storage costs memory; memory is finite; a timer is a promise you are making |
| **TIMER** | `EXPIRE`, `PEXPIRE` | Marks a hostile with a countdown. It does not die on the tick — **it dies when something touches it** | Lazy vs active expiry, learned by having a marked enemy reach you anyway |
| **PURGE** | `DEL` | Instant removal, but on a large object it **stalls the frame in proportion to its size** | Some deletions are O(n) and block everything. This is why the whole system paused. |
| **RELEASE** | `UNLINK` | Same removal, resolves over several frames, no stall | Asynchronous reclamation. Pick your trade-off. |
| **ONE-SHOT** | `EVAL` (Lua) | An action that cannot be interrupted. The only thing that defeats enemies which exploit the gap between "check" and "act" | Race conditions are real; atomic operations are the fix |
| **CREW** | `XADD` + `XREADGROUP` | Deploys autonomous workers on a queue. **Workers whose results you never confirm accumulate and eventually turn hostile.** `XAUTOCLAIM` recovers them | At-least-once delivery, pending work, retries |
| **TOLLGATE** | `INCR` + `EXPIRE`, or an atomic bucket | A player-configured rate limiter with adjustable rate and burst. Enemies attack in bursts; a badly configured gate visibly fails at the window boundary | Fixed window vs sliding window vs token bucket — felt, not read |
| **SPREAD** | `CLUSTER` slots, hash tags | Distributes incoming load across deployed nodes. Over-referencing one node melts it, glowing red | Load balancing, hot keys, why resharding is not optional |
| **ANCHOR** | `SET NX PX` + fencing token | Lock pillars; capturing a majority seals an arena. A held-but-expired lock is visibly catastrophic | Distributed locks and fencing tokens |

### 10.2 Bestiary — every enemy is a production failure mode

| Enemy | Behaviour | Counter | Concept |
|---|---|---|---|
| **Crawler** | Spawns in a burst on every miss against a popular key | Let one request through and make the rest wait | Cache stampede |
| **The Herd** (ch. 2 boss) | Every crawler in the level converges the instant a shared timer expires | Stagger the timers | Synchronised expiry is self-inflicted |
| **Hot One** | Burning; damage scales with how often you read one object | Spread it across nodes | Hot-key skew |
| **The Waiting** | Frozen at a queue, waiting forever; drains you nearby | Give it work, or give it a deadline | Blocking without a timeout |
| **Revenant** | Work you dispatched and never confirmed; attacks with your own equipment | Confirm it, or reassign it | Unacknowledged work returns |
| **The Twins** | Your mirror, committing conflicting actions on the other copy | Establish a majority; enforce a fence | Split-brain |
| **Bloom** | Slime that grows with every object you store without a timer | Give your rubbish an expiry | Unbounded growth |
| **THE EVICTOR** | Unkillable. Speed scales with how full memory is. Takes things permanently, according to the current rule. | Need less | Eviction is a moral choice under constraint |

---

## 11. Unpredictability (D-6)

Four cooperating systems, all headless, all deterministic given a seed, all unit-testable.

```
 player input ─┐
 engine events ├─▶ DramaLedger ─┐
 wall clock ───┘  (who you are)  │
                                  ├─▶ StoryGraph ─▶ Beat ─▶ EncounterBuilder ─▶ world change
 sim telemetry ─▶ Director ──────┘  (what happens next)
 flinch response ─▶ ScareDirector ─▶ scare selection (§7.2)
```

### 11.1 The Director — pacing (`sim/director/Director.js`)

Models build → peak → relax → respite. Every 250 ms it computes `stress` in `[0,1]`:

| Signal | Source | Weight |
|---|---|---|
| Player timer remaining | `PTTL session:7742` on the 3D engine | 0.30 |
| Memory fullness | `engine.memoryBytes / memoryLimit` | 0.20 |
| Hit ratio, last 30 s | new statistics (§13.2) | 0.15 |
| Hostiles within 20 m | sim spatial index | 0.15 |
| Time since damage taken | sim | 0.10 |
| Error rate, last 60 s | `engine.stats.totalErrors` delta | 0.10 |

Outputs `targetIntensity`, `spawnBudget` (a cost allowance, not a count), `ambientTension` (drives audio and lighting), `reliefWindow`.

**Anti-frustration, hard-coded:** never spawn inside the view frustum within 8 m; never exceed the budget; guarantee 20 s of respite after any peak over 45 s; after two deaths at the same beat, silently reduce the budget by 25% and raise hint availability one tier.

### 11.2 The Story Graph — branching (`sim/story/StoryGraph.js`)

A weighted, gated beat pool per chapter rather than a linear script:

```js
{
  id: 'ch2.first_miss',
  chapter: 2,
  tags: ['incident', 'caching', 'teaches:stampede'],
  requires: [                                   // hard gates, all must pass
    { type: 'flagSet', flag: 'ch2.entered' },
    { type: 'hitRatioBelow', value: 0.7 },
    { type: 'notPlayedWithin', beats: 4 },
  ],
  weight: (ctx) => 1.0                          // soft weights shape probability
    + 1.5 * ctx.ledger.recklessness
    - 0.8 * ctx.ledger.fluencyWith('STORE')
    + 0.6 * ctx.director.stressDeficit,
  cooldownMs: 90_000,
  mutators: ['darkness', 'audioSwarm'],
  onEnter: 'beats/ch2/firstMiss.js',
}
```

Selection: filter by gates → weight → seeded weighted pick → apply cooldown and no-repeat window. The RNG is the engine's existing `createRng(seed)` ([rng.js](src/engine/rng.js)), so **a seed plus an input log reproduces a run exactly** — essential for bug reports and for balance-testing the Director across thousands of offline runs.

### 11.3 Timing pressure (D-6, "and timing")

1. **Real timers on world objects.** Doors, light sources and resident sessions carry genuine expiries in the 3D engine. Deliberate for ninety seconds and a door you opened has re-locked and a resident you were escorting is gone. Nothing warns you.
2. **Lazy-expiry horror.** Redis expires keys lazily on access as well as actively — modelled faithfully in [`_get()`](src/engine/engine.js:104). Consequence: an object whose timer has passed **stays until something touches it**. Shining your light on it is what finishes it. Players discover active-vs-lazy expiry by finding out that *looking* has consequences.
3. **Tempo profiling.** Fast, decisive players are routed to denser beats; careful players get longer investigative ones. Neither is punished; the content differs.

### 11.4 The Drama Ledger (`sim/story/DramaLedger.js`)

A behavioural profile derived only from observable events, never self-reported.

| Trait | Derived from | Steers |
|---|---|---|
| `recklessness` | writes per minute, memory growth rate, purge usage, damage taken while acting | Beat harshness, Evictor aggression |
| `precision` | success rate, wasted actions, mastery scores | Enemy complexity |
| `dependence` | hint tier usage and penalties | REX's tone; hint availability |
| `mercy` | choices where a resident was preserved at your own cost | Chapter 6 reveal, resident survival, ending gates |
| `tempo` | median time to first correct action | Beat density, respite length |
| `thrift` | peak memory fullness, objects stored without a timer | The CAPACITY ending gate; whether Margit lives |
| `fluency` | highest interaction tier used, per concept | Optional objectives, REX's nudges |
| `desensitisation` | rolling flinch average (§7.2) | Scare escalation |

The ledger is also the narrator's memory. The Archivist quotes the player's own numbers back at them in chapter 6: *"You stored four hundred and eleven things today. You set a timer on nine of them."*

### 11.5 Encounter builder

Turns a beat into concrete world change, all through the 3D engine so consequences are real: seed keys via `silentExecute` (which exists at [engine.js:301](src/engine/engine.js:301) precisely for this and is currently under-used) → filter the spawn table by budget → apply mutators → register objectives as evaluator predicates → publish audio and lighting cues.

---

## 12. Technical architecture

### 12.1 Layer model

```
┌───────────────────────────────────────────────────────────────────┐
│ LAYER 4 · VIEW (React + R3F)             three.js  ✅              │
│   Scene graph, materials, post FX, DOM HUD                        │
│   Reads sim state; writes only input intents                      │
├───────────────────────────────────────────────────────────────────┤
│ LAYER 3 · PHYSICS (Rapier)               three.js  ✅              │
│   Character controller, colliders, raycasts                       │
├───────────────────────────────────────────────────────────────────┤
│ LAYER 2 · SIMULATION                     three.js  ❌ FORBIDDEN    │
│   Director · ScareDirector · StoryGraph · DramaLedger             │
│   Combat · AI · objectives · teaching state                       │
│   Fixed 60 Hz. Deterministic given (seed, input log).             │
├───────────────────────────────────────────────────────────────────┤
│ LAYER 1 · REDIS TRUTH                    three.js  ❌ FORBIDDEN    │
│   Its OWN MockRedisEngine instance (never the 2D one — §5)        │
└───────────────────────────────────────────────────────────────────┘
```

**Enforced by test, not by discipline.** `src/game3d/__tests__/architecture.test.js` walks every file under `sim/` and fails the build if any imports `three`, `@react-three/*`, `react`, or touches `window`/`document`. Paired with the isolation test of §5.2. Both written in M0.

### 12.2 Dependencies — React 18 stays

Verified against the npm registry on 2026-08-19:

| Package | Latest | Peer requirement | Verdict (repo is React 18.3.1) |
|---|---|---|---|
| `@react-three/fiber` | 9.7.0 | `react: >=19 <19.3` | ❌ blocked |
| `@react-three/drei` | 10.7.8 | `react: ^19` | ❌ blocked |
| `@react-three/rapier` | 2.2.0 | `react: ^19` | ❌ blocked |
| `@react-three/postprocessing` | 3.0.5 | `react: ^19.2.0` | ❌ blocked |

**Decision: pin the last React-18 generation.** All four peer ranges align:

```
"three":                       "0.171.0"    // exact pin
"@react-three/fiber":          "8.18.0"     // peer react >=18 <19  ✓
"@react-three/drei":           "9.122.0"    // peer react ^18       ✓
"@react-three/rapier":         "1.5.0"      // peer react >=18      ✓
"@react-three/postprocessing": "2.19.1"     // peer react ^18       ✓
"postprocessing":              "^6.36.0"
"howler":                      "^2.2.4"
"maath":                       "^0.10.8"
```

A React 19 upgrade would touch all 40+ existing components and all 36 test files for zero gameplay benefit. R3F v8 and drei v9 already provide pointer-lock controls, GLTF/Draco loading, instancing, LOD, adaptive DPR, positional audio and the full post-processing chain.

**Escape hatch:** all R3F usage is confined to `src/game3d/view/`. Layers 1–2 have no React dependency at all, so a future React 19 migration touches one directory and no simulation tests.

**Three.js pin:** drei 9 declares `three: >=0.137` but is developed against the recent line. Pin exactly at `0.171.0`; the M0 exit criterion is "the smoke scene renders with zero console errors". If it does not, step down one minor at a time — never float the range.

Dev dependencies: `@react-three/test-renderer@^8` (renders the R3F scene graph with **no WebGL**), `@testing-library/react@^14`, `@gltf-transform/cli@^4`.

### 12.3 Module tree

```
src/game3d/
├── index.js                        # lazy entry: mount() / unmount()
├── bootstrap.js                    # creates the 3D-OWNED engine, bus, loop, stores
├── config/
│   ├── quality.js                  # quality tiers + auto-degrade ladder
│   ├── feel.js                     # every game-feel constant, one file
│   ├── controls.js                 # keybindings + rebinding
│   └── budgets.js                  # perf budgets asserted by tests
│
├── state/
│   ├── game3dStore.js              # its OWN zustand store (never gameStore)
│   └── persistence3d.js            # namespace: redis-quest:3d:
│
├── sim/                            # ── LAYER 2 · no three.js, no react ──
│   ├── SimWorld.js                 # owns clock, entities, systems, RNG
│   ├── entity/                     # EntityStore, components, spatialHash
│   ├── systems/
│   │   ├── MovementSystem.js  CombatSystem.js  AISystem.js
│   │   ├── TtlLifeSystem.js        # the player's timer-as-health rule
│   │   ├── MemoryPressureSystem.js # memory fullness → Evictor strength
│   │   ├── LatencySystem.js        # simulated cost → felt stalls, REX degradation
│   │   └── ObjectiveSystem.js      # bridges to IncidentEvaluator predicates
│   ├── horror/
│   │   ├── ScareDirector.js        # cadence, type selection, fatigue (§7.2)
│   │   ├── scareTypes.js           # T1–T8 definitions
│   │   └── FlinchMeter.js          # input-derived reaction measurement
│   ├── teaching/
│   │   ├── LadderState.js          # interaction tier per player (§8.2)
│   │   ├── VocabularyLadder.js     # physical → game → real naming (§8.3)
│   │   ├── DebriefQueue.js         # schedules debriefs, never during scares
│   │   ├── FieldManual.js          # codex state + Markdown export (§8.5)
│   │   └── RecallGate.js           # spaced-repetition checks (§8.6)
│   ├── director/                   # Director, EncounterBuilder, spawnTables
│   ├── story/                      # StoryGraph, DramaLedger, beatGates, endings
│   ├── redis/                      # CommandIntent, RedisActionBridge, telemetry
│   └── replay/                     # InputLog, ReplayHarness
│
├── view/                           # ── LAYERS 3–4 · three.js lives here ──
│   ├── Game3DRoot.jsx  SimProvider.jsx
│   ├── player/                     # PlayerRig, CharacterController, WeaponRig
│   ├── entities/                   # EnemyInstances, EvictorPresence, ResidentNPC
│   ├── level/                      # LevelLoader, LightRig, VolumetricFog
│   ├── fx/                         # EffectRouter, PostChain, shaders/, particles/
│   ├── hud/
│   │   ├── Hud.jsx  TimerLifeBar.jsx  Reticle.jsx
│   │   ├── CardComposer.jsx        # the Tier-1 radial (§8.2) — critical component
│   │   ├── ReceiptLine.jsx         # the Tier-0 real-syntax receipt
│   │   ├── TacticalTerminal.jsx    # Tiers 2–3
│   │   ├── DebriefCard.jsx         # §8.4
│   │   ├── FieldManualPanel.jsx    # §8.5
│   │   └── RexChannel.jsx          # latency-degraded companion
│   └── debug/SimInspector.jsx
│
├── audio/                          # AudioDirector, SpatialPool, sfxBank, ProceduralSfx
│                                   # (entirely separate from src/audio/SoundEngine.js)
└── content/                        # ── DATA ONLY ──
    ├── chapters/ch1..ch6/{beats,level.json,objectives.js,debriefs.js}
    ├── residents/*.js              # the six characters (§9.1)
    ├── clues/*.js                  # incident reports, logs, whiteboards (§9.3)
    ├── scares/*.js                 # authored set-piece scares
    ├── enemies/*.js  tools/*.js
    └── dialogue/*.json
```

### 12.4 Frame pipeline

```
requestAnimationFrame
  └─ GameLoop.tick (fixed 1/60 accumulator — the existing implementation)
       ├─ 1. drain input intents
       ├─ 2. sim.step(dt)        ← deterministic; no rendering, no DOM
       │      ├─ RedisActionBridge flushes queued command intents
       │      ├─ systems in fixed order: movement → AI → combat → objectives → teaching
       │      ├─ Director.evaluate() every 15 ticks
       │      ├─ ScareDirector.evaluate() every 15 ticks
       │      └─ StoryGraph.select() only when the Director asks for a beat
       ├─ 3. physics.step(dt)    ← Rapier; writes back kinematic positions
       └─ 4. render(alpha)       ← R3F; interpolates, never mutates sim state
```

The `alpha` interpolation factor already comes from the existing `GameLoop`, which is what makes a 60 Hz simulation look smooth on a 144 Hz display.

### 12.5 Sim ↔ view transfer

React state at 60 Hz would destroy the frame budget, so the bridge uses **mutable ref channels**: the sim writes pre-allocated `Float32Array` transform buffers; view components read them inside `useFrame` and write `InstancedMesh` matrices directly — zero React re-renders per frame. Only discrete events (objective complete, beat start, debrief ready) cross into React state via the 3D-owned event bus. Continuously-changing HUD numbers update on a throttled 10 Hz subscription.

### 12.6 Save data

`redis-quest:3d:save` holds `{ engineSnapshot, simSnapshot, ledger, fieldManual, ladderState, seed, inputLogHash, chapter, checkpoint }`. `engine.snapshot()`/`restore()` already round-trip a keyspace. **No 2D save key is read or written, ever.**

---

## 13. Engine capability work (Milestone 1)

Additive changes to the shared engine *code*. Both modes benefit; neither shares state. All 614 existing tests must stay green.

### 13.1 Streams — `src/engine/commands/streams.js`

New entry type `stream` (`{ entries, lastId, groups }`) inside the existing entry envelope.

`XADD` (auto-ID, `MAXLEN`) · `XLEN` · `XRANGE` / `XREVRANGE` · `XREAD` · `XGROUP CREATE/DESTROY/CREATECONSUMER/DELCONSUMER` · `XREADGROUP` · `XACK` · `XPENDING` · `XCLAIM` / `XAUTOCLAIM` · `XDEL` · `XTRIM` · `XINFO STREAM/GROUPS/CONSUMERS`.

Memory accounting extends [memory.js](src/engine/datatypes/memory.js) with `STREAM_ENTRY` and `STREAM_PEL_ENTRY` so streams participate honestly in memory pressure. The pending list is the teaching object for chapter 3 and for the Revenant enemy.

### 13.2 Real hit/miss statistics

Add `keyspaceHits`, `keyspaceMisses` and a rolling 60-second ring buffer to `engine.stats`. Increment inside the single existing lookup path, [`_get()`](src/engine/engine.js:104) — one place, so no command handler changes. Only read-intent lookups count, matching real Redis (a `SET` miss is not a cache miss), via a dispatcher-set flag. Replace the two literals at [server.js:152](src/engine/commands/server.js:152). Expose `engine.hitRatio(windowMs)` for the Director and the lighting rig.

### 13.3 Eviction and maxmemory policy

Implement `noeviction`, `allkeys-lru`, `allkeys-random`, `volatile-lru`, `volatile-random`, `volatile-ttl` (plus LFU variants if the frequency counter lands). Make `CONFIG SET maxmemory-policy` stateful at [debug.js:569](src/engine/commands/debug.js:569). On writes that exceed the limit, run an approximated-LRU pass sampling five candidates — the same approximation real Redis uses, and itself a teachable detail. Emit a new `evicted` event with `{ keys, policy, freedBytes }`; **this event drives THE EVICTOR's animation, audio and the T6 scares.** `noeviction` returns the real `OOM command not allowed…` error.

### 13.4 Blocking and latency simulation

A `latencyModel` estimating per-command cost: O(1) ≈ 0.05 ms; `KEYS` scales with keyspace size; `DEL`/`LRANGE`/`SMEMBERS` scale with element count; `EVAL` with script steps. Published as `engine.lastCommandCostMs` on the `command` event. **The sim converts cost into a real felt stall**, so purging something huge stutters the frame and releasing it does not. Blocking commands return `{ type: 'blocked', resumeOn, timeoutAt }`, which the sim renders as the player being physically locked in place — blocking becomes a vulnerability, and the lesson lands in about four seconds.

### 13.5 Objective predicate extensions

Extend [IncidentEvaluator.js](src/systems/incidents/IncidentEvaluator.js), following the existing switch-case shape: `streamLengthAbove` · `streamLengthBelow` · `pendingCountBelow` · `consumerGroupExists` · `hitRatioAbove` · `memoryBelowRatio` · `keyCountBelow` · `allKeysHaveTtl` · `lockHeldWithFence` · `evictionCountBelow`.

### 13.6 Minor additions

`SETNX`, `OBJECT FREQ` (for LFU), `DEBUG SLEEP` (to demonstrate single-threaded blocking), `MEMORY USAGE key`.

---

## 14. Rendering and art direction (D-4)

### 14.1 Visual bible

- **Palette:** three families. Concrete (`#1a1d21` → `#3a4048`), emergency amber (`#ff9d2e`, the only warm light), data-cyan (`#22d3ee`, carried from the existing brand). THE EVICTOR introduces the forbidden fourth: dead white `#f2f2ef`. When white appears, run.
- **Lighting:** one strong practical per room plus emissive rack LEDs. **Global light level is a function of cache hit ratio** — a healthy hit ratio is lit; a poor one is near-total darkness. Players learn to feel their hit rate as visibility.
- **Materials:** PBR, heavy roughness variation, wet concrete, greasy metal. No shiny plastic anywhere.
- **Camera:** 75° default (90° option), 1.2 Hz head bob, 1.5° roll on strafe, damped landing dip, FOV punch to 82° over 180 ms on sprint.
- **Silhouette rule:** every enemy is identifiable as a black silhouette at 40 m. In a game this dark, readability is survival.

### 14.2 Post-processing chain (order matters)

```
SSAO (half-res) → Bloom (threshold 0.85) → ChromaticAberration (∝ damage + latency)
→ GlitchPass (on eviction events) → Grain (∝ 1 − hitRatio)
→ Vignette (∝ your remaining timer — it closes in as you die)
→ ACES tonemap → SMAA
```

Every parameter is bound to a real engine metric. **The screen is a dashboard the player reads without knowing they are reading it.**

### 14.3 Animation quality ("smooth animations", D-4)

- **Procedural weapon motion**, not baked clips: spring-damper recoil (stiffness 180, damping 12), sway lagging camera velocity, 0.25 Hz breathing idle, 140 ms ADS with ease-out cubic.
- **Impact feedback:** 60 ms hit-stop, 3-frame material flash, directional damage indicators, camera kick along the impact normal.
- **Characters:** Mixamo-retargeted clips with additive procedural layers (spine lean into turns, head look-at). `AnimationMixer` blend trees with 150 ms cross-fades.
- **All timing constants live in `config/feel.js`.** Game feel is iterated dozens of times and must never require hunting through JSX.

### 14.4 Performance strategy

| Technique | Applied to | Budget |
|---|---|---|
| `InstancedMesh` | Racks, cables, crates, common enemies | ≤ 220 draw calls/frame |
| Merged geometry | Static level chunks | ≤ 12 chunks per level |
| LOD (`<Detailed>`) | Enemies (3 levels), props (2) | LOD1 at 25 m, LOD2 at 60 m |
| `AdaptiveDpr` | Canvas | DPR 0.6–2.0 |
| Baked lightmaps | Static geometry | ≤ 4 real-time lights per room |
| GPU particles | Sparks, dust, data streams | ≤ 8 systems, one draw call each |
| Object pooling | Projectiles, decals, audio nodes | Zero steady-state allocation |

**Auto-degrade ladder** (`config/quality.js`): below a 50 FPS rolling average, step down in order — SSAO off → shadows 2048→1024 → DPR −0.2 → particles halved → bloom mips −1 → volumetric fog off. Logged to the debug overlay. The player is never asked to configure this.

### 14.5 Frame budget at 60 FPS (16.6 ms)

Sim 2.0 · physics 2.5 · Redis 0.5 · scene update 1.5 · draw 4.0 · post 3.5 · HUD 0.5 · headroom 2.1 ms. Encoded in `config/budgets.js` and asserted by a headless benchmark.

---

## 15. Audio (D-8)

"Super aggressive" is a mixing and synthesis specification, not a volume setting. **This stack is entirely separate from the 2D `SoundEngine`** (§5.1).

### 15.1 Bus graph

```
destination ├── music   ── sidechain-ducked by combat (−6 dB, 120 ms release)
            ├── combat  ── compressor 4:1 @ −12 dB → saturation
            ├── world   ── convolver (per-zone impulse response)
            ├── scare   ── ★ its own bus with a 12 dB headroom reserve, so a
            │              jumpscare sting is always the loudest thing on screen
            ├── voice   ── REX; band-pass + bitcrush ∝ latency
            └── ui      ── unprocessed, always audible
```

### 15.2 What aggression actually means

Every impact fires **three simultaneous layers** — the standard way weapons get weight:

1. **Transient** (0–15 ms): clipped noise burst, high-passed at 2 kHz — the crack.
2. **Body** (15–120 ms): pitched layer with a fast pitch-envelope drop — the identity.
3. **Sub** (0–250 ms): 45–60 Hz sine, fast decay, sidechained so it never muddies — the layer players feel rather than hear.

Plus 90 ms of convolved room tail and a **−4 dB duck on every other bus for 60 ms**, so each shot punches a hole in the mix. Combined with the 60 ms hit-stop, impacts land physically.

### 15.3 Jumpscare audio specifically

The scare bus reserves headroom so a sting can hit **12 dB above** the loudest normal gameplay peak. Each sting is built from a sub-drop (28–40 Hz), a mid-range metallic scrape, and a reversed-cymbal pre-roll of 400 ms — the pre-roll is what makes the player's stomach drop *before* the hit. The **Audio Spike Limiter** accessibility option compresses this by 12 dB without removing the scare.

**Silence is a weapon.** The Scare Director requests a full audio drop 1.5–4 s before roughly 40% of scares. Sudden silence is the most reliable tell in horror, and using it only sometimes is what keeps it terrifying.

### 15.4 Diegetic audio bound to engine state

| Sound | Driven by |
|---|---|
| Rack hum pitch and beating | operations per second |
| Cooling roar | memory fullness |
| A distant metallic snap, positioned in world space | each `evicted` event — something just died over there |
| Whisper density | unacknowledged work count |
| REX's voice degradation | simulated latency |
| Filtered heartbeat, rising | your timer below 30 s |

### 15.5 Adaptive music

Four vertical stems at 128 BPM, always playing, cross-faded by `ambientTension`: `bed` → `pulse` → `tension` → `assault`. Gains ease over 800 ms; transitions quantise to the bar. Full track swaps only at chapter and boss boundaries.

### 15.6 Implementation notes

A pool of 24 HRTF `PannerNode`s allocated once, with quietest-voice stealing — never create nodes per shot. Howler handles sprite loading and pooling; bus work is direct Web Audio. **Every sound has a procedural fallback** in `ProceduralSfx.js`, so the game is playable and correctly mixed before a single sample is downloaded. Audio is imported through Vite (`import url from './x.ogg'`) so hashed production URLs resolve — the bug the 2D engine has (§3.4) is not repeated.

---

## 16. Assets (D-9)

### 16.1 Rules

1. **Procedural first.** Nothing blocks on art; every model has a correctly-sized primitive placeholder with real collision.
2. **CC0 preferred, permissive accepted, unlicensed never.**
3. **`ASSETS_LICENSES.md` is mandatory** — one row per asset: file, source URL, author, licence, date retrieved, modifications. A CI check fails the build for any file in `public/assets3d/` without a row.
4. **Budgets are enforced, not suggested.**

### 16.2 Sources (verify the licence on each individual asset — these hosts carry mixed terms)

| Source | For | Typical licence |
|---|---|---|
| **Kenney.nl** | Modular sci-fi/industrial kits, props, UI, audio | CC0 |
| **Quaternius** | Stylised characters, props | CC0 |
| **Poly Haven** | HDRIs, PBR textures | CC0 |
| **ambientCG** | PBR materials (concrete, metal, grime) | CC0 |
| **Sketchfab** (CC0/CC-BY filter) | Hero props, server racks | Per asset — check each time |
| **Mixamo** | Character rigs and animation, auto-retarget | Free with an Adobe account |
| **Freesound.org** | Impacts, mechanisms, room tone | Per asset: CC0 or CC-BY |
| **Sonniss GDC bundles** | Professional SFX libraries | Royalty-free |
| **OpenGameArt** | Fill material | Mixed — check each time |

CC-BY assets additionally require an attribution line on the in-game credits screen, not only in the Markdown file.

### 16.3 Budgets

| Category | Per asset | Total |
|---|---|---|
| Enemy model | 12k triangles, 2 × 1024² | 8 archetypes |
| Resident (NPC) | 18k triangles, 2 × 1024², rigged | 6 characters |
| Prop | 2k triangles, 1 × 512² | 60 unique |
| Level chunk | 40k triangles | 12 per level |
| Textures | KTX2 / Basis compressed | 24 MB VRAM per level |
| Audio | 48 kHz mono SFX, stereo music, Ogg | 18 MB per chapter |
| **Per-chapter download** | — | **≤ 35 MB** |

### 16.4 Pipeline

```
source → gltf-transform (dedupe, prune, weld, Draco, KTX2)
       → public/assets3d/<chapter>/
       → manifest.json (bounds, collider hint, LOD list, licence id)
       → LevelLoader streams per chapter behind a Suspense boundary
```

Colliders are generated by convex decomposition **at build time** — runtime trimesh generation is a known source of frame hitches.

---

## 17. UX and controls

### 17.1 Controls

| Input | Action |
|---|---|
| `W A S D` | Move · `Shift` sprint · `Ctrl` slide · `Space` jump/vault |
| Mouse | Look (pointer lock) |
| `LMB` | Use active tool · `RMB` **hold: Card Composer** (§8.2) |
| `E` | Interact — terminals, doors, residents, clues |
| `1`–`5` | Tool select · `Q` last tool |
| `F` | Deploy ability (shield, crew, spread) |
| `TAB` | Terminal (Tiers 2–3, once unlocked) |
| `H` | Ask REX (hint tier escalates) |
| `M` | Field Manual · `G` glossary · `J` objectives |
| `Esc` | Pause — real pause, releases pointer lock, accessibility toggles available |

Full rebinding, persisted to the 3D namespace.

### 17.2 HUD

A DOM overlay rather than in-canvas, because small text in WebGL is never as sharp and the HUD is where the teaching happens.

- **Bottom-left:** your timer as a literal countdown (`YOU — 04:12`), plus shields.
- **Bottom-centre:** the **receipt line** — what you just did, in plain words and real syntax.
- **Bottom-right:** active tool, cooldown rings.
- **Top-centre:** the objective, phrased as a symptom in plain language ("the far room is answering too slowly").
- **Top-right:** the facility readout — memory fullness, requests per second, hit ratio. Real numbers from the live 3D engine, using the Vocabulary Ladder's current naming stage.
- **Centre:** dynamic reticle — expands with recoil, colours on a valid target, shows a small glyph when something has been probed.

### 17.3 Accessibility

Horror options (§7.5) plus: motion toggles (head bob, shake, post-processing flash), colour-blind-safe state indicators with shape and icon redundancy (never colour alone), subtitles for every line, **captions for significant non-speech audio** ("[metallic snap — something deleted, north]") which doubles as a gameplay aid, full keyboard menu navigation, and the two independent difficulty axes of §8.7.

---

## 18. Testing and quality

### 18.1 Strategy — enabled by the layer split

| Layer | Method | Environment |
|---|---|---|
| Engine additions (§13) | Unit tests in the existing style | `node` |
| Sim (Layer 2) | Instantiate `SimWorld`, step, assert — **no mocks, no stubs, no WebGL** | `node` |
| Determinism | Golden replay: `(seed, inputLog)` → identical state hash | `node` |
| Director / StoryGraph / ScareDirector | Property tests over 1000 seeded runs, asserting invariants | `node` |
| **Teaching systems** | Ladder progression, debrief scheduling, Field Manual export, recall gates | `node` |
| View (Layer 4) | `@react-three/test-renderer` — scene graph without a GL context | `jsdom` |
| HUD and Card Composer | `@testing-library/react` | `jsdom` |
| Architecture (R1–R5) + isolation (R6) | Import-graph lint tests | `node` |
| Performance | Headless benchmark against `config/budgets.js` | `node` |

### 18.2 The three keystone tests

```js
// 1. Determinism — makes every bug reproducible from a seed
expect(runHeadless({seed: 1337, inputs: FIX}).stateHash)
  .toBe(runHeadless({seed: 1337, inputs: FIX}).stateHash)

// 2. Isolation — R6; the 2D game must be untouchable from 3D
expect(filesImporting('src/game3d', 'store/gameStore.js')).toEqual([])

// 3. Scare fairness — the rules of §7.2 hold across a thousand simulated runs
expect(scareLog.every(s => s.gapFromRequiredInput > 3000)).toBe(true)
expect(maxConsecutiveSameType(scareLog)).toBeLessThan(2)
```

Honest scoping note: **the simulation is deterministic; Rapier physics is not bit-identical across platforms.** Physics therefore feeds the sim only through quantised contact facts, and replays record sim events rather than physics state.

### 18.3 Playtesting — the requirement that cannot be automated

**Every milestone from M5 onward is gated on at least three non-technical playtesters**, recruited specifically for having no Redis background. Measured: time to first successful action, whether they can explain what a cache miss cost them, whether they ever reached Tier 2, whether they skipped debriefs, and where they quit. **If a non-technical tester cannot finish Chapter 1 unaided, the milestone does not pass** — regardless of how good the game looks.

---

## 19. Milestones

Each is independently shippable, keeps all 614 existing tests green, and has a binary exit criterion.

### M0 — Foundations and guard rails · 2 days
Pinned dependencies. `src/game3d/` skeleton. **Write the architecture test (R1–R5) and the isolation test (R6) first.** `bootstrap.js` creating the 3D-owned engine, bus, loop and store. Launcher screen with lazy loading. Smoke scene: one room, pointer lock, adaptive DPR, FPS counter.
**Exit:** smoke scene at 60 FPS with zero console errors; both guard-rail tests pass; the 2D bundle grows by < 4 KB; 614 tests still green.

### M1 — Engine capabilities · 4 days
Streams, hit/miss statistics, eviction, blocking and latency, predicates, minor commands (§13).
**Exit:** roughly 120 new engine tests pass; `INFO` reports real hit ratios; setting an eviction policy actually evicts and emits `evicted`; purging a 100k-element list reports a materially higher cost than releasing it.

### M2 — Simulation core · 5 days
`SimWorld`, entity store, spatial hash, movement / combat / AI / timer-life / memory-pressure systems, `RedisActionBridge`, input log, replay harness.
**Exit:** a headless 400-entity fight runs 60 s at under 2.0 ms per step; determinism test passes; no file under `sim/` imports three.js.

### M3 — Player, physics, feel · 4 days
Rapier character controller, sprint/slide/vault, weapon rig with procedural recoil and sway, hit-stop, damage feedback, `config/feel.js`.
**Exit:** blind playtesters describe movement as "tight"; frame time inside budget with physics on; every feel constant in one file.

### M4 — Teaching layer · 5 days *(new in v2; the highest-risk milestone)*
Interaction Ladder Tiers 0–3, the **Card Composer**, receipt line, Vocabulary Ladder, Debrief cards, Field Manual with Markdown export, Recall Gates, REX's hint channel.
**Exit:** **a non-technical tester completes a five-minute scenario with zero typing and can afterwards explain what they did in plain language.** Card Composer action time under 1.5 s once learned.

### M5 — Horror layer · 4 days *(new in v2)*
Scare Director with all eight types, flinch meter, fatigue model, fairness rules, scare audio bus, silence system, the accessibility options.
**Exit:** in a 20-minute session, testers report at least 12 genuine startles and no more than 2 "cheap or unfair" complaints; every fairness invariant holds across 1000 simulated runs.

### M6 — Chapter 1 vertical slice · 6 days
Levels -1 and -2, Director tuned, eight beats, Margit and Delacroix implemented, clue system, Crawler and the first Evictor encounter, full audio, HUD, save/load.
**Exit:** **a non-technical player completes Chapter 1 in 25–35 minutes unaided, learns what an expiry timer is without being told, is startled repeatedly, and two runs visibly differ.** This is the greenlight gate for the rest of the project.

### M7 — Polish pass · 4 days
Three-layer SFX, adaptive stems, spatial pooling, full post-processing chain bound to metrics, particles, auto-degrade ladder.
**Exit:** headphone playtest is genuinely frightening; 60 FPS on the target iGPU; every accessibility mode works.

### M8 — Chapters 2–4 · 10 days
Stampede, Backpressure, Tollgate — beats, residents (Voss, Hanne, Okonkwo), enemies, bosses, levels, debriefs, clues.
**Exit:** **non-technical testers score ≥ 70% on each chapter's concept check** with no explicit tutorial text. Below that, the chapter is redesigned before it ships.

### M9 — Chapters 5–6, endings, Exit Interview · 8 days
The Mirror, Protocol Zero, the four endings, the Twins, the Drama Ledger reveal, the Exit Interview, Field Manual export, credits and attribution.
**Exit:** all four endings reachable with correct gates; the exported Field Manual is genuinely useful to a working engineer.

### M10 — Hardening and launch · 4 days
Cross-browser sweep, WebGL context-loss recovery, 60-minute memory soak, asset licence audit, accessibility checklist, performance regression suite, AGENTS.md update.
**Exit:** flat heap across a 60-minute run; every asset licensed; no console errors in any browser.

**Total: roughly 56 engineering-days for the full campaign; 30 days to the Chapter 1 greenlight gate.** Building through M6 and then deciding is the recommended path.

---

## 20. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Non-technical players still bounce.** The ladder is not gentle enough. | Medium | **Critical** — it is the whole premise | M4 and M6 are gated on real non-technical testers. Tier 0/1 require zero typing. If they still bounce, the fix is more Tier 0, not more tutorial text. |
| R2 | **Jumpscare fatigue.** Frequency kills effect. | **High** | High | The fatigue model, the 35% false-scare ratio, eight distinct types, silence as a weapon, and the adaptive flinch meter. Measured at M5, not assumed. |
| R3 | **Horror pushes away the audience that wants to learn.** | Medium | High | Content warning up front; two independent difficulty axes; Reduced Scares and Predictable Mode available mid-run; the 2D mode remains a complete alternative. |
| R4 | **Learning gets buried by action.** They play, they do not learn. | Medium | **Critical** | Debriefs are protected from scares; Recall Gates force retrieval; the Exit Interview measures it; M8 will not ship a chapter that scores below 70%. |
| R5 | **Scope.** Six chapters is a very large build. | High | High | M6 is a hard greenlight gate. If Chapter 1 is not excellent, stop and re-plan rather than continuing to spend. |
| R6 | **Isolation erodes** — someone imports the 2D store "just for XP". | Medium | High | R6 test fails the build. Written in M0, before the temptation exists. |
| R7 | **Layer split erodes** — a `Vector3` appears in the sim. | Medium | Critical | R1–R5 test fails the build. Also M0. |
| R8 | **Performance on integrated GPUs.** | Medium | High | Budgets file, auto-degrade ladder, instancing from day one, profiling as a milestone exit criterion. |
| R9 | **Bundle size** deters players. | Medium | Medium | Lazy chunk, per-chapter streaming, 35 MB cap, explicit pre-download prompt on the launcher. |
| R10 | **Asset licensing** contamination. | Medium | High | `ASSETS_LICENSES.md` plus CI check; CC0 by default; when in doubt, it does not ship. |
| R11 | **React 18 pin goes stale** as R3F v8 enters maintenance. | Medium | Low | All R3F usage sits in `view/`. A React 19 migration touches one directory and no sim tests. |
| R12 | **Motion sickness and photosensitivity** in a dark, shaking, flashing game. | Medium | High | Accessibility built in M3 and M5, not bolted on at M10. |

---

## 21. Decisions taken (and what was rejected)

| # | Decision | Rejected alternative | Why |
|---|---|---|---|
| D-a | **Complete mode isolation** — separate engine, store, save, audio | v1's shared engine instance | Owner directive D-10; and a non-technical player's first session must not inherit a developer's leftover keyspace |
| D-b | **Four-tier interaction ladder**, typing optional | Terminal-first (v1) | Owner directive D-11. Typing under a jumpscare is not a viable interaction for the target audience |
| D-c | **Debriefs and an exportable Field Manual** | Trusting that gameplay alone transfers | D-11 says "use those skills in real production". That requires an explicit bridge and a portable artefact |
| D-d | **Adaptive Scare Director with a flinch meter** | A list of scripted scares | D-13 asks for frequent scares; frequency without adaptation becomes noise within twenty minutes |
| D-e | **Residents as walking failure modes** | Generic NPCs with quests | D-12 — every character must teach something valuable |
| D-f | **Headless sim; three.js only in `view/`** | One engine class owning everything (the deleted attempt) | Testability without GL, determinism, replays, survivable framework migration |
| D-g | **React 18 + R3F v8 pinned** | React 19 upgrade | Risk with no gameplay payoff; verified peer-range compatibility |
| D-h | **Rapier for physics** | Cannon-es; hand-rolled | WASM speed, a real kinematic character controller, first-class R3F bindings |
| D-i | **Player health is a real expiry timer** | Conventional health bar | The strongest teaching device in the design; makes memory pressure emotionally legible |
| D-j | **DOM HUD, not in-canvas** | drei `<Html>` for everything | Text sharpness, accessibility, cheaper re-renders |
| D-k | **Build Streams into the engine** | Fake the queue chapter | A queue chapter without a real pending list teaches nothing true |
| D-l | **Ship Chapter 1 fully before Chapters 2–6** | Grey-box all six first | The quality bar is unknowable until one chapter is genuinely finished |

---

## 22. Open questions

Answering these before M1 changes the work materially. Each has a recommendation so nothing is blocked on a reply.

1. **Scope commitment:** all six chapters up front, or build Chapter 1 and decide at the M6 gate? *(Recommend: the M6 gate — 30 days to a real decision point.)*
2. **Gore ceiling:** you asked for dark horror with frequent jumpscares. Does that include explicit body horror and blood, or should the terror stay in dread, sound, and implication with no graphic content? Affects art direction, the content warning, and how wide the audience is. *(Recommend: heavy dread and disturbing imagery, minimal gore — it costs less, ages better, and does not narrow the audience.)*
3. **Voice:** synthesised and processed (free, and it fits REX's degradation mechanic) or recorded lines? *(Recommend: synthesised and heavily processed.)*
4. **Non-technical target profile:** absolute beginners who have never written code, or non-Redis technical people (designers, PMs, ops)? The vocabulary ladder's first rung differs significantly. *(Recommend: assume absolute beginners — it costs little and covers both.)*
5. **Field Manual export format:** Markdown file only, or also a printable one-page cheat sheet per chapter? *(Recommend: both — the cheat sheet is what actually ends up pinned above a desk.)*
6. **Does the 2D mode stay the default landing experience**, or does the launcher present both equally on first load? *(Recommend: equal presentation, with the 3D panel carrying its download-size and content warning.)*

---

## 23. Appendix A — dependency manifest

```jsonc
// dependencies
"three":                       "0.171.0",
"@react-three/fiber":          "8.18.0",
"@react-three/drei":           "9.122.0",
"@react-three/rapier":         "1.5.0",
"@react-three/postprocessing": "2.19.1",
"postprocessing":              "^6.36.0",
"howler":                      "^2.2.4",
"maath":                       "^0.10.8"

// devDependencies
"@react-three/test-renderer":  "^8.2.0",
"@testing-library/react":      "^14.3.1",
"@gltf-transform/cli":         "^4"
```

Verified 2026-08-19: every peer range accepts React 18.3.1. The current majors (fiber 9, drei 10, rapier 2, postprocessing 3) all require React 19 and are excluded.

## 24. Appendix B — first-week task list

1. `npm i` the manifest; confirm `npm test` still reports 614 passing.
2. Create `src/game3d/` per §12.3 with empty index files.
3. **Write `__tests__/isolation.test.js` (R6) and `__tests__/architecture.test.js` (R1–R5) before any gameplay code.** They must fail loudly if `game3d/` ever reaches into the 2D store, the 2D audio engine, or any exported singleton — or if `sim/` ever imports three.js.
4. Write `bootstrap.js`: the 3D-owned `createEngine()`, `new EventBus()`, `new GameLoop()`, `game3dStore`, `persistence3d` on the `redis-quest:3d:` namespace.
5. Write `config/budgets.js` and the performance assertion that consumes it.
6. Build the M0 smoke scene behind the launcher's lazy boundary.
7. Begin M1 with Streams — the largest single engine task and the longest pole.
8. Create `ASSETS_LICENSES.md` with its header row and the CI check, before downloading the first asset.

---

*End of plan. The three claims most worth testing before committing budget: that a non-technical player can genuinely play and learn from this (validated at M4 and M6 with real testers, not assumptions), that frequent jumpscares stay frightening rather than becoming noise (validated at M5), and that the two modes stay isolated under content pressure (guarded by an automated test from M0).*
