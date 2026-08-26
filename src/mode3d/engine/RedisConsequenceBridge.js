import { consequenceEngine, CONSEQUENCE_EVENTS } from '../../systems/consequences/ConsequenceEngine'
import { use3DGameStore } from '../../stores/use3DGameStore'

const store = use3DGameStore.getState()

// 3D-specific consequence rules that map Redis commands to world effects
const THREED_CONSEQUENCE_RULES = [
  // Door/Gate control
  {
    id: 'door-unlock',
    match: (ctx) => ctx.command === 'SET' && ctx.args[0]?.startsWith('door:') && ctx.args[1] === 'unlocked',
    getPayload: (ctx) => ({ type: 'DOOR_UNLOCKED', doorId: ctx.args[0].replace('door:', '') }),
  },
  {
    id: 'door-lock',
    match: (ctx) => ctx.command === 'SET' && ctx.args[0]?.startsWith('door:') && ctx.args[1] === 'locked',
    getPayload: (ctx) => ({ type: 'DOOR_LOCKED', doorId: ctx.args[0].replace('door:', '') }),
  },
  {
    id: 'gate-open',
    match: (ctx) => ctx.command === 'SET' && ctx.args[0] === 'api:gate:mode' && ctx.args[1] === 'open',
    getPayload: () => ({ type: 'GATE_OPENED' }),
  },

  // Shield management
  {
    id: 'shield-activate',
    match: (ctx) => ctx.command === 'SET' && ctx.args[0] === 'shield:status' && ctx.args[1] === 'active',
    getPayload: (ctx) => ({ type: 'SHIELD_ACTIVATED', power: parseInt(ctx.args[2] || '100', 10) }),
  },
  {
    id: 'shield-deactivate',
    match: (ctx) => ctx.command === 'SET' && ctx.args[0] === 'shield:status' && ctx.args[1] === 'inactive',
    getPayload: () => ({ type: 'SHIELD_DEACTIVATED' }),
  },
  {
    id: 'shield-damage',
    match: (ctx) => ctx.command === 'DECRBY' && ctx.args[0] === 'shield:power',
    getPayload: (ctx) => ({ type: 'SHIELD_DAMAGED', amount: parseInt(ctx.args[1] || '10', 10) }),
  },

  // Anomaly interaction
  {
    id: 'anomaly-stun',
    match: (ctx) => ctx.command === 'SET' && ctx.args[0]?.startsWith('anomaly:') && ctx.args[0].endsWith(':stunned') && ctx.args[1] === 'true',
    getPayload: (ctx) => ({
      type: 'ANOMALY_STUNNED',
      anomalyId: ctx.args[0].replace('anomaly:', '').replace(':stunned', ''),
    }),
  },
  {
    id: 'anomaly-shield-break',
    match: (ctx) => ctx.command === 'DEL' && ctx.args[0]?.startsWith('anomaly:') && ctx.args[0].endsWith(':shield'),
    getPayload: (ctx) => ({
      type: 'ANOMALY_SHIELD_BROKEN',
      anomalyId: ctx.args[0].replace('anomaly:', '').replace(':shield', ''),
    }),
  },
  {
    id: 'anomaly-kill',
    match: (ctx) => ctx.command === 'DEL' && ctx.args[0]?.startsWith('anomaly:') && ctx.args[0].endsWith(':core'),
    getPayload: (ctx) => ({
      type: 'ANOMALY_KILLED',
      anomalyId: ctx.args[0].replace('anomaly:', '').replace(':core', ''),
    }),
  },

  // Corruption control
  {
    id: 'corruption-reduce',
    match: (ctx) => ctx.command === 'DECRBY' && ctx.args[0] === 'environment:corruption',
    getPayload: (ctx) => ({ type: 'CORRUPTION_REDUCED', amount: parseInt(ctx.args[1] || '10', 10) }),
  },
  {
    id: 'corruption-clear',
    match: (ctx) => ctx.command === 'SET' && ctx.args[0] === 'environment:corruption' && ctx.args[1] === '0',
    getPayload: () => ({ type: 'CORRUPTION_CLEARED' }),
  },

  // Power management
  {
    id: 'power-restore',
    match: (ctx) => ctx.command === 'SET' && ctx.args[0] === 'power:state' && ctx.args[1] === 'online',
    getPayload: () => ({ type: 'POWER_RESTORED' }),
  },
  {
    id: 'power-cut',
    match: (ctx) => ctx.command === 'SET' && ctx.args[0] === 'power:state' && ctx.args[1] === 'offline',
    getPayload: () => ({ type: 'POWER_CUT' }),
  },

  // Queue/stream processing
  {
    id: 'queue-process',
    match: (ctx) => ctx.command === 'XREADGROUP' && ctx.args.includes('queue:orders'),
    getPayload: (ctx) => ({ type: 'QUEUE_PROCESSED', count: parseInt(ctx.args[ctx.args.indexOf('COUNT') + 1] || '1', 10) }),
  },
  {
    id: 'stream-ack',
    match: (ctx) => ctx.command === 'XACK' && ctx.args[0] === 'queue:orders',
    getPayload: () => ({ type: 'STREAM_ACKED' }),
  },

  // Cache stampede specific
  {
    id: 'cache-lock-acquire',
    match: (ctx) => ctx.command === 'SETNX' && ctx.args[0]?.startsWith('lock:cache:'),
    getPayload: (ctx) => ({ type: 'CACHE_LOCK_ACQUIRED', lockKey: ctx.args[0] }),
  },
  {
    id: 'cache-lock-release',
    match: (ctx) => ctx.command === 'DEL' && ctx.args[0]?.startsWith('lock:cache:'),
    getPayload: (ctx) => ({ type: 'CACHE_LOCK_RELEASED', lockKey: ctx.args[0] }),
  },

  // Rate limit
  {
    id: 'ratelimit-eval',
    match: (ctx) => ctx.command === 'EVAL' && ctx.args.some(a => a.includes('ratelimit')),
    getPayload: (ctx) => ({ type: 'RATELIMIT_CHECK', script: ctx.args[0] }),
  },

  // Memory management
  {
    id: 'memory-unlink',
    match: (ctx) => ctx.command === 'UNLINK',
    getPayload: (ctx) => ({ type: 'MEMORY_UNLINKED', keys: ctx.args }),
  },
  {
    id: 'memory-policy-set',
    match: (ctx) => ctx.command === 'CONFIG' && ctx.args[0] === 'SET' && ctx.args[1] === 'maxmemory-policy',
    getPayload: (ctx) => ({ type: 'MEMORY_POLICY_SET', policy: ctx.args[2] }),
  },

  // Cluster failover
  {
    id: 'cluster-failover',
    match: (ctx) => ctx.command === 'CLUSTER' && ctx.args[0] === 'FAILOVER',
    getPayload: () => ({ type: 'CLUSTER_FAILOVER_INITIATED' }),
  },
  {
    id: 'cluster-info',
    match: (ctx) => ctx.command === 'CLUSTER' && ctx.args[0] === 'INFO',
    getPayload: () => ({ type: 'CLUSTER_INFO_REQUESTED' }),
  },
]

