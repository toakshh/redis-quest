export const survivalChallenges = [
  {
    id: 'black-friday-surge',
    name: 'Black Friday Surge',
    region: 'performance-lab',
    description: '100k ops/sec, pipeline everything, WATCH inventory, SLOWLOG diagnose. Sustain 5 minutes under load.',
    icon: '🛍️',
    difficulty: 'legendary',
    duration: 300000, // 5 minutes in ms
    targetOpsPerSec: 100000,
    objectives: [
      { id: 'pipeline', name: 'Use pipelining for 90%+ of commands', target: 0.9 },
      { id: 'watch', name: 'Use WATCH/MULTI/EXEC for inventory updates', target: 1 },
      { id: 'slowlog', name: 'Keep slowlog entries under 5', target: 5 },
      { id: 'latency', name: 'Maintain p99 latency under 10ms', target: 10 },
    ],
    setup: `
-- Simulated inventory keys
SET inventory:sku:001 1000
SET inventory:sku:002 500
SET inventory:sku:003 2000
-- ... thousands more

-- Pre-warm connection pool
CLIENT SETNAME load-tester-1
`,
    validation: (engine, stats) => {
      return stats.opsPerSecond >= 100000 && stats.slowlogCount < 5
    },
    leaderboard: {
      global: [],
      friends: [],
      personal: [],
    },
    rewards: {
      title: 'Black Friday Survivor',
      cosmetic: 'surge-particles',
      xp: 500,
    },
    seed: 'black-friday-2024',
  },
  {
    id: 'global-session-sync',
    name: 'Global Session Sync',
    region: 'time-temple',
    description: 'Multi-region sessions, CLUSTER replication, sliding TTL, SCAN cleanup. Zero session loss during simulated partition.',
    icon: '🌐',
    difficulty: 'legendary',
    duration: 180000, // 3 minutes
    objectives: [
      { id: 'replication', name: 'Configure CLUSTER replication across 3 regions', target: 3 },
      { id: 'sliding-ttl', name: 'Implement sliding TTL for active sessions', target: 1 },
      { id: 'scan-cleanup', name: 'Use SCAN to cleanup expired sessions', target: 100 },
      { id: 'partition-survival', name: 'Survive 30-second network partition', target: 1 },
    ],
    setup: `
-- Session keys with sliding TTL
SET session:user:12345 '{"region":"us-east","data":...}' EX 3600
-- On each request: EXPIRE session:user:12345 3600

-- Cluster setup for multi-region
CLUSTER MEET 10.0.1.1 6379
CLUSTER MEET 10.0.2.1 6379
CLUSTER REPLICATE <master-id>
`,
    validation: (engine, stats) => {
      return stats.sessionLoss === 0 && stats.replicationLag < 100
    },
    leaderboard: { global: [], friends: [], personal: [] },
    rewards: { title: 'Global Sync Master', cosmetic: 'globe-aura', xp: 500 },
    seed: 'global-sync-2024',
  },
  {
    id: 'realtime-analytics',
    name: 'Real-time Analytics',
    region: 'leaderboard-arena',
    description: 'XADD events, ZINCRBY metrics, XREADGROUP consumers, XTRIM retention. Sub-second dashboard at 10k events/sec.',
    icon: '📊',
    difficulty: 'legendary',
    duration: 120000, // 2 minutes
    targetEventsPerSec: 10000,
    objectives: [
      { id: 'xadd-throughput', name: 'Sustain 10k XADD/sec', target: 10000 },
      { id: 'zinCRBY', name: 'Update metrics with ZINCRBY', target: 1000 },
      { id: 'consumer-groups', name: 'Process with XREADGROUP (3 consumers)', target: 3 },
      { id: 'retention', name: 'Trim streams with XTRIM MAXLEN', target: 1 },
      { id: 'dashboard-latency', name: 'Dashboard query under 100ms', target: 100 },
    ],
    setup: `
-- Event stream
XADD events:raw * user_id 12345 action purchase amount 99.99 sku 001
XADD events:raw * user_id 12346 action view sku 002

-- Metrics sorted sets
ZINCRBY metrics:revenue 99.99 total
ZINCRBY metrics:sku:001 1 purchases
ZINCRBY metrics:hourly:14 1 events

-- Consumer group
XGROUP CREATE events:raw processors \$ MKSTREAM
XREADGROUP GROUP processors consumer-1 COUNT 10 STREAMS events:raw >
`,
    validation: (engine, stats) => {
      return stats.eventsProcessed >= 10000 && stats.dashboardLatency < 100
    },
    leaderboard: { global: [], friends: [], personal: [] },
    rewards: { title: 'Analytics Architect', cosmetic: 'chart-particles', xp: 500 },
    seed: 'realtime-analytics-2024',
  },
  {
    id: 'job-queue-resilience',
    name: 'Job Queue Resilience',
    region: 'list-harbor',
    description: 'LPUSH/BRPOP + XADD/XREADGROUP, retries, dead letters, priority. Process 1M jobs with <0.1% failure.',
    icon: '📦',
    difficulty: 'legendary',
    duration: 240000, // 4 minutes
    targetJobs: 1000000,
    maxFailureRate: 0.001,
    objectives: [
      { id: 'throughput', name: 'Process 1M jobs', target: 1000000 },
      { id: 'retries', name: 'Implement retry logic with backoff', target: 3 },
      { id: 'dead-letter', name: 'Route failed jobs to dead letter queue', target: 1 },
      { id: 'priority', name: 'Support priority queues', target: 1 },
      { id: 'failure-rate', name: 'Keep failure rate under 0.1%', target: 0.001 },
    ],
    setup: `
-- Job queue (list-based)
LPUSH queue:jobs '{"id":1,"type":"email","payload":{...},"priority":1,"retries":0}'

-- Priority queues
LPUSH queue:jobs:high '{"id":2,"type":"payment",...}'
LPUSH queue:jobs:low '{"id":3,"type":"analytics",...}'

-- Dead letter stream
XADD queue:dead * job_id 1 error "timeout" attempts 3

-- Consumer with BRPOP
BRPOP queue:jobs:high queue:jobs queue:jobs:low 5
`,
    validation: (engine, stats) => {
      return stats.jobsProcessed >= 1000000 && stats.failureRate < 0.001
    },
    leaderboard: { global: [], friends: [], personal: [] },
    rewards: { title: 'Queue Commander', cosmetic: 'gear-particles', xp: 500 },
    seed: 'job-queue-2024',
  },
  {
    id: 'geospatial-services',
    name: 'Geospatial Services',
    region: 'new-geo',
    description: 'GEOADD, GEORADIUS, GEOSEARCH, GEODIST for location-based features. Power a ride-sharing dispatch simulation.',
    icon: '🗺️',
    difficulty: 'legendary',
    duration: 180000, // 3 minutes
    objectives: [
      { id: 'driver-index', name: 'Index 10k drivers with GEOADD', target: 10000 },
      { id: 'radius-search', name: 'Find drivers within radius (GEORADIUS)', target: 100 },
      { id: 'box-search', name: 'Find drivers in area (GEOSEARCH BYBOX)', target: 50 },
      { id: 'distance-calc', name: 'Calculate distances with GEODIST', target: 200 },
      { id: 'dispatch', name: 'Dispatch nearest driver for 1k rides', target: 1000 },
      { id: 'update-frequency', name: 'Update driver positions every 5 seconds', target: 1 },
    ],
    setup: `
-- Add drivers
GEOADD drivers:city1 -122.4194 37.7749 driver:1
GEOADD drivers:city1 -122.4195 37.7750 driver:2
-- ... 10k drivers

-- Find nearby drivers (radius)
GEORADIUS drivers:city1 -122.4194 37.7749 5 km WITHCOORD WITHDIST COUNT 10 ASC

-- Find nearby drivers (box)
GEOSEARCH drivers:city1 FROMLONLAT -122.4194 37.7749 BYBOX 10 10 km COUNT 20

-- Distance between points
GEODIST drivers:city1 driver:1 driver:2 km

-- Update driver position (re-add)
GEOADD drivers:city1 -122.4200 37.7755 driver:1
`,
    validation: (engine, stats) => {
      return stats.driversIndexed >= 10000 && stats.ridesDispatched >= 1000
    },
    leaderboard: { global: [], friends: [], personal: [] },
    rewards: { title: 'Geo Navigator', cosmetic: 'map-particles', xp: 500 },
    seed: 'geospatial-2024',
  },
  {
    id: 'security-audit-trail',
    name: 'Security Audit Trail',
    region: 'security-fortress',
    description: 'ACL LOG → XADD audit stream, XREADGROUP SIEM, tamper-proof. Detect and alert on simulated intrusion.',
    icon: '🔒',
    difficulty: 'legendary',
    duration: 150000, // 2.5 minutes
    objectives: [
      { id: 'audit-stream', name: 'Pipe ACL LOG to audit stream with XADD', target: 1 },
      { id: 'siem-consumer', name: 'SIEM consumer with XREADGROUP', target: 1 },
      { id: 'tamper-proof', name: 'Implement tamper-proof logging (append-only)', target: 1 },
      { id: 'intrusion-detect', name: 'Detect simulated intrusion patterns', target: 5 },
      { id: 'alert-latency', name: 'Alert within 100ms of detection', target: 100 },
    ],
    setup: `
-- Audit stream (append-only)
XADD audit:acl * user attacker command "CONFIG SET" reason "denied" timestamp 1234567890
XADD audit:acl * user hacker command "DEBUG SEGFAULT" reason "denied" timestamp 1234567891

-- SIEM consumer group
XGROUP CREATE audit:acl siem \$ MKSTREAM

-- Read new audit events
XREADGROUP GROUP siem consumer-1 COUNT 100 STREAMS audit:acl >

-- Alert stream
XADD alerts:security * severity critical rule "acl-denied-config" user attacker
`,
    validation: (engine, stats) => {
      return stats.intrusionsDetected >= 5 && stats.alertLatency < 100
    },
    leaderboard: { global: [], friends: [], personal: [] },
    rewards: { title: 'Security Guardian', cosmetic: 'shield-particles', xp: 500 },
    seed: 'security-audit-2024',
  },
]