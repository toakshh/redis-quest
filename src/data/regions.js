// 12 regions spanning the Redis learning journey.
// Each region has:
// - id: unique key
// - name: display name
// - description: flavor text
// - unlockCriteria: { bossDefeated?: string, minLevel?: number, keySkills?: string[] }
// - position: { x, y } on constellation map (0-1000 range)
// - silhouette: true if locked and not yet revealed
// - fastTravel: true if unlocked and fast travel available
// - skills: array of skill IDs in this region

export const REGIONS = [
  {
    id: 'strings',
    name: 'Strings Sector',
    description: 'Master the fundamentals: SET, GET, APPEND, STRLEN. Your first steps into the data continuum.',
    unlockCriteria: { minLevel: 1 },
    position: { x: 100, y: 500 },
    silhouette: false,
    fastTravel: false,
    skills: ['strings:set', 'strings:get', 'strings:append', 'strings:strlen', 'strings:incr'],
    color: '#22d3ee', // cyan
  },
  {
    id: 'hashes',
    name: 'Hashes Hub',
    description: 'Structured data lives here. HSET, HGET, HGETALL, HMSET — build objects, not just values.',
    unlockCriteria: { minLevel: 2, keySkills: ['strings:set'] },
    position: { x: 250, y: 350 },
    silhouette: true,
    fastTravel: false,
    skills: ['hashes:hset', 'hashes:hget', 'hashes:hgetall', 'hashes:hdel', 'hashes:hlen'],
    color: '#a78bfa', // purple
  },
  {
    id: 'lists',
    name: 'Lists Labyrinth',
    description: 'Ordered collections. LPUSH, RPUSH, LPOP, RPOP, LRANGE — queues and stacks at your command.',
    unlockCriteria: { minLevel: 3, keySkills: ['strings:set', 'hashes:hset'] },
    position: { x: 450, y: 200 },
    silhouette: true,
    fastTravel: false,
    skills: ['lists:lpush', 'lists:rpush', 'lists:lpop', 'lists:rpop', 'lists:lrange'],
    color: '#34d399', // green
  },
  {
    id: 'sets',
    name: 'Sets Sanctuary',
    description: 'Unique members only. SADD, SREM, SISMEMBER, SUNION, SINTER — mathematical set operations.',
    unlockCriteria: { minLevel: 4, keySkills: ['lists:lpush'] },
    position: { x: 650, y: 350 },
    silhouette: true,
    fastTravel: false,
    skills: ['sets:sadd', 'sets:srem', 'sets:sismember', 'sets:sunion', 'sets:sinter'],
    color: '#fbbf24', // amber
  },
  {
    id: 'zsets',
    name: 'Sorted Sets Spire',
    description: 'Ranked data. ZADD, ZRANGE, ZSCORE, ZRANK, ZREVRANGE — leaderboards and priority queues.',
    unlockCriteria: { minLevel: 5, keySkills: ['sets:sadd'] },
    position: { x: 800, y: 500 },
    silhouette: true,
    fastTravel: false,
    skills: ['zsets:zadd', 'zsets:zrange', 'zsets:zscore', 'zsets:zrank', 'zsets:zrevrange'],
    color: '#fb7185', // red
  },
  {
    id: 'keyspace',
    name: 'Keyspace Citadel',
    description: 'Meta-commands. KEYS, SCAN, EXISTS, DEL, EXPIRE, TTL — administer your database.',
    unlockCriteria: { minLevel: 6, keySkills: ['zsets:zadd'] },
    position: { x: 900, y: 700 },
    silhouette: true,
    fastTravel: false,
    skills: ['keyspace:keys', 'keyspace:scan', 'keyspace:exists', 'keyspace:del', 'keyspace:expire'],
    color: '#c8d3e0', // fg
  },
  {
    id: 'pubsub',
    name: 'Pub/Sub Plaza',
    description: 'Real-time messaging. SUBSCRIBE, PUBLISH, PSUBSCRIBE, PUBSUB — channels and patterns.',
    unlockCriteria: { minLevel: 7, keySkills: ['keyspace:scan'] },
    position: { x: 750, y: 850 },
    silhouette: true,
    fastTravel: false,
    skills: ['pubsub:subscribe', 'pubsub:publish', 'pubsub:psubscribe', 'pubsub:pubsub'],
    color: '#22d3ee', // cyan
  },
  {
    id: 'transactions',
    name: 'Transactions Tower',
    description: 'Atomic operations. MULTI, EXEC, DISCARD, WATCH, UNWATCH — all or nothing.',
    unlockCriteria: { minLevel: 8, keySkills: ['pubsub:subscribe'] },
    position: { x: 550, y: 900 },
    silhouette: true,
    fastTravel: false,
    skills: ['transactions:multi', 'transactions:exec', 'transactions:watch', 'transactions:discard'],
    color: '#a78bfa', // purple
  },
  {
    id: 'scripts',
    name: 'Scripts Sanctum',
    description: 'Server-side logic. EVAL, EVALSHA, SCRIPT LOAD, SCRIPT FLUSH — Lua in Redis.',
    unlockCriteria: { minLevel: 9, keySkills: ['transactions:multi'] },
    position: { x: 350, y: 850 },
    silhouette: true,
    fastTravel: false,
    skills: ['scripts:eval', 'scripts:evalsha', 'scripts:load', 'scripts:flush'],
    color: '#34d399', // green
  },
  {
    id: 'streams',
    name: 'Streams Nexus',
    description: 'Append-only logs. XADD, XREAD, XRANGE, XGROUP, XACK — event sourcing and consumer groups.',
    unlockCriteria: { minLevel: 10, keySkills: ['scripts:eval'] },
    position: { x: 200, y: 700 },
    silhouette: true,
    fastTravel: false,
    skills: ['streams:xadd', 'streams:xread', 'streams:xrange', 'streams:xgroup'],
    color: '#fbbf24', // amber
  },
  {
    id: 'clustering',
    name: 'Cluster Constellation',
    description: 'Horizontal scaling. CLUSTER commands, slots, replicas, failover — distributed Redis.',
    unlockCriteria: { minLevel: 12, keySkills: ['streams:xadd'] },
    position: { x: 100, y: 300 },
    silhouette: true,
    fastTravel: false,
    skills: ['clustering:meet', 'clustering:slots', 'clustering:replicate', 'clustering:failover'],
    color: '#fb7185', // red
  },
  {
    id: 'modules',
    name: 'Modules Observatory',
    description: 'Extensibility. RedisJSON, RediSearch, RedisGraph, RedisTimeSeries — beyond core.',
    unlockCriteria: { minLevel: 15, keySkills: ['clustering:meet'] },
    position: { x: 500, y: 100 },
    silhouette: true,
    fastTravel: false,
    skills: ['modules:json', 'modules:search', 'modules:graph', 'modules:timeseries'],
    color: '#c8d3e0', // fg
  },
]

// Connection lines between regions for constellation map
export const REGION_CONNECTIONS = [
  ['strings', 'hashes'],
  ['strings', 'lists'],
  ['hashes', 'lists'],
  ['hashes', 'sets'],
  ['lists', 'sets'],
  ['sets', 'zsets'],
  ['zsets', 'keyspace'],
  ['keyspace', 'pubsub'],
  ['pubsub', 'transactions'],
  ['transactions', 'scripts'],
  ['scripts', 'streams'],
  ['streams', 'clustering'],
  ['clustering', 'modules'],
  ['modules', 'strings'], // full circle
]