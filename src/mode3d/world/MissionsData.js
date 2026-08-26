/**
 * Missions 1-5 definitions for the 3D Netrunner mode
 * Each mission maps to a Redis anomaly scenario
 */

export const MISSIONS = [
  {
    id: 1,
    code: 'CACHE-STAMP-001',
    name: 'Cache Stampede',
    anomaly: 'Thundering Herd on Cache Expiry',
    severity: 4,
    redisVersion: '7.2.4',
    theme: 'standard',
    description: 'A hot key expired causing thousands of simultaneous cache misses. The backend database is collapsing under the load. You must implement cache stampede protection before the cluster fails.',
    briefing: `
INCOMING TRANSMISSION: NETOPS-COMMAND
PRIORITY: ALPHA
TARGET: REDIS-CLUSTER-7 // NODE-3

ANOMALY DETECTED: Cache stampede on key "user:session:global"
IMPACT: 94% CPU across cluster, 5000+ qps DB fallback
ROOT CAUSE: TTL expiry without probabilistic early recomputation

YOUR MISSION:
1. SCAN cluster topology and identify stampede epicenter
2. DEPLOY probabilistic early expiration (TTL jitter)
3. IMPLEMENT request coalescing via SETNX lock pattern
4. VERIFY cache hit ratio > 95%
5. EXFILTRATE before thermal throttling triggers

WARNING: Sanity degradation accelerated in high-load zones.
    `.trim(),
    objectives: [
      { 
        id: 'scan_topology', 
        description: 'Scan cluster topology', 
        priority: 0,
        redisTaskId: 'scan_cluster',
        position: { x: 0, y: 0, z: -30 },
      },
      { 
        id: 'identify_hotkey', 
        description: 'Identify stampede hot key', 
        priority: 1,
        redisTaskId: 'find_hotkey',
        position: { x: -10, y: 0, z: -20 },
      },
      { 
        id: 'deploy_jitter', 
        description: 'Deploy TTL jitter protection', 
        priority: 2,
        redisTaskId: 'set_jitter',
        position: { x: 10, y: 0, z: -20 },
      },
      { 
        id: 'implement_coalescing', 
        description: 'Implement request coalescing', 
        priority: 3,
        redisTaskId: 'setnx_lock',
        position: { x: 0, y: 0, z: -10 },
      },
      { 
        id: 'verify_hitratio', 
        description: 'Verify cache hit ratio > 95%', 
        priority: 4,
        redisTaskId: 'check_stats',
        position: { x: 0, y: 0, z: 0 },
      },
    ],
    redisTasks: [
      { id: 'scan_cluster', command: 'CLUSTER NODES', label: 'Cluster topology' },
      { id: 'find_hotkey', command: 'MEMORY USAGE user:session:global', label: 'Hot key analysis' },
      { id: 'set_jitter', command: 'CONFIG SET maxmemory-policy allkeys-lru', label: 'Eviction policy' },
      { id: 'setnx_lock', command: 'SET lock:user:session:global 1 NX EX 10', label: 'Coalescing lock' },
      { id: 'check_stats', command: 'INFO stats', label: 'Verify hit ratio' },
    ],
    fixCommand: 'CONFIG SET lazyfree-lazy-eviction yes',
    sanityReward: 10,
    sanityPenalty: 5,
    timeLimit: 300, // 5 minutes
    enemyTypes: ['cache_thrasher', 'db_connection'],
    environmentalHazards: ['thermal_throttling'],
    loopModifiers: {
      cacheDecayRate: 1.5,
      enemyAggression: 1.2,
    },
  },
  {
    id: 2,
    code: 'RATE-LIMIT-002',
    name: 'Rate Limit Siege',
    anomaly: 'Token Bucket Exhaustion Under DDoS',
    severity: 6,
    redisVersion: '7.2.4',
    theme: 'corrupted',
    description: 'A distributed attack is draining token buckets faster than they refill. Legitimate traffic is being blocked. You must redesign the rate limiting algorithm to withstand the siege.',
    briefing: `
INCOMING TRANSMISSION: NETOPS-COMMAND
PRIORITY: BRAVO
TARGET: API-GATEWAY-CLUSTER // EDGE-NODES

ANOMALY DETECTED: Token bucket exhaustion across 84% of rate limit keys
IMPACT: 67% legitimate traffic rejected, false positive rate critical
ROOT CAUSE: Fixed-window counter vulnerability to burst synchronization

YOUR MISSION:
1. ANALYZE attack pattern on rate limit keys
2. DEPLOY sliding window log algorithm (Redis sorted sets)
3. IMPLEMENT adaptive refill based on traffic baseline
4. CONFIGURE graduated response (warn → throttle → block)
5. VALIDATE < 1% false positive rate under load

WARNING: Hostile entities track rate limit state. Low sanity = targeting errors.
    `.trim(),
    objectives: [
      { 
        id: 'analyze_attack', 
        description: 'Analyze attack pattern', 
        priority: 0,
        redisTaskId: 'monitor_ratelimit',
        position: { x: 20, y: 0, z: -25 },
      },
      { 
        id: 'deploy_sliding', 
        description: 'Deploy sliding window algorithm', 
        priority: 1,
        redisTaskId: 'zadd_window',
        position: { x: -15, y: 0, z: -15 },
      },
      { 
        id: 'adaptive_refill', 
        description: 'Implement adaptive refill', 
        priority: 2,
        redisTaskId: 'lua_refill',
        position: { x: 15, y: 0, z: -15 },
      },
      { 
        id: 'graduated_response', 
        description: 'Configure graduated response', 
        priority: 3,
        redisTaskId: 'config_tiers',
        position: { x: 0, y: 0, z: -5 },
      },
      { 
        id: 'validate_fpr', 
        description: 'Validate false positive rate', 
        priority: 4,
        redisTaskId: 'check_metrics',
        position: { x: 0, y: 0, z: 10 },
      },
    ],
    redisTasks: [
      { id: 'monitor_ratelimit', command: 'MONITOR', label: 'Traffic analysis' },
      { id: 'zadd_window', command: 'ZADD ratelimit:api:123 {timestamp} {request_id}', label: 'Sliding window' },
      { id: 'lua_refill', command: 'EVAL "local tokens = redis.call(\'GET\', KEYS[1]) ...', label: 'Adaptive Lua script' },
      { id: 'config_tiers', command: 'HMSET ratelimit:config warn 100 throttle 500 block 1000', label: 'Tier config' },
      { id: 'check_metrics', command: 'INFO stats', label: 'Metrics verification' },
    ],
    fixCommand: 'EVALSHA <sliding_window_sha> 1 ratelimit:api:user123',
    sanityReward: 15,
    sanityPenalty: 8,
    timeLimit: 360,
    enemyTypes: ['rate_limiter', 'ddos_bot', 'token_drainer'],
    environmentalHazards: ['network_jitter', 'packet_loss'],
    loopModifiers: {
      tokenDrainRate: 2.0,
      enemySpawnRate: 1.5,
    },
  },
  {
    id: 3,
    code: 'MEM-LEAK-003',
    name: 'Memory Leak Crisis',
    anomaly: 'Unbounded Stream Growth / Lua Script Leak',
    severity: 8,
    redisVersion: '7.2.4',
    theme: 'archive',
    description: 'Memory consumption is growing exponentially. A consumer group lag is causing stream entries to accumulate. A poorly written Lua script is leaking memory. You must identify and plug the leaks before OOM killer triggers.',
    briefing: `
INCOMING TRANSMISSION: NETOPS-COMMAND
PRIORITY: CHARLIE
TARGET: EVENT-STREAM-CLUSTER // NODE-1..6

ANOMALY DETECTED: Memory growth 2.3GB/hour, projected OOM in 47 minutes
IMPACT: Consumer group "analytics-workers" lag: 2.4M entries
ROOT CAUSE: 1) XREADGROUP no ACK, 2) Lua script creating orphaned keys

YOUR MISSION:
1. DIAGNOSE memory growth source via MEMORY DOCTOR
2. IDENTIFY leaking Lua script and consumer lag
3. PURGE unacknowledged stream entries (XCLAIM)
4. PATCH Lua script with proper key cleanup
5. CONFIGURE maxmemory-policy and eviction
6. CONFIRM memory growth < 50MB/hour

WARNING: Memory pressure causes reality distortion. Hallucinations likely.
    `.trim(),
    objectives: [
      { 
        id: 'diagnose_memory', 
        description: 'Diagnose memory growth', 
        priority: 0,
        redisTaskId: 'memory_doctor',
        position: { x: -25, y: 0, z: 10 },
      },
      { 
        id: 'identify_leaks', 
        description: 'Identify Lua leak and consumer lag', 
        priority: 1,
        redisTaskId: 'xinfo_groups',
        position: { x: 25, y: 0, z: 10 },
      },
      { 
        id: 'purge_streams', 
        description: 'Purge unacknowledged entries', 
        priority: 2,
        redisTaskId: 'xclaim_stale',
        position: { x: -10, y: 0, z: 20 },
      },
      { 
        id: 'patch_lua', 
        description: 'Patch Lua script', 
        priority: 3,
        redisTaskId: 'script_load',
        position: { x: 10, y: 0, z: 20 },
      },
      { 
        id: 'config_eviction', 
        description: 'Configure eviction policy', 
        priority: 4,
        redisTaskId: 'maxmemory_policy',
        position: { x: 0, y: 0, z: 30 },
      },
    ],
    redisTasks: [
      { id: 'memory_doctor', command: 'MEMORY DOCTOR', label: 'Memory diagnosis' },
      { id: 'xinfo_groups', command: 'XINFO GROUPS events:stream', label: 'Consumer groups' },
      { id: 'xclaim_stale', command: 'XCLAIM events:stream analytics-workers 0 1000 1523456789000-0', label: 'Claim stale' },
      { id: 'script_load', command: 'SCRIPT LOAD "local keys = redis.call(\'KEYS\', \'leak:*\') for _,k in ipairs(keys) do redis.call(\'DEL\', k) end"', label: 'Cleanup script' },
      { id: 'maxmemory_policy', command: 'CONFIG SET maxmemory-policy volatile-lru', label: 'Eviction config' },
    ],
    fixCommand: 'XCLAIM events:stream analytics-workers 0 1000 *',
    sanityReward: 20,
    sanityPenalty: 12,
    timeLimit: 420,
    enemyTypes: ['memory_phantom', 'lua_wraith', 'oom_reaper'],
    environmentalHazards: ['memory_pressure', 'reality_tears'],
    loopModifiers: {
      memoryGrowthRate: 2.5,
      hallucinationFrequency: 2.0,
    },
  },
  {
    id: 4,
    code: 'DEAD-LETTER-004',
    name: 'Dead-Letter Pipeline',
    anomaly: 'Stream Consumer Failure Cascade',
    severity: 7,
    redisVersion: '7.2.4',
    theme: 'corrupted',
    description: 'A critical stream consumer has failed, causing messages to pile up in the dead letter queue. The retry logic is broken, creating a cascade of failures. You must restore the pipeline and process the backlog.',
    briefing: `
INCOMING TRANSMISSION: NETOPS-COMMAND
PRIORITY: DELTA
TARGET: MESSAGE-BUS-CLUSTER // DLQ-HANDLER

ANOMALY DETECTED: Dead letter queue depth: 847,291 messages
IMPACT: Critical business events unprocessed for 3.2 hours
ROOT CAUSE: Consumer crash → auto-retry → poison pill → DLQ overflow

YOUR MISSION:
1. INSPECT dead letter queue structure
2. ANALYZE poison pill message pattern
3. ISOLATE and QUARANTINE toxic messages
4. REPAIR consumer retry logic (exponential backoff)
5. REPLAY sanitized messages to primary stream
6. VERIFY end-to-end latency < 100ms

WARNING: Dead messages carry residual corruption. Handle with extreme caution.
    `.trim(),
    objectives: [
      { 
        id: 'inspect_dlq', 
        description: 'Inspect dead letter queue', 
        priority: 0,
        redisTaskId: 'xrange_dlq',
        position: { x: 0, y: 0, z: -40 },
      },
      { 
        id: 'analyze_poison', 
        description: 'Analyze poison pill pattern', 
        priority: 1,
        redisTaskId: 'lrange_dlq',
        position: { x: -20, y: 0, z: -30 },
      },
      { 
        id: 'quarantine_toxic', 
        description: 'Quarantine toxic messages', 
        priority: 2,
        redisTaskId: 'xdel_toxic',
        position: { x: 20, y: 0, z: -30 },
      },
      { 
        id: 'repair_retry', 
        description: 'Repair retry logic', 
        priority: 3,
        redisTaskId: 'config_retry',
        position: { x: -10, y: 0, z: -20 },
      },
      { 
        id: 'replay_sanitized', 
        description: 'Replay sanitized messages', 
        priority: 4,
        redisTaskId: 'xadd_replay',
        position: { x: 10, y: 0, z: -20 },
      },
      { 
        id: 'verify_latency', 
        description: 'Verify latency < 100ms', 
        priority: 5,
        redisTaskId: 'check_latency',
        position: { x: 0, y: 0, z: -10 },
      },
    ],
    redisTasks: [
      { id: 'xrange_dlq', command: 'XRANGE dlq:events - + COUNT 100', label: 'DLQ inspection' },
      { id: 'lrange_dlq', command: 'LRANGE dlq:poison 0 -1', label: 'Poison analysis' },
      { id: 'xdel_toxic', command: 'XDEL dlq:events 1523456789000-0 1523456789100-0', label: 'Toxic removal' },
      { id: 'config_retry', command: 'HMSET consumer:config max_retries 5 backoff_base 1000 backoff_max 30000', label: 'Retry config' },
      { id: 'xadd_replay', command: 'XADD events:stream * payload "{sanitized}"', label: 'Message replay' },
      { id: 'check_latency', command: 'LATENCY DOCTOR', label: 'Latency check' },
    ],
    fixCommand: 'XREADGROUP GROUP main consumers COUNT 100 STREAMS events:stream >',
    sanityReward: 18,
    sanityPenalty: 10,
    timeLimit: 360,
    enemyTypes: ['poison_pill', 'retry_storm', 'dlq_guardian'],
    environmentalHazards: ['corruption_aura', 'message_echoes'],
    loopModifiers: {
      poisonRespawnRate: 1.8,
      corruptionSpread: 1.5,
    },
  },
  {
    id: 5,
    code: 'SPLIT-BRAIN-005',
    name: 'Split-Brain Failover',
    anomaly: 'Network Partition + Quorum Loss',
    severity: 10,
    redisVersion: '7.2.4',
    theme: 'corrupted',
    description: 'A network partition has split the cluster into two halves. Both sides think they are primary. Data divergence is accelerating. You must restore quorum, resolve conflicts, and reunify the cluster before permanent data loss.',
    briefing: `
INCOMING TRANSMISSION: NETOPS-COMMAND
PRIORITY: OMEGA // MAXIMUM
TARGET: REDIS-CLUSTER-PRIMARY // ALL NODES

ANOMALY DETECTED: Network partition detected - QUORUM LOST
PARTITION A: 3 masters, 3 replicas (THINKS PRIMARY)
PARTITION B: 3 masters, 3 replicas (THINKS PRIMARY)
DIVERGENCE: 12,847 conflicting writes detected
TIME TO IRREVERSIBLE LOSS: 8 MINUTES

YOUR MISSION:
1. ESTABLISH contact with both partitions
2. IDENTIFY authoritative partition via epoch
3. GRACEFULLY DEMOTE false primary
4. RESOLVE write conflicts (last-write-wins / CRDT)
5. REJOIN nodes and REBALANCE slots
6. VERIFY data consistency across cluster

WARNING: This is a survival scenario. Sanity will not recover naturally.
FAILURE IS NOT AN OPTION.
    `.trim(),
    objectives: [
      { 
        id: 'contact_partitions', 
        description: 'Establish contact with both partitions', 
        priority: 0,
        redisTaskId: 'cluster_meet',
        position: { x: -30, y: 0, z: 0 },
      },
      { 
        id: 'identify_authoritative', 
        description: 'Identify authoritative partition', 
        priority: 1,
        redisTaskId: 'cluster_nodes',
        position: { x: 30, y: 0, z: 0 },
      },
      { 
        id: 'demote_false', 
        description: 'Demote false primary', 
        priority: 2,
        redisTaskId: 'cluster_failover',
        position: { x: -20, y: 0, z: 20 },
      },
      { 
        id: 'resolve_conflicts', 
        description: 'Resolve write conflicts', 
        priority: 3,
        redisTaskId: 'resolve_conflicts',
        position: { x: 20, y: 0, z: 20 },
      },
      { 
        id: 'rejoin_rebalance', 
        description: 'Rejoin nodes and rebalance', 
        priority: 4,
        redisTaskId: 'cluster_rebalance',
        position: { x: 0, y: 0, z: 30 },
      },
      { 
        id: 'verify_consistency', 
        description: 'Verify data consistency', 
        priority: 5,
        redisTaskId: 'verify_data',
        position: { x: 0, y: 0, z: 40 },
      },
    ],
    redisTasks: [
      { id: 'cluster_meet', command: 'CLUSTER MEET 10.0.0.1 6379', label: 'Partition contact' },
      { id: 'cluster_nodes', command: 'CLUSTER NODES', label: 'Epoch check' },
      { id: 'cluster_failover', command: 'CLUSTER FAILFORCE <node_id>', label: 'Force failover' },
      { id: 'resolve_conflicts', command: 'EVAL "local a=redis.call(\'GET\',KEYS[1]) local b=redis.call(\'GET\',KEYS[2]) return a>b and a or b" 2 key:partition_a key:partition_b', label: 'Conflict resolution' },
      { id: 'cluster_rebalance', command: 'CLUSTER REBALANCE', label: 'Slot rebalance' },
      { id: 'verify_data', command: 'CLUSTER CHECK', label: 'Consistency verify' },
    ],
    fixCommand: 'CLUSTER FAILFORCE <false_primary_id>',
    sanityReward: 30,
    sanityPenalty: 20,
    timeLimit: 480,
    enemyTypes: ['split_brain_avatar', 'conflict_wraith', 'data_reaper'],
    environmentalHazards: ['reality_fracture', 'time_dilation', 'sanity_drain'],
    loopModifiers: {
      divergenceAcceleration: 3.0,
      sanityDrainRate: 2.5,
      enemyPowerMultiplier: 2.0,
    },
  },
];

// Helper to get mission by ID
export function getMission(id) {
  return MISSIONS.find(m => m.id === id) || MISSIONS[0];
}

// Helper to get mission by code
export function getMissionByCode(code) {
  return MISSIONS.find(m => m.code === code) || MISSIONS[0];
}

// Export default for easy importing
export default MISSIONS;
