/**
 * Phase 6 Survival Mode Challenges
 * Endurance challenges combining Sorted Sets, Pub/Sub, and TTL mechanics
 */

export const phase6Survival = [
  {
    id: 'survival-6-1',
    name: 'Arena Marathon',
    description: 'Maintain a live leaderboard under continuous updates for 60 seconds.',
    region: 'leaderboard-arena',
    duration: 60000, // 60 seconds
    difficulty: 'hard',
    xpReward: 200,
    setup: (engine) => {
      // Initialize the arena
      engine.rawExecute('DEL', 'survival:marathon')
      engine.rawExecute('ZADD', 'survival:marathon', '100', 'Runner1', '200', 'Runner2', '300', 'Runner3')
    },
    objectives: [
      {
        id: 'obj-1',
        description: 'Keep at least 5 runners in the leaderboard at all times',
        check: (engine) => {
          const entry = engine._get('survival:marathon')
          return entry && entry.type === 'zset' && entry.value.length >= 5
        },
        continuous: true
      },
      {
        id: 'obj-2',
        description: 'Update scores every 2 seconds using ZINCRBY on random runners',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.startsWith('ZINCRBY')
        },
        continuous: true,
        minInterval: 2000
      },
      {
        id: 'obj-3',
        description: 'Add new runners with ZADD when count drops below 5',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.startsWith('ZADD')
        },
        continuous: true
      },
      {
        id: 'obj-4',
        description: 'Remove exhausted runners (score < 50) using ZREMRANGEBYSCORE',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.startsWith('ZREMRANGEBYSCORE')
        },
        continuous: true
      },
      {
        id: 'obj-5',
        description: 'Query top 3 every 5 seconds with ZREVRANGE WITHSCORES',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.includes('ZREVRANGE') && lastCmd.includes('WITHSCORES')
        },
        continuous: true,
        minInterval: 5000
      }
    ],
    failureConditions: [
      {
        id: 'fail-1',
        description: 'Leaderboard drops below 5 runners',
        check: (engine) => {
          const entry = engine._get('survival:marathon')
          return !entry || entry.type !== 'zset' || entry.value.length < 5
        }
      },
      {
        id: 'fail-2',
        description: 'No ZINCRBY command for more than 3 seconds',
        check: (engine, state) => {
          return state.timeSinceLastIncrby > 3000
        }
      },
      {
        id: 'fail-3',
        description: 'Any runner exceeds score 10000 (overflow)',
        check: (engine) => {
          const entry = engine._get('survival:marathon')
          if (!entry || entry.type !== 'zset') return false
          for (const node of entry.value.toArray()) {
            if (node.score > 10000) return true
          }
          return false
        }
      }
    ],
    hints: [
      'Use ZINCRBY with small increments (5-10) to gradually increase scores',
      'ZREMRANGEBYSCORE survival:marathon -inf (50 removes low scores',
      'ZADD survival:marathon 100 "Runner" + Math.random() adds new runners',
      'ZREVRANGE survival:marathon 0 2 WITHSCORES shows the podium',
      'Track time with Date.now() to pace your commands'
    ]
  },
  {
    id: 'survival-6-2',
    name: 'Message Storm',
    description: 'Handle a high-throughput pub/sub message relay across multiple channels and patterns.',
    region: 'message-factory',
    duration: 45000, // 45 seconds
    difficulty: 'expert',
    xpReward: 250,
    setup: (engine) => {
      // Subscribe to required channels and patterns
      engine.rawExecute('SUBSCRIBE', 'storm:updates', 'storm:alerts', 'storm:metrics')
      engine.rawExecute('PSUBSCRIBE', 'storm:*', '*:critical', 'metrics:*')
    },
    objectives: [
      {
        id: 'obj-1',
        description: 'Publish to storm:updates every 500ms with incrementing sequence',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.startsWith('PUBLISH') && lastCmd.includes('storm:updates')
        },
        continuous: true,
        minInterval: 500
      },
      {
        id: 'obj-2',
        description: 'Publish to storm:alerts every 2 seconds with severity level',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.startsWith('PUBLISH') && lastCmd.includes('storm:alerts')
        },
        continuous: true,
        minInterval: 2000
      },
      {
        id: 'obj-3',
        description: 'Publish to metrics:throughput matching pattern every 1 second',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.startsWith('PUBLISH') && lastCmd.includes('metrics:throughput')
        },
        continuous: true,
        minInterval: 1000
      },
      {
        id: 'obj-4',
        description: 'Use PUBSUB NUMSUB to verify subscribers on storm:updates every 5 seconds',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.includes('PUBSUB NUMSUB') && lastCmd.includes('storm:updates')
        },
        continuous: true,
        minInterval: 5000
      },
      {
        id: 'obj-5',
        description: 'Publish to system:critical matching *:critical pattern every 3 seconds',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.startsWith('PUBLISH') && lastCmd.includes('system:critical')
        },
        continuous: true,
        minInterval: 3000
      }
    ],
    failureConditions: [
      {
        id: 'fail-1',
        description: 'Miss more than 3 scheduled publishes to storm:updates',
        check: (engine, state) => {
          return state.missedUpdates > 3
        }
      },
      {
        id: 'fail-2',
        description: 'Any publish returns 0 recipients (subscribers lost)',
        check: (engine, lastReply) => {
          return lastReply && lastReply.type === 'integer' && lastReply.value === 0
        }
      },
      {
        id: 'fail-3',
        description: 'Pattern subscription drops (PUBSUB NUMPAT returns 0)',
        check: (engine, lastReply) => {
          return lastReply && lastReply.type === 'integer' && lastReply.value === 0
        }
      }
    ],
    hints: [
      'Sequence format: PUBLISH storm:updates "seq:123:data"',
      'Alert format: PUBLISH storm:alerts "severity:high:message"',
      'Metrics format: PUBLISH metrics:throughput "count:42"',
      'Critical format: PUBLISH system:critical "CRITICAL:system failure"',
      'Verify with: PUBSUB NUMSUB storm:updates storm:alerts metrics:throughput',
      'Check patterns: PUBSUB NUMPAT'
    ]
  },
  {
    id: 'survival-6-3',
    name: 'Temporal Gauntlet',
    description: 'Manage a complex set of expiring keys with varying TTLs, refresh policies, and cleanup.',
    region: 'time-temple',
    duration: 60000, // 60 seconds
    difficulty: 'expert',
    xpReward: 300,
    setup: (engine) => {
      // Create initial keys with different TTLs
      engine.rawExecute('SET', 'gauntlet:alpha', 'data1')
      engine.rawExecute('EXPIRE', 'gauntlet:alpha', '30')

      engine.rawExecute('SET', 'gauntlet:beta', 'data2')
      engine.rawExecute('PEXPIRE', 'gauntlet:beta', '20000')

      engine.rawExecute('SET', 'gauntlet:gamma', 'data3')
      engine.rawExecute('EXPIREAT', 'gauntlet:gamma', String(Math.floor((Date.now() + 25000) / 1000)))

      engine.rawExecute('SET', 'gauntlet:delta', 'data4')
      engine.rawExecute('PEXPIREAT', 'gauntlet:delta', String(Date.now() + 15000))

      engine.rawExecute('SET', 'gauntlet:epsilon', 'data5')
      // No expiry - persistent
    },
    objectives: [
      {
        id: 'obj-1',
        description: 'Refresh gauntlet:alpha every 10 seconds using EXPIRE with GT option',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.includes('EXPIRE') && lastCmd.includes('gauntlet:alpha') && lastCmd.includes('GT')
        },
        continuous: true,
        minInterval: 10000
      },
      {
        id: 'obj-2',
        description: 'Extend gauntlet:beta by 5000ms using PEXPIRE with GT every 8 seconds',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.includes('PEXPIRE') && lastCmd.includes('gauntlet:beta') && lastCmd.includes('GT')
        },
        continuous: true,
        minInterval: 8000
      },
      {
        id: 'obj-3',
        description: 'Reset gauntlet:gamma to 30s future using EXPIREAT every 12 seconds',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.includes('EXPIREAT') && lastCmd.includes('gauntlet:gamma')
        },
        continuous: true,
        minInterval: 12000
      },
      {
        id: 'obj-4',
        description: 'Prevent gauntlet:delta expiry by switching to PERSIST when TTL < 3s',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.includes('PERSIST') && lastCmd.includes('gauntlet:delta')
        },
        continuous: true
      },
      {
        id: 'obj-5',
        description: 'Monitor all keys with SCAN and TYPE every 5 seconds',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.startsWith('SCAN') && lastCmd.includes('gauntlet:*')
        },
        continuous: true,
        minInterval: 5000
      },
      {
        id: 'obj-6',
        description: 'Check idle time of gauntlet:epsilon with OBJECT IDLETIME every 7 seconds',
        check: (engine, lastCmd) => {
          return lastCmd && lastCmd.includes('OBJECT IDLETIME') && lastCmd.includes('gauntlet:epsilon')
        },
        continuous: true,
        minInterval: 7000
      }
    ],
    failureConditions: [
      {
        id: 'fail-1',
        description: 'Any key expires (TTL reaches 0)',
        check: (engine) => {
          const keys = ['gauntlet:alpha', 'gauntlet:beta', 'gauntlet:gamma', 'gauntlet:delta']
          for (const key of keys) {
            const entry = engine._get(key)
            if (!entry) return true // Key expired and deleted
            if (entry.expiresAt !== null && entry.expiresAt <= engine.now()) return true
          }
          return false
        }
      },
      {
        id: 'fail-2',
        description: 'gauntlet:epsilon gets an expiry (must remain persistent)',
        check: (engine) => {
          const entry = engine._get('gauntlet:epsilon')
          return entry && entry.expiresAt !== null
        }
      },
      {
        id: 'fail-3',
        description: 'Miss more than 2 scheduled refresh operations',
        check: (engine, state) => {
          return state.missedRefreshes > 2
        }
      }
    ],
    hints: [
      'Refresh alpha: EXPIRE gauntlet:alpha 30 GT (only extends if new > current)',
      'Extend beta: PEXPIRE gauntlet:beta 25000 GT (extends by 5s from 20s)',
      'Reset gamma: EXPIREAT gauntlet:gamma <timestamp+30s>',
      'Save delta: PERSIST gauntlet:delta (when PTTL < 3000)',
      'Scan: SCAN 0 MATCH gauntlet:* COUNT 10',
      'Idle check: OBJECT IDLETIME gauntlet:epsilon',
      'Use PTTL to check remaining ms before acting'
    ]
  }
]

// Survival mode metadata
export const survivalModeConfig = {
  phase: 6,
  regions: ['leaderboard-arena', 'message-factory', 'time-temple'],
  unlockRequirement: 'Complete all Phase 6 region bosses',
  totalChallenges: 3,
  totalXP: 750,
  difficulties: ['hard', 'expert', 'expert']
}