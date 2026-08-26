/**
 * MISSION_DEFS - Gameplay spawn configuration for EnemyManager
 * Each mission defines enemy types, waves, spawn positions, and pressure behavior
 * This is the minimal gameplay config EnemyManager imports directly
 */

export const MISSION_DEFS = {
  cacheStampede: {
    id: 'cacheStampede',
    name: 'Cache Stampede',
    subtitle: 'Defend the cache layer from unbounded request floods',
    // Enemy types that can spawn naturally
    enemyTypes: ['stampeder'],
    // Enemy types that spawn when mission pressure is high
    pressureEnemyTypes: ['stampeder'],
    // Maximum concurrent enemies
    maxEnemies: 12,
    // Wave definitions (optional - overrides continuous spawn)
    waves: [
      {
        id: 'wave1',
        delay: 5, // seconds after mission start
        spawns: [
          { type: 'stampeder', room: 'cache_server_01' },
          { type: 'stampeder', room: 'cache_server_01' },
          { type: 'stampeder', room: 'cache_server_02' },
        ],
      },
      {
        id: 'wave2',
        delay: 15,
        spawns: [
          { type: 'stampeder', room: 'cache_server_01' },
          { type: 'stampeder', room: 'cache_server_02' },
          { type: 'stampeder', room: 'cache_server_03' },
          { type: 'stampeder', room: 'cache_server_03' },
        ],
      },
      {
        id: 'wave3',
        delay: 30,
        spawns: [
          { type: 'stampeder', room: 'cache_server_01' },
          { type: 'stampeder', room: 'cache_server_02' },
          { type: 'stampeder', room: 'cache_server_03' },
          { type: 'stampeder', room: 'cache_server_04' },
          { type: 'stampeder', room: 'cache_server_04' },
        ],
      },
    ],
    // Objective positions for radar/minimap
    objectivePositions: {
      lock_acquire: [0, 1, 0],
      stampede_stop: [15, 1, -10],
      cache_warm: [-10, 1, 15],
    },
  },

  rateLimitSiege: {
    id: 'rateLimitSiege',
    name: 'Rate Limit Siege',
    subtitle: 'Mitigate the sliding-window barrage before the API gateway falls',
    enemyTypes: ['siegeDrone'],
    pressureEnemyTypes: ['siegeDrone', 'stampeder'],
    maxEnemies: 10,
    waves: [
      {
        id: 'wave1',
        delay: 3,
        spawns: [
          { type: 'siegeDrone', position: [20, 1, 0] },
          { type: 'siegeDrone', position: [-20, 1, 0] },
        ],
      },
      {
        id: 'wave2',
        delay: 12,
        spawns: [
          { type: 'siegeDrone', position: [0, 1, 25] },
          { type: 'siegeDrone', position: [0, 1, -25] },
          { type: 'siegeDrone', position: [18, 1, 18] },
        ],
      },
      {
        id: 'wave3',
        delay: 25,
        spawns: [
          { type: 'siegeDrone', position: [15, 1, 15] },
          { type: 'siegeDrone', position: [-15, 1, 15] },
          { type: 'siegeDrone', position: [15, 1, -15] },
          { type: 'siegeDrone', position: [-15, 1, -15] },
        ],
      },
    ],
    objectivePositions: {
      lua_deploy: [0, 1, 0],
      window_configure: [10, 1, -20],
      burst_absorb: [-10, 1, 20],
    },
  },

  memoryLeakCrisis: {
    id: 'memoryLeakCrisis',
    name: 'Memory Leak Crisis',
    subtitle: 'Purge the sludge before OOM killer claims the node',
    enemyTypes: ['sludgeBlob'],
    pressureEnemyTypes: ['sludgeBlob', 'stampeder'],
    maxEnemies: 8,
    waves: [
      {
        id: 'wave1',
        delay: 8,
        spawns: [
          { type: 'sludgeBlob', room: 'memory_bank_01' },
        ],
      },
      {
        id: 'wave2',
        delay: 20,
        spawns: [
          { type: 'sludgeBlob', room: 'memory_bank_01' },
          { type: 'sludgeBlob', room: 'memory_bank_02' },
        ],
      },
      {
        id: 'wave3',
        delay: 40,
        spawns: [
          { type: 'sludgeBlob', room: 'memory_bank_02' },
          { type: 'sludgeBlob', room: 'memory_bank_03' },
          { type: 'sludgeBlob', room: 'memory_bank_03' },
        ],
      },
    ],
    objectivePositions: {
      policy_set: [0, 1, 0],
      unlink_leak: [-15, 1, 10],
      gc_trigger: [15, 1, -10],
    },
  },

  deadLetterPipeline: {
    id: 'deadLetterPipeline',
    name: 'Dead Letter Pipeline',
    subtitle: 'Clear the poisoned queue before the consumer group starves',
    enemyTypes: ['phantomConsumer'],
    pressureEnemyTypes: ['phantomConsumer', 'siegeDrone'],
    maxEnemies: 10,
    waves: [
      {
        id: 'wave1',
        delay: 5,
        spawns: [
          { type: 'phantomConsumer', room: 'queue_processor_01' },
          { type: 'phantomConsumer', room: 'queue_processor_02' },
        ],
      },
      {
        id: 'wave2',
        delay: 18,
        spawns: [
          { type: 'phantomConsumer', room: 'queue_processor_01' },
          { type: 'phantomConsumer', room: 'queue_processor_03' },
          { type: 'phantomConsumer', room: 'queue_processor_03' },
        ],
      },
      {
        id: 'wave3',
        delay: 35,
        spawns: [
          { type: 'phantomConsumer', room: 'queue_processor_02' },
          { type: 'phantomConsumer', room: 'queue_processor_03' },
          { type: 'phantomConsumer', room: 'dlq_vent' },
          { type: 'phantomConsumer', room: 'dlq_vent' },
        ],
      },
    ],
    objectivePositions: {
      xgroup_create: [0, 1, 0],
      xack_stalled: [12, 1, -12],
      dlq_drain: [-12, 1, 12],
    },
  },

  splitBrainFailover: {
    id: 'splitBrainFailover',
    name: 'Split-Brain Failover',
    subtitle: 'Force quorum and execute failover before the cluster tears apart',
    enemyTypes: ['nullPointer'],
    pressureEnemyTypes: ['nullPointer', 'phantomConsumer', 'sludgeBlob'],
    maxEnemies: 1, // Boss only
    waves: [
      {
        id: 'boss_spawn',
        delay: 2,
        spawns: [
          { type: 'nullPointer', position: [0, 1, 0] },
        ],
      },
    ],
    objectivePositions: {
      sentinel_monitor: [0, 1, 20],
      quorum_check: [-15, 1, -15],
      failover_exec: [15, 1, -15],
    },
  },
}

// Helper to get mission def by ID
export function getMissionDef(missionId) {
  return MISSION_DEFS[missionId]
}

// All mission IDs in order
export const MISSION_ORDER = [
  'cacheStampede',
  'rateLimitSiege',
  'memoryLeakCrisis',
  'deadLetterPipeline',
  'splitBrainFailover',
]

export default { MISSION_DEFS, getMissionDef, MISSION_ORDER }