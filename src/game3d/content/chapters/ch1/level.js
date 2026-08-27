// Chapter 1 level assembly. level.json holds the hand-authored shell (outer
// walls, partitions, lights, spawns); the rack maze that fills the hall is
// generated here so the geometry stays one loop instead of 60 lines of JSON.
//
// Pure data + pure functions: no three.js, no DOM. The view turns colliders
// into meshes, the sim turns the same colliders into collision boxes, so the
// thing you see and the thing you bump into can never drift apart.

import shell from './level.json'

// Racks are the cover, the sightline blockers, and the thing THE EVICTOR
// stalks you between. Laid out in aisles with a clear central corridor so the
// player always has a way through and the level never reads as a solid block.
const RACK_HALF = [1.1, 1.6, 0.55]
const RACK_Y = 2.1
const AISLE_X = [-24, -18, -12, 12, 18, 24]
const AISLE_Z = [-9, -4, 1, 6, 11]

export function buildRacks() {
  const racks = []
  for (let i = 0; i < AISLE_X.length; i++) {
    for (let j = 0; j < AISLE_Z.length; j++) {
      // Punch a couple of gaps so each aisle is traversable, not a wall.
      if ((i + j) % 4 === 0) continue
      racks.push({
        id: `rack_${i}_${j}`,
        type: 'cuboid',
        args: RACK_HALF,
        position: [AISLE_X[i], RACK_Y, AISLE_Z[j]],
      })
    }
  }
  return racks
}

// Interactive terminals. Reaching one is how the player is taught a command
// in context — the prompt names the physical thing, the debrief names the
// real Redis command (the Vocabulary Ladder, plan §8).
export const TERMINALS = [
  {
    id: 'term_lifesupport',
    position: [0, 0.5, 16],
    label: 'LIFE SUPPORT',
    prompt: 'Your session is on a timer. Refresh it before it runs out.',
    teaches: 'EXPIRE',
  },
  {
    id: 'term_cache',
    position: [-24, 0.5, -20],
    label: 'CACHE CONTROL',
    prompt: 'MARGIT never set a timer on anything. The room is full.',
    teaches: 'SETEX',
  },
  {
    id: 'term_gate',
    position: [24, 0.5, -20],
    label: 'GATE CONTROL',
    prompt: "DELACROIX reads from the source every time. Cache what he asks for.",
    teaches: 'SET',
  },
]

// Where hostiles come from. The stalker (THE EVICTOR) starts far behind the
// partition so the player hears it long before they see it.
export const ENEMY_SPAWNS = [
  { archetype: 'crawler', position: [-16, 0.6, -4] },
  { archetype: 'crawler', position: [14, 0.6, 2] },
  { archetype: 'crawler', position: [-20, 0.6, 8] },
  { archetype: 'crawler', position: [20, 0.6, -8] },
  { archetype: 'stalker', position: [0, 0.6, -24] },
]

// Chapter 1's win condition, expressed as IncidentEvaluator predicates so the
// same objective language drives both game modes.
export const OBJECTIVES = [
  {
    id: 'obj_survive',
    label: 'Keep your session alive',
    hint: 'Your health IS a TTL. Refresh it at a terminal.',
    predicate: { type: 'keyExists', key: 'session:7742' },
  },
  {
    id: 'obj_cache',
    label: 'Cache the manifest DELACROIX keeps re-reading',
    hint: 'Store the value so the read stops hitting the source.',
    predicate: { type: 'keyExists', key: 'cache:manifest' },
  },
  {
    id: 'obj_ttl',
    label: 'Put a timer on MARGIT’s orphaned key',
    hint: 'A key with no expiry never leaves. Give it one.',
    predicate: { type: 'ttlBetween', key: 'margit:ledger', min: 1, max: 600 },
  },
]

export function buildLevel() {
  return {
    ...shell,
    colliders: [...shell.colliders, ...buildRacks()],
    racks: buildRacks(),
    terminals: TERMINALS,
    enemySpawns: ENEMY_SPAWNS,
    objectives: OBJECTIVES,
  }
}

export const CH1_LEVEL = buildLevel()