// Register 3D rules with the global consequence engine
export function register3DConsequences() {
  THREED_CONSEQUENCE_RULES.forEach(rule => {
    consequenceEngine.addRule(rule)
  })
}

// Dispatcher: receives consequence events and applies to 3D store
export function setup3DConsequenceDispatcher() {
  const unsubscribe = consequenceEngine.subscribe((consequence) => {
    const { type, payload } = consequence

    switch (type) {
      case 'DOOR_UNLOCKED':
        store.openDoor(payload.doorId)
        break
      case 'DOOR_LOCKED':
        store.lockDoor(payload.doorId)
        break
      case 'GATE_OPENED':
        store.openDoor('main_gate')
        store.setRoomState('gate', { isLocked: false, isOpen: true })
        break

      case 'SHIELD_ACTIVATED':
        store.setRoomState('shield', { active: true, power: payload.power })
        break
      case 'SHIELD_DEACTIVATED':
        store.setRoomState('shield', { active: false, power: 0 })
        break
      case 'SHIELD_DAMAGED':
        store.setRoomState('shield', (prev) => ({
          ...prev,
          power: Math.max(0, (prev?.power || 100) - payload.amount),
          active: (prev?.power || 100) - payload.amount > 0,
        }))
        break

      case 'ANOMALY_STUNNED':
        store.setEnemyState(payload.anomalyId, 'stunned')
        // Auto-unstun after 3s
        setTimeout(() => store.setEnemyState(payload.anomalyId, 'alert'), 3000)
        break
      case 'ANOMALY_SHIELD_BROKEN':
        store.updateEnemy(payload.anomalyId, { shielded: false })
        break
      case 'ANOMALY_KILLED':
        store.killEnemy(payload.anomalyId)
        break

      case 'CORRUPTION_REDUCED':
        store.environment.globalCorruption = Math.max(0, store.environment.globalCorruption - payload.amount)
        break
      case 'CORRUPTION_CLEARED':
        store.environment.globalCorruption = 0
        store.environment.corruptionZones = []
        break

      case 'POWER_RESTORED':
        store.setPowerState('online')
        break
      case 'POWER_CUT':
        store.setPowerState('offline')
        break

      case 'QUEUE_PROCESSED':
        store.reducePressure(payload.count * 5)
        break
      case 'STREAM_ACKED':
        store.reducePressure(2)
        break

      case 'CACHE_LOCK_ACQUIRED':
        store.addPressure(-10)
        break
      case 'CACHE_LOCK_RELEASED':
        store.addPressure(5)
        break

      case 'RATELIMIT_CHECK':
        break

      case 'MEMORY_UNLINKED':
        store.addPressure(-15)
        break
      case 'MEMORY_POLICY_SET':
        store.addPressure(-20)
        break

      case 'CLUSTER_FAILOVER_INITIATED':
        store.setMission({ ...store.mission, pressure: Math.max(0, store.mission.pressure - 30) })
        break
      case 'CLUSTER_INFO_REQUESTED':
        break
    }
  })

  return unsubscribe
}

// Initialize on module load (called from Mode3DApp)
let dispatcherUnsub = null
export function initConsequenceBridge() {
  if (dispatcherUnsub) return
  register3DConsequences()
  dispatcherUnsub = setup3DConsequenceDispatcher()
}

export function destroyConsequenceBridge() {
  if (dispatcherUnsub) {
    dispatcherUnsub()
    dispatcherUnsub = null
  }
}