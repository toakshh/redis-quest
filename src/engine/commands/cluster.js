import { cmd } from '../registry.js'
import {
  okReply,
  simpleReply,
  bulkReply,
  nilReply,
  integerReply,
  arrayReply,
  errorReply,
  syntaxError,
  intValue,
} from '../reply.js'

// Mock cluster state
let clusterNodes = new Map()
let clusterSlots = new Array(16384).fill(null) // slot -> nodeId
let clusterConfigEpoch = 0
let clusterMyId = generateNodeId()
let clusterKnownNodes = new Map()
let clusterFailoverState = 'none'
let clusterSlotsImporting = new Map() // slot -> { from, to }
let clusterSlotsMigrating = new Map() // slot -> { from, to }

export function resetCluster() {
  clusterNodes.clear()
  clusterSlots.fill(null)
  clusterConfigEpoch = 0
  clusterMyId = generateNodeId()
  clusterKnownNodes.clear()
  clusterFailoverState = 'none'
  clusterSlotsImporting.clear()
  clusterSlotsMigrating.clear()
  // Add self as a node
  addNode(clusterMyId, '127.0.0.1', 6379, 'master', [])
}

export function generateNodeId() {
  return Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
}

export function addNode(id, ip, port, role, slots) {
  clusterNodes.set(id, {
    id,
    ip,
    port,
    role,
    slots: slots || [],
    linked: false,
    pingSent: 0,
    pongRecv: 0,
    configEpoch: 0,
    flags: role === 'master' ? ['master'] : ['slave'],
  })
  clusterKnownNodes.set(id, { id, ip, port })
  for (const slot of slots) {
    if (slot >= 0 && slot < 16384) clusterSlots[slot] = id
  }
}

export function getNode(id) {
  return clusterNodes.get(id)
}

export function getAllNodes() {
  return Array.from(clusterNodes.values())
}

export function getMyNode() {
  return clusterNodes.get(clusterMyId)
}

export function getSlotNode(slot) {
  const nodeId = clusterSlots[slot]
  return nodeId ? clusterNodes.get(nodeId) : null
}

export function getKeyslot(key) {
  // Redis Cluster key hash slot algorithm
  const hash = crc16(key)
  return hash % 16384
}

function crc16(str) {
  // Simplified CRC16 for demo
  let crc = 0
  for (let i = 0; i < str.length; i++) {
    crc = (crc << 8) ^ (str.charCodeAt(i) << 8)
    crc = ((crc & 0xFFFF) ^ (crc >> 8)) & 0xFFFF
  }
  return crc
}

export const CLUSTER = cmd({
  arity: -2,
  syntax: 'CLUSTER SUBCOMMAND [args...]',
  summary: 'Manage Redis Cluster.',
  group: 'cluster',
  examples: [
    'CLUSTER MEET 127.0.0.1 6379',
    'CLUSTER ADDSLOTS 0 1 2 3',
    'CLUSTER DELSLOTS 0 1 2 3',
    'CLUSTER SETSLOT 5 IMPORTING node-id',
    'CLUSTER SETSLOT 5 MIGRATING node-id',
    'CLUSTER SETSLOT 5 NODE node-id',
    'CLUSTER SETSLOT 5 STABLE',
    'CLUSTER NODES',
    'CLUSTER SLOTS',
    'CLUSTER INFO',
    'CLUSTER KEYSLOT mykey',
    'CLUSTER COUNTKEYSINSLOT 5',
    'CLUSTER GETKEYSINSLOT 5 10',
    'CLUSTER FAILOVER',
    'CLUSTER REPLICATE node-id',
    'CLUSTER RESET',
    'CLUSTER SAVECONFIG',
  ],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()

  if (sub === 'MEET') {
    const ip = args[2]
    const port = intValue(args[3])
    if (!ip || port === null) return errorReply("ERR wrong number of arguments for 'meet' command")

    const nodeId = generateNodeId()
    addNode(nodeId, ip, port, 'master', [])
    clusterNodes.get(nodeId).linked = true
    return okReply()
  }

  if (sub === 'ADDSLOTS') {
    const slots = args.slice(2).map(s => intValue(s)).filter(s => s !== null)
    if (slots.length === 0) return errorReply("ERR wrong number of arguments for 'addslots' command")
    for (const slot of slots) {
      if (slot < 0 || slot >= 16384) return errorReply('ERR invalid slot')
      if (clusterSlots[slot] !== null) return errorReply(`ERR slot ${slot} is already assigned`)
      clusterSlots[slot] = clusterMyId
      const myNode = clusterNodes.get(clusterMyId)
      if (myNode && !myNode.slots.includes(slot)) myNode.slots.push(slot)
    }
    return okReply()
  }

  if (sub === 'DELSLOTS') {
    const slots = args.slice(2).map(s => intValue(s)).filter(s => s !== null)
    if (slots.length === 0) return errorReply("ERR wrong number of arguments for 'delslots' command")
    for (const slot of slots) {
      if (slot < 0 || slot >= 16384) return errorReply('ERR invalid slot')
      if (clusterSlots[slot] !== clusterMyId) return errorReply(`ERR slot ${slot} is not assigned to this node`)
      clusterSlots[slot] = null
      const myNode = clusterNodes.get(clusterMyId)
      if (myNode) myNode.slots = myNode.slots.filter(s => s !== slot)
    }
    return okReply()
  }

  if (sub === 'SETSLOT') {
    const slot = intValue(args[2])
    const action = String(args[3] || '').toUpperCase()
    if (slot === null || slot < 0 || slot >= 16384) return errorReply('ERR invalid slot')

    if (action === 'IMPORTING') {
      const fromNodeId = args[4]
      if (!fromNodeId) return errorReply("ERR wrong number of arguments for 'setslot importing' command")
      clusterSlotsImporting.set(slot, { from: fromNodeId, to: clusterMyId })
      return okReply()
    }

    if (action === 'MIGRATING') {
      const toNodeId = args[4]
      if (!toNodeId) return errorReply("ERR wrong number of arguments for 'setslot migrating' command")
      clusterSlotsMigrating.set(slot, { from: clusterMyId, to: toNodeId })
      return okReply()
    }

    if (action === 'NODE') {
      const nodeId = args[4]
      if (!nodeId) return errorReply("ERR wrong number of arguments for 'setslot node' command")
      clusterSlotsImporting.delete(slot)
      clusterSlotsMigrating.delete(slot)
      clusterSlots[slot] = nodeId
      const node = clusterNodes.get(nodeId)
      if (node && !node.slots.includes(slot)) node.slots.push(slot)
      const myNode = clusterNodes.get(clusterMyId)
      if (myNode) myNode.slots = myNode.slots.filter(s => s !== slot)
      return okReply()
    }

    if (action === 'STABLE') {
      clusterSlotsImporting.delete(slot)
      clusterSlotsMigrating.delete(slot)
      return okReply()
    }

    return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${action}'`)
  }

  if (sub === 'NODES') {
    let output = ''
    for (const node of clusterNodes.values()) {
      const flags = node.flags.join(',')
      const slots = node.slots.length > 0 ? node.slots.map((s, i, arr) => {
        if (i === 0 || s !== arr[i - 1] + 1) return String(s)
        if (i === arr.length - 1 || s !== arr[i + 1] - 1) return `-${s}`
        return null
      }).filter(Boolean).join(' ') : '-'
      output += `${node.id} ${node.ip}:${node.port} ${flags} ${node.configEpoch} ${node.pingSent} ${node.pongRecv} ${node.linked ? 'connected' : 'handshake'} ${slots}\n`
    }
    return bulkReply(output.trim())
  }

  if (sub === 'SLOTS') {
    const ranges = []
    let start = -1
    let currentNodeId = null

    for (let i = 0; i <= 16384; i++) {
      const nodeId = i < 16384 ? clusterSlots[i] : null
      if (nodeId !== currentNodeId) {
        if (start !== -1) {
          const node = clusterNodes.get(currentNodeId)
          ranges.push([
            integerReply(start),
            integerReply(i - 1),
            arrayReply([
              bulkReply(node?.ip || '127.0.0.1'),
              integerReply(node?.port || 6379),
              bulkReply(node?.id || 'unknown'),
            ]),
          ])
        }
        start = i < 16384 ? i : -1
        currentNodeId = nodeId
      }
    }
    return arrayReply(ranges.map(r => arrayReply(r)))
  }

  if (sub === 'INFO') {
    const myNode = clusterNodes.get(clusterMyId)
    const knownNodes = clusterNodes.size
    const masterCount = Array.from(clusterNodes.values()).filter(n => n.flags.includes('master')).length
    const slotsAssigned = clusterSlots.filter(s => s !== null).length
    const slotsOk = slotsAssigned === 16384 ? 'ok' : 'fail'

    const lines = [
      `cluster_state:${slotsOk}`,
      `cluster_slots_assigned:${slotsAssigned}`,
      `cluster_slots_ok:${slotsOk === 'ok' ? 16384 : slotsAssigned}`,
      `cluster_slots_pfail:0`,
      `cluster_slots_fail:0`,
      `cluster_known_nodes:${knownNodes}`,
      `cluster_size:${masterCount}`,
      `cluster_current_epoch:${clusterConfigEpoch}`,
      `cluster_my_epoch:${myNode?.configEpoch || 0}`,
      `cluster_stats_messages_ping_sent:${myNode?.pingSent || 0}`,
      `cluster_stats_messages_pong_sent:0`,
      `cluster_stats_messages_meet_sent:0`,
      `cluster_stats_messages_sent:0`,
      `cluster_stats_messages_ping_received:0`,
      `cluster_stats_messages_pong_received:${myNode?.pongRecv || 0}`,
      `cluster_stats_messages_meet_received:0`,
      `cluster_stats_messages_received:0`,
    ]
    return bulkReply(lines.join('\r\n'))
  }

  if (sub === 'KEYSLOT') {
    const key = args[2]
    if (!key) return errorReply("ERR wrong number of arguments for 'keyslot' command")
    const slot = getKeyslot(key)
    return integerReply(slot)
  }

  if (sub === 'COUNTKEYSINSLOT') {
    const slot = intValue(args[2])
    if (slot === null) return errorReply("ERR wrong number of arguments for 'countkeysinslot' command")
    // In mock, return 0
    return integerReply(0)
  }

  if (sub === 'GETKEYSINSLOT') {
    const slot = intValue(args[2])
    const count = intValue(args[3])
    if (slot === null || count === null) return errorReply("ERR wrong number of arguments for 'getkeysinslot' command")
    return arrayReply([])
  }

  if (sub === 'FAILOVER') {
    const force = args[2] && String(args[2]).toUpperCase() === 'FORCE'
    const takeover = args[2] && String(args[2]).toUpperCase() === 'TAKEOVER'
    const myNode = clusterNodes.get(clusterMyId)

    if (!myNode || myNode.flags.includes('master')) {
      return errorReply('ERR Cannot failover from master node')
    }

    if (force) clusterFailoverState = 'force'
    else if (takeover) clusterFailoverState = 'takeover'
    else clusterFailoverState = 'manual'

    // Simulate failover - this node becomes master
    myNode.flags = ['master']
    myNode.role = 'master'
    return okReply()
  }

  if (sub === 'REPLICATE') {
    const nodeId = args[2]
    if (!nodeId) return errorReply("ERR wrong number of arguments for 'replicate' command")
    const myNode = clusterNodes.get(clusterMyId)
    if (!myNode) return errorReply('ERR Not in cluster')

    const targetNode = clusterNodes.get(nodeId)
    if (!targetNode) return errorReply('ERR Unknown node')

    myNode.flags = ['slave']
    myNode.role = 'slave'
    myNode.slots = []
    return okReply()
  }

  if (sub === 'RESET') {
    const type = args[2] ? String(args[2]).toUpperCase() : 'SOFT'
    if (type === 'HARD') {
      clusterMyId = generateNodeId()
      clusterNodes.clear()
      clusterSlots.fill(null)
      clusterConfigEpoch = 0
      clusterKnownNodes.clear()
      addNode(clusterMyId, '127.0.0.1', 6379, 'master', [])
    } else {
      // Soft reset - just clear slots and known nodes except self
      clusterSlots.fill(null)
      clusterNodes.clear()
      clusterKnownNodes.clear()
      clusterConfigEpoch = 0
      addNode(clusterMyId, '127.0.0.1', 6379, 'master', [])
    }
    return okReply()
  }

  if (sub === 'SAVECONFIG') {
    return okReply()
  }

  if (sub === 'HELP') {
    const help = [
      'MEET ip port -- Connect to another cluster node',
      'ADDSLOTS slot [slot ...] -- Assign slots to this node',
      'DELSLOTS slot [slot ...] -- Remove slot assignments from this node',
      'SETSLOT slot IMPORTING|MIGRATING|NODE|STABLE [node-id] -- Set slot state',
      'NODES -- List all cluster nodes',
      'SLOTS -- List slot ranges and their owners',
      'INFO -- Show cluster info',
      'KEYSLOT key -- Calculate slot for a key',
      'COUNTKEYSINSLOT slot -- Count keys in a slot',
      'GETKEYSINSLOT slot count -- Get keys in a slot',
      'FAILOVER [FORCE|TAKEOVER] -- Trigger manual failover',
      'REPLICATE node-id -- Replicate a master node',
      'RESET [HARD|SOFT] -- Reset cluster state',
      'SAVECONFIG -- Save cluster config to disk',
    ]
    return arrayReply(help.map(bulkReply))
  }

  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try CLUSTER HELP.`)
})

export const ASKING = cmd({
  arity: 1,
  syntax: 'ASKING',
  summary: 'Allow the next command to be executed on a node that is importing a slot.',
  group: 'cluster',
  examples: ['ASKING'],
})((engine) => {
  // In real Redis, this sets a flag on the connection to allow next command on importing slot
  // Mock: just return OK
  return okReply()
})

export const READONLY = cmd({
  arity: 1,
  syntax: 'READONLY',
  summary: 'Allow read queries to replica nodes in cluster.',
  group: 'cluster',
  examples: ['READONLY'],
})((engine) => {
  return okReply()
})

export const READWRITE = cmd({
  arity: 1,
  syntax: 'READWRITE',
  summary: 'Disallow read queries to replica nodes (default).',
  group: 'cluster',
  examples: ['READWRITE'],
})((engine) => {
  return okReply()
})