/**
 * Memory Village Mini-Boss: Cache Rot Stalker
 * Multi-phase incident combining GET, SET, DEL, TTL, EXPIRE to restore village stability.
 */

export const cacheRotStalkerIncident = {
  id: 'cache-rot-stalker',
  title: 'Mini-Boss - Cache Rot Stalker',
  description: 'The Cache Rot Stalker is infesting Memory Village! Restore village stability through a multi-phase operation using GET, SET, DEL, TTL, and EXPIRE.',
  isBoss: true,
  commands: ['GET', 'SET', 'DEL', 'TTL', 'EXPIRE'],
  initialKeys: {
    'stalker:spore:1': 'toxic',
    'stalker:spore:2': 'toxic',
    'stalker:rot:core': 'expanding',
    'village:status': 'corrupted',
    'village:shield': 'decayed',
  },

  phases: [
    {
      phase: 1,
      name: 'Purge Rot Spores',
      description: 'Clear the toxic spores left by the stalker using DEL.',
      commands: ['DEL'],
      objectives: [
        {
          id: 'purge-spore-1',
          description: 'Delete toxic spore 1 with DEL stalker:spore:1',
          command: 'DEL stalker:spore:1',
        },
        {
          id: 'purge-spore-2',
          description: 'Delete toxic spore 2 with DEL stalker:spore:2',
          command: 'DEL stalker:spore:2',
        },
      ],
      isCompleted(engine) {
        const s1 = engine.rawExecute('GET', 'stalker:spore:1').value
        const s2 = engine.rawExecute('GET', 'stalker:spore:2').value
        return s1 === null && s2 === null
      },
    },
    {
      phase: 2,
      name: 'Contain Stalker Core',
      description: 'Inspect the infinite rot core with TTL and set an expiration timeout.',
      commands: ['TTL', 'EXPIRE'],
      objectives: [
        {
          id: 'inspect-core-ttl',
          description: 'Check rot core TTL with TTL stalker:rot:core',
          command: 'TTL stalker:rot:core',
        },
        {
          id: 'contain-core',
          description: 'Contain rot core by setting EXPIRE stalker:rot:core 30',
          command: 'EXPIRE stalker:rot:core 30',
        },
      ],
      isCompleted(engine) {
        const ttl = engine.rawExecute('TTL', 'stalker:rot:core').value
        return typeof ttl === 'number' && ttl > 0
      },
    },
    {
      phase: 3,
      name: 'Restore Village Stability',
      description: 'Inspect and repair the village status key, and re-enable the village shield with expiration.',
      commands: ['GET', 'SET', 'EXPIRE'],
      objectives: [
        {
          id: 'inspect-village-status',
          description: 'Inspect status with GET village:status',
          command: 'GET village:status',
        },
        {
          id: 'repair-village-status',
          description: 'Set village:status to stable with SET village:status stable',
          command: 'SET village:status stable',
        },
        {
          id: 'activate-shield',
          description: 'Set village:shield to active and set EXPIRE village:shield 60',
          command: 'SET village:shield active',
        },
      ],
      isCompleted(engine) {
        const status = engine.rawExecute('GET', 'village:status').value
        const shield = engine.rawExecute('GET', 'village:shield').value
        const shieldTtl = engine.rawExecute('TTL', 'village:shield').value
        return status === 'stable' && shield === 'active' && typeof shieldTtl === 'number' && shieldTtl > 0
      },
    },
  ],

  setup(engine) {
    engine.rawExecute('SET', 'stalker:spore:1', 'toxic')
    engine.rawExecute('SET', 'stalker:spore:2', 'toxic')
    engine.rawExecute('SET', 'stalker:rot:core', 'expanding')
    engine.rawExecute('SET', 'village:status', 'corrupted')
    engine.rawExecute('SET', 'village:shield', 'decayed')
  },

  objectives: [
    {
      id: 'purge-spores',
      description: 'Purge toxic spores with DEL stalker:spore:1 and DEL stalker:spore:2',
      command: 'DEL stalker:spore:1',
      isCompleted(engine) {
        return (
          engine.rawExecute('GET', 'stalker:spore:1').value === null &&
          engine.rawExecute('GET', 'stalker:spore:2').value === null
        )
      },
    },
    {
      id: 'contain-rot-core',
      description: 'Contain the expanding rot core with EXPIRE stalker:rot:core 30',
      command: 'EXPIRE stalker:rot:core 30',
      isCompleted(engine) {
        const ttl = engine.rawExecute('TTL', 'stalker:rot:core').value
        return typeof ttl === 'number' && ttl > 0
      },
    },
    {
      id: 'restore-village-status',
      description: 'Restore village status to stable with SET village:status stable',
      command: 'SET village:status stable',
      isCompleted(engine) {
        return engine.rawExecute('GET', 'village:status').value === 'stable'
      },
    },
    {
      id: 'restore-village-shield',
      description: 'Re-activate village shield and apply EXPIRE village:shield 60',
      command: 'EXPIRE village:shield 60',
      isCompleted(engine) {
        const shield = engine.rawExecute('GET', 'village:shield').value
        const ttl = engine.rawExecute('TTL', 'village:shield').value
        return shield === 'active' && typeof ttl === 'number' && ttl > 0
      },
    },
  ],

  hints: [
    'The Cache Rot Stalker has infested the village! Purge the toxic spores with DEL, contain the rot core with EXPIRE, and repair village keys.',
    'Execute DEL on stalker:spore:1 and stalker:spore:2. Set an expiration on stalker:rot:core with EXPIRE stalker:rot:core 30. Then repair village:status and village:shield.',
    'Step 1: DEL stalker:spore:1 & DEL stalker:spore:2. Step 2: EXPIRE stalker:rot:core 30. Step 3: SET village:status stable, SET village:shield active, and EXPIRE village:shield 60.',
  ],

  isResolved(engine) {
    const s1 = engine.rawExecute('GET', 'stalker:spore:1').value
    const s2 = engine.rawExecute('GET', 'stalker:spore:2').value
    const coreTtl = engine.rawExecute('TTL', 'stalker:rot:core').value
    const status = engine.rawExecute('GET', 'village:status').value
    const shield = engine.rawExecute('GET', 'village:shield').value
    const shieldTtl = engine.rawExecute('TTL', 'village:shield').value

    return (
      s1 === null &&
      s2 === null &&
      typeof coreTtl === 'number' &&
      coreTtl > 0 &&
      status === 'stable' &&
      shield === 'active' &&
      typeof shieldTtl === 'number' &&
      shieldTtl > 0
    )
  },
}

export default cacheRotStalkerIncident
