/**
 * Region 8: Time Temple (Advanced TTL)
 * Master the art of expiration - where every key has its moment
 */

export const timeTemple = {
  id: 'time-temple',
  name: 'Time Temple',
  theme: 'mystical',
  color: '#9370DB',
  description: 'Master the art of expiration - where every key has its moment',
  order: 8,
  requiredCommands: [
    'EXPIRE', 'PEXPIRE', 'EXPIREAT', 'PEXPIREAT',
    'TTL', 'PTTL', 'PERSIST',
    'KEYS', 'SCAN', 'TYPE',
    'OBJECT IDLETIME', 'OBJECT FREQ'
  ],
  visualizerConfig: {
    type: 'timeline',
    timeScale: 1,
    showExpiry: true
  },
  challenges: [
    {
      id: 'tt-1',
      name: 'Set the Hourglass',
      description: 'Set a key to expire after 60 seconds.',
      hint: 'EXPIRE temple:artifact 60',
      command: 'EXPIRE',
      task: 'Create key `temple:artifact` with value "ancient" and set it to expire in 60 seconds.',
      check: (engine, lastReply) => {
        // First need to SET the key, then EXPIRE
        // The challenge checks if expire was set successfully
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'tt-2',
      name: 'Millisecond Precision',
      description: 'Set expiry with millisecond precision using PEXPIRE.',
      hint: 'PEXPIRE temple:relic 30000',
      command: 'PEXPIRE',
      task: 'Create key `temple:relic` with value "golden" and set it to expire in 30000 milliseconds.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'tt-3',
      name: 'Absolute Timestamp',
      description: 'Set expiration at a specific Unix timestamp (seconds).',
      hint: 'EXPIREAT temple:scroll 1735689600',
      command: 'EXPIREAT',
      task: 'Create key `temple:scroll` and set it to expire at timestamp 1735689600 (far future).',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'tt-4',
      name: 'Millisecond Timestamp',
      description: 'Set expiration at a specific Unix timestamp in milliseconds.',
      hint: 'PEXPIREAT temple:tablet 1735689600000',
      command: 'PEXPIREAT',
      task: 'Create key `temple:tablet` and set it to expire at millisecond timestamp 1735689600000.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'tt-5',
      name: 'Check Remaining Seconds',
      description: 'Get the remaining TTL in seconds for a key.',
      hint: 'TTL temple:artifact',
      command: 'TTL',
      task: 'Check the remaining TTL in seconds for `temple:artifact`.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value > 0 && lastReply.value <= 60
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'tt-6',
      name: 'Check Remaining Milliseconds',
      description: 'Get the remaining TTL in milliseconds for a key.',
      hint: 'PTTL temple:relic',
      command: 'PTTL',
      task: 'Check the remaining TTL in milliseconds for `temple:relic`.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value > 0 && lastReply.value <= 30000
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'tt-7',
      name: 'Eternal Preservation',
      description: 'Remove expiration from a key to make it persistent.',
      hint: 'PERSIST temple:scroll',
      command: 'PERSIST',
      task: 'Remove the expiration from `temple:scroll` making it persistent.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'tt-8',
      name: 'Verify Persistence',
      description: 'Confirm a key has no expiration (TTL returns -1).',
      hint: 'TTL temple:scroll',
      command: 'TTL',
      task: 'Check TTL of `temple:scroll` after PERSIST - should return -1.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === -1
      },
      xp: 20,
      damage: 12
    },
    {
      id: 'tt-9',
      name: 'Missing Key Check',
      description: 'Check TTL of a non-existent key (returns -2).',
      hint: 'TTL temple:nonexistent',
      command: 'TTL',
      task: 'Check TTL of a key that does not exist - should return -2.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === -2
      },
      xp: 20,
      damage: 12
    },
    {
      id: 'tt-10',
      name: 'Conditional Expiry NX',
      description: 'Set expiry only if key has no existing expiry (NX option).',
      hint: 'EXPIRE temple:tablet 120 NX',
      command: 'EXPIRE',
      task: 'Try to set expiry on `temple:tablet` with NX option (should fail since it already has expiry).',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === 0
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'tt-11',
      name: 'Conditional Expiry XX',
      description: 'Set expiry only if key has existing expiry (XX option).',
      hint: 'EXPIRE temple:tablet 180 XX',
      command: 'EXPIRE',
      task: 'Set expiry on `temple:tablet` with XX option (should succeed since it has expiry).',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'tt-12',
      name: 'Greater Than Current',
      description: 'Update expiry only if new expiry is greater than current (GT option).',
      hint: 'EXPIRE temple:tablet 300 GT',
      command: 'EXPIRE',
      task: 'Set expiry on `temple:tablet` to 300 seconds with GT option (should succeed if 300 > current).',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'tt-13',
      name: 'Less Than Current',
      description: 'Update expiry only if new expiry is less than current (LT option).',
      hint: 'EXPIRE temple:tablet 60 LT',
      command: 'EXPIRE',
      task: 'Set expiry on `temple:tablet` to 60 seconds with LT option (should succeed if 60 < current).',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'tt-14',
      name: 'List Keys by Pattern',
      description: 'Find all keys matching a pattern using KEYS.',
      hint: 'KEYS temple:*',
      command: 'KEYS',
      task: 'List all keys matching pattern `temple:*`.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        // Should find all temple keys
        return lastReply.value.length >= 4
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'tt-15',
      name: 'Incremental Scan',
      description: 'Iterate keyspace incrementally using SCAN.',
      hint: 'SCAN 0 MATCH temple:* COUNT 10',
      command: 'SCAN',
      task: 'Use SCAN to iterate keys matching `temple:*` with COUNT 10.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        // Returns [cursor, [keys]]
        return lastReply.value.length === 2
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'tt-16',
      name: 'Type Inspection',
      description: 'Determine the data type of a key.',
      hint: 'TYPE temple:artifact',
      command: 'TYPE',
      task: 'Check the type of `temple:artifact` - should be "string".',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'simple' && lastReply.value === 'string'
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'tt-17',
      name: 'Idle Time Check',
      description: 'Get the idle time of a key in seconds using OBJECT IDLETIME.',
      hint: 'OBJECT IDLETIME temple:artifact',
      command: 'OBJECT IDLETIME',
      task: 'Get the idle time (seconds since last access) for `temple:artifact`.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value >= 0
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'tt-18',
      name: 'Frequency Check',
      description: 'Get the access frequency counter using OBJECT FREQ.',
      hint: 'OBJECT FREQ temple:artifact',
      command: 'OBJECT FREQ',
      task: 'Get the frequency counter for `temple:artifact`.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value >= 0
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'tt-19',
      name: 'Expire at Past Timestamp',
      description: 'Set expiry to a past timestamp to immediately delete a key.',
      hint: 'EXPIREAT temple:relic 1',
      command: 'EXPIREAT',
      task: 'Set `temple:relic` to expire at timestamp 1 (past) - should delete the key.',
      check: (engine, lastReply) => {
        // Key should be deleted, so EXISTS returns 0
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'tt-20',
      name: 'Verify Deletion',
      description: 'Confirm a key was deleted by checking its type.',
      hint: 'TYPE temple:relic',
      command: 'TYPE',
      task: 'Check type of `temple:relic` after EXPIREAT to past - should be "none".',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'simple' && lastReply.value === 'none'
      },
      xp: 25,
      damage: 15
    }
  ],
  boss: {
    id: 'chronos-warden',
    name: 'The Chronos Warden',
    title: 'GUARDIAN OF ETERNITY',
    maxHealth: 180,
    challenges: [
      {
        id: 'cw-1',
        key: 'temple:eternal-flame',
        task: 'Light the eternal flame: create `temple:eternal-flame` with value "burning" and NO expiration.',
        hint: 'SET temple:eternal-flame burning\nPERSIST temple:eternal-flame',
        damage: 25,
        xp: 50,
        check: (engine, entry) => {
          return entry && entry.type === 'string' && entry.value === 'burning' && entry.expiresAt === null
        }
      },
      {
        id: 'cw-2',
        key: 'temple:hourglass',
        task: 'Turn the hourglass: create `temple:hourglass` with value "sand" expiring in exactly 10 seconds.',
        hint: 'SET temple:hourglass sand\nEXPIRE temple:hourglass 10',
        damage: 25,
        xp: 50,
        check: (engine, entry) => {
          return entry && entry.type === 'string' && entry.value === 'sand' && entry.expiresAt !== null
        }
      },
      {
        id: 'cw-3',
        key: 'temple:time-lock',
        task: 'Seal the time-lock: set `temple:time-lock` to expire at timestamp 2000000000 (far future) using EXPIREAT.',
        hint: 'SET temple:time-lock sealed\nEXPIREAT temple:time-lock 2000000000',
        damage: 30,
        xp: 60,
        check: (engine, entry) => {
          return entry && entry.type === 'string' && entry.value === 'sealed' && entry.expiresAt !== null
        }
      },
      {
        id: 'cw-4',
        key: 'temple:chronos-key',
        task: 'Forge the chronos key: create key with millisecond expiry of 5000ms using PEXPIRE.',
        hint: 'SET temple:chronos-key forged\nPEXPIRE temple:chronos-key 5000',
        damage: 30,
        xp: 60,
        check: (engine, entry) => {
          return entry && entry.type === 'string' && entry.value === 'forged' && entry.expiresAt !== null
        }
      },
      {
        id: 'cw-5',
        key: 'temple:archive',
        task: 'Archive the timeline: use SCAN to find all temple:* keys, then use TYPE on each to catalog them.',
        hint: 'SCAN 0 MATCH temple:* COUNT 100\nTYPE temple:eternal-flame\nTYPE temple:hourglass\nTYPE temple:time-lock\nTYPE temple:chronos-key',
        damage: 35,
        xp: 70,
        check: (engine, lastReply) => {
          // Just verify the last TYPE command worked
          return lastReply && lastReply.type === 'simple'
        }
      },
      {
        id: 'cw-6',
        key: 'temple:final-sands',
        task: 'Final trial: make all temple keys persistent (remove all expiries) using PERSIST.',
        hint: 'PERSIST temple:eternal-flame\nPERSIST temple:hourglass\nPERSIST temple:time-lock\nPERSIST temple:chronos-key',
        damage: 35,
        xp: 70,
        check: (engine, entry) => {
          // Check all temple keys have no expiry
          const keys = ['temple:eternal-flame', 'temple:hourglass', 'temple:time-lock', 'temple:chronos-key']
          for (const key of keys) {
            const e = engine._get(key)
            if (!e || e.expiresAt !== null) return false
          }
          return true
        }
      }
    ]
  }
}