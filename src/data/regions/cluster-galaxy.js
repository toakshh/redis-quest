export const clusterGalaxyRegion = {
  id: 'cluster-galaxy',
  name: 'Cluster Galaxy',
  description: 'A vast galaxy. Shards = star systems. Nodes = planets. Slots = orbital paths. CLUSTER MEET = establish hyperspace lane.',
  theme: 'galaxy',
  order: 13,
  unlocked: false,
  commands: [
    'CLUSTER MEET', 'CLUSTER ADDSLOTS', 'CLUSTER DELSLOTS', 'CLUSTER SETSLOT',
    'CLUSTER NODES', 'CLUSTER SLOTS', 'CLUSTER INFO', 'CLUSTER KEYSLOT',
    'CLUSTER COUNTKEYSINSLOT', 'CLUSTER GETKEYSINSLOT', 'CLUSTER FAILOVER',
    'CLUSTER REPLICATE', 'CLUSTER RESET', 'CLUSTER SAVECONFIG',
    'ASKING', 'READONLY', 'READWRITE',
  ],
  visualMetaphor: {
    constellations: 'Hash slots (16384)',
    ships: 'Commands routing',
    moved: 'Wormhole redirect',
    asking: 'Temporary pass',
    failover: 'Star going supernova, replica igniting',
  },
  boss: {
    id: 'cluster-architect',
    name: 'The Cluster Architect',
    title: 'WEAVER OF CONSTELLATIONS',
    maxHealth: 180,
    challenges: [
      {
        key: 'cluster:meet',
        task: 'Meet a new node at 127.0.0.1:6380.',
        hint: 'CLUSTER MEET 127.0.0.1 6380',
        damage: 25,
        xp: 30,
        check: (engine, entry) => {
          const nodes = engine.commandRegistry.get('CLUSTER')?.fn?.(engine, ['CLUSTER', 'NODES'])
          return nodes && nodes.value && nodes.value.includes('127.0.0.1:6380')
        },
      },
      {
        key: 'cluster:addslots',
        task: 'Claim slots 0-5460 for this node.',
        hint: 'CLUSTER ADDSLOTS 0 1 2 ... 5460',
        damage: 30,
        xp: 35,
        check: (engine, entry) => {
          const info = engine.commandRegistry.get('CLUSTER')?.fn?.(engine, ['CLUSTER', 'INFO'])
          return info && info.value && info.value.includes('cluster_slots_assigned:5461')
        },
      },
      {
        key: 'cluster:keyslot',
        task: 'Find the slot for key `user:1000` and verify it routes correctly.',
        hint: 'CLUSTER KEYSLOT user:1000',
        damage: 20,
        xp: 25,
        check: (engine, entry) => {
          const slot = engine.commandRegistry.get('CLUSTER')?.fn?.(engine, ['CLUSTER', 'KEYSLOT', 'user:1000'])
          return slot && typeof slot.value === 'number' && slot.value >= 0 && slot.value < 16384
        },
      },
      {
        key: 'cluster:failover',
        task: 'Trigger a manual failover on a replica node.',
        hint: 'CLUSTER FAILOVER',
        damage: 35,
        xp: 45,
        check: (engine, entry) => {
          const nodes = engine.commandRegistry.get('CLUSTER')?.fn?.(engine, ['CLUSTER', 'NODES'])
          return nodes && nodes.value && nodes.value.includes('master')
        },
      },
      {
        key: 'cluster:reshard',
        task: 'Migrate slot 5000 to another node using SETSLOT IMPORTING/MIGRATING/NODE.',
        hint: 'CLUSTER SETSLOT 5000 IMPORTING node-id  then  CLUSTER SETSLOT 5000 MIGRATING node-id  then  CLUSTER SETSLOT 5000 NODE node-id',
        damage: 35,
        xp: 45,
        check: (engine, entry) => {
          const slots = engine.commandRegistry.get('CLUSTER')?.fn?.(engine, ['CLUSTER', 'SLOTS'])
          return slots && slots.value && slots.value.length > 0
        },
      },
      {
        key: 'cluster:redirect',
        task: 'Handle a MOVED redirect by following it, and an ASK redirect with ASKING.',
        hint: 'CLUSTER NODES to see topology, then use ASKING before retry',
        damage: 35,
        xp: 40,
        check: (engine, entry) => true, // Mock
      },
    ],
  },
  rexDialogue: [
    { trigger: 'enter', text: 'Behold the Cluster Galaxy — 16,384 stars, each a hash slot. Nodes orbit in gossip protocol harmony.' },
    { trigger: 'first-meet', text: 'CLUSTER MEET opens a hyperspace lane. Nodes exchange gossip, share the map.' },
    { trigger: 'slots-assigned', text: 'ADDSLOTS claims territory. A master without slots is a star without light.' },
    { trigger: 'keyslot', text: 'KEYSLOT reveals the orbital path. CRC16(key) mod 16384 — the math that binds.' },
    { trigger: 'moved-redirect', text: 'MOVED is a wormhole — the key lives elsewhere. Follow the coordinates.' },
    { trigger: 'asking', text: 'ASKING is a temporary pass. The slot is migrating; the old master grants entry.' },
    { trigger: 'failover', text: 'A star goes supernova. The replica ignites. FAILOVER — manual or automatic — ensures continuity.' },
    { trigger: 'boss-start', text: 'The Cluster Architect watches. Partition the galaxy. Rebalance the stars. Survive the chaos.' },
    { trigger: 'boss-win', text: 'The constellations align. You are the Architect now. The galaxy bows to your design.' },
  ],
  achievements: [
    { id: 'cluster-meet', name: 'Hyperspace Lane', desc: 'Connect two cluster nodes with CLUSTER MEET.', icon: '🌌', xp: 20 },
    { id: 'cluster-addslots', name: 'Territory Claim', desc: 'Assign hash slots to a node.', icon: '⭐', xp: 25 },
    { id: 'cluster-keyslot', name: 'Orbital Calculator', desc: 'Calculate the slot for a key.', icon: '🧮', xp: 15 },
    { id: 'cluster-failover', name: 'Supernova', desc: 'Trigger a manual failover.', icon: '💥', xp: 30 },
    { id: 'cluster-reshard', name: 'Star Mover', desc: 'Migrate slots between nodes.', icon: '🔄', xp: 35 },
    { id: 'cluster-redirect', name: 'Wormhole Navigator', desc: 'Handle MOVED and ASK redirects.', icon: '🕳️', xp: 25 },
    { id: 'cluster-architect', name: 'Architect of Stars', desc: 'Defeat the Cluster Architect.', icon: '🏗️', xp: 70 },
  ],
  encyclopedia: {
    title: 'Cluster Galaxy — Redis Cluster',
    sections: [
      { title: 'Hash Slots (16384)', content: 'Redis Cluster divides the keyspace into 16384 hash slots. Each key maps to a slot via CRC16(key) % 16384. Slots are distributed among master nodes.' },
      { title: 'Gossip Protocol', content: 'Nodes communicate via gossip protocol on the cluster bus (port + 10000). They exchange PING/PONG messages to detect failures and propagate cluster state.' },
      { title: 'Replication', content: 'Each master can have replicas. Use CLUSTER REPLICATE to make a node replicate a master. Replicas provide read scalability (READONLY) and automatic failover.' },
      { title: 'Automatic Failover', content: 'When a master fails, replicas vote to promote one. Requires majority of masters. Configure with cluster-node-timeout and replica-validity-factor.' },
      { title: 'Resharding', content: 'Move slots between nodes with CLUSTER SETSLOT IMPORTING/MIGRATING/NODE. Redis handles key migration internally. Use CLUSTER ADDSLOTS/DELSLOTS for initial assignment.' },
      { title: 'Client-Side Routing', content: 'Clients cache the slot map. On MOVED redirect, update cache and retry. On ASK redirect, send ASKING then retry once. This avoids proxy overhead.' },
    ],
  },
}