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
import { EVICTION_POLICIES } from '../eviction.js'

// Debug commands
export const DEBUG = cmd({
  arity: -2,
  syntax: 'DEBUG SUBCOMMAND [args...]',
  summary: 'Debug commands for testing and development.',
  group: 'server',
  examples: ['DEBUG SLEEP 1', 'DEBUG SEGFAULT', 'DEBUG RELOAD', 'DEBUG AUDIT'],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()

  if (sub === 'SLEEP') {
    const seconds = intValue(args[2])
    if (seconds === null || seconds < 0) return errorReply('ERR invalid sleep time')
    // In real Redis this blocks, here we just return OK immediately
    return simpleReply(`Slept for ${seconds} seconds (mock)`)
  }

  if (sub === 'SEGFAULT') {
    return errorReply('ERR DEBUG SEGFAULT disabled in redis-quest')
  }

  if (sub === 'RELOAD') {
    return okReply()
  }

  if (sub === 'AUDIT') {
    return arrayReply([
      bulkReply('memory'),
      bulkReply('keyspace'),
      bulkReply('clients'),
    ])
  }

  if (sub === 'HTSTATS') {
    const key = args[2]
    if (!key) return errorReply("ERR wrong number of arguments for 'htstats' command")
    return arrayReply([
      bulkReply('bucket_count'), integerReply(16),
      bulkReply('used_buckets'), integerReply(5),
      bulkReply('max_chain'), integerReply(3),
      bulkReply('total_elements'), integerReply(12),
    ])
  }

  if (sub === 'HTSTATS-KEY') {
    return arrayReply([
      bulkReply('chain_length'), integerReply(2),
      bulkReply('position'), integerReply(1),
    ])
  }

  if (sub === 'SDSLEN') {
    const key = args[2]
    if (!key) return errorReply("ERR wrong number of arguments for 'sdslen' command")
    return integerReply(key.length)
  }

  if (sub === 'DIGEST') {
    return bulkReply('0000000000000000000000000000000000000000')
  }

  if (sub === 'COMMAND') {
    const name = args[2]
    if (!name) return errorReply("ERR wrong number of arguments for 'command' command")
    return arrayReply([bulkReply(name), integerReply(1), arrayReply([bulkReply('write')]), integerReply(1), integerReply(1), integerReply(1)])
  }

  if (sub === 'HELP') {
    const help = [
      'SLEEP seconds -- Sleep for specified seconds (mock)',
      'SEGFAULT -- Crash the server (disabled)',
      'RELOAD -- Reload configuration (mock)',
      'AUDIT -- Show audit information',
      'HTSTATS key -- Hash table stats',
      'HTSTATS-KEY key -- Hash table stats for key',
      'SDSLEN key -- SDS string length',
      'DIGEST -- Show server digest',
      'COMMAND name -- Show command info',
    ]
    return arrayReply(help.map(bulkReply))
  }

  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try DEBUG HELP.`)
})

// MONITOR command - streams all commands
export const MONITOR = cmd({
  arity: 1,
  syntax: 'MONITOR',
  summary: 'Listen to all requests received by the server in real time.',
  group: 'server',
  examples: ['MONITOR'],
})((engine) => {
  // In real Redis this enters a streaming mode
  // Here we return a message indicating it would start monitoring
  engine.emit('monitor', { message: 'MONITOR started (mock)' })
  return simpleReply('OK - MONITOR started (mock). In real Redis this streams all commands.')
})

// SLOWLOG command
let slowlog = []
let slowlogId = 0
const SLOWLOG_MAX_LEN = 128

export function addSlowlog(command, durationMicros, clientId = 'mock') {
  if (slowlog.length >= SLOWLOG_MAX_LEN) slowlog.shift()
  slowlog.unshift({
    id: slowlogId++,
    timestamp: Math.floor(Date.now() / 1000),
    duration: durationMicros,
    command,
    clientId,
  })
}

export const SLOWLOG = cmd({
  arity: -1,
  syntax: 'SLOWLOG SUBCOMMAND [arg]',
  summary: 'Manage the slow queries log.',
  group: 'server',
  examples: ['SLOWLOG GET', 'SLOWLOG GET 10', 'SLOWLOG LEN', 'SLOWLOG RESET'],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()

  if (sub === 'GET') {
    const count = args[2] ? intValue(args[2]) : slowlog.length
    const entries = slowlog.slice(0, count)
    return arrayReply(entries.map(e => arrayReply([
      integerReply(e.id),
      integerReply(e.timestamp),
      integerReply(e.duration),
      arrayReply(e.command.map(bulkReply)),
      bulkReply(e.clientId),
    ])))
  }

  if (sub === 'LEN') {
    return integerReply(slowlog.length)
  }

  if (sub === 'RESET') {
    slowlog = []
    return okReply()
  }

  if (sub === 'HELP') {
    const help = [
      'GET [count] -- Get slowlog entries (default: all)',
      'LEN -- Get slowlog length',
      'RESET -- Reset slowlog',
    ]
    return arrayReply(help.map(bulkReply))
  }

  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try SLOWLOG HELP.`)
})

// LATENCY command
let latencyEvents = new Map() // eventName -> { samples: [{ts, latency}], max, allTimeMax }

export function addLatencyEvent(eventName, latencyMicros) {
  const now = Date.now()
  if (!latencyEvents.has(eventName)) {
    latencyEvents.set(eventName, { samples: [], max: 0, allTimeMax: 0 })
  }
  const event = latencyEvents.get(eventName)
  event.samples.push({ ts: now, latency: latencyMicros })
  if (event.samples.length > 160) event.samples.shift() // Keep last 160
  event.max = Math.max(event.max, latencyMicros)
  event.allTimeMax = Math.max(event.allTimeMax, latencyMicros)
}

export function resetLatencyEvents() {
  latencyEvents.clear()
}

export const LATENCY = cmd({
  arity: -2,
  syntax: 'LATENCY SUBCOMMAND [args...]',
  summary: 'Latency monitoring and analysis.',
  group: 'server',
  examples: ['LATENCY LATEST', 'LATENCY HISTORY command', 'LATENCY RESET', 'LATENCY DOCTOR', 'LATENCY GRAPH command'],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()

  if (sub === 'LATEST') {
    const entries = []
    for (const [name, data] of latencyEvents) {
      if (data.samples.length > 0) {
        const latest = data.samples[data.samples.length - 1]
        entries.push(arrayReply([
          bulkReply(name),
          integerReply(latest.ts),
          integerReply(latest.latency),
          integerReply(data.allTimeMax),
        ]))
      }
    }
    return arrayReply(entries)
  }

  if (sub === 'HISTORY') {
    const eventName = args[2]
    if (!eventName) return errorReply("ERR wrong number of arguments for 'history' command")
    const data = latencyEvents.get(eventName)
    if (!data) return arrayReply([])
    return arrayReply(data.samples.map(s => arrayReply([
      integerReply(s.ts),
      integerReply(s.latency),
    ])))
  }

  if (sub === 'RESET') {
    const eventName = args[2]
    if (eventName) {
      latencyEvents.delete(eventName)
    } else {
      latencyEvents.clear()
    }
    return okReply()
  }

  if (sub === 'DOCTOR') {
    // Generate a latency diagnosis report
    const report = []
    report.push('# Latency Doctor Report')
    report.push('')
    report.push('## System Information')
    report.push(`- Redis version: 7.2.0 (mock)`)
    report.push(`- OS: redis-quest`)
    report.push(`- Uptime: ${Math.floor((engine.now() - engine.stats.startedAt) / 1000)} seconds`)
    report.push('')
    report.push('## Latency Events')

    let hasEvents = false
    for (const [name, data] of latencyEvents) {
      if (data.samples.length > 0) {
        hasEvents = true
        const avg = data.samples.reduce((sum, s) => sum + s.latency, 0) / data.samples.length
        report.push(`### ${name}`)
        report.push(`- Samples: ${data.samples.length}`)
        report.push(`- Average: ${avg.toFixed(2)} µs`)
        report.push(`- Max (recent): ${data.max} µs`)
        report.push(`- All-time max: ${data.allTimeMax} µs`)

        if (data.allTimeMax > 10000) {
          report.push(`- ⚠️ HIGH LATENCY: Consider investigating ${name}`)
        }
        report.push('')
      }
    }

    if (!hasEvents) {
      report.push('No latency events recorded. Run some commands to generate data.')
      report.push('')
    }

    report.push('## Recommendations')
    report.push('1. Use pipelining for batch operations')
    report.push('2. Avoid KEYS in production, use SCAN')
    report.push('3. Monitor slowlog for expensive commands')
    report.push('4. Check memory pressure with MEMORY DOCTOR')

    return bulkReply(report.join('\n'))
  }

  if (sub === 'GRAPH') {
    const eventName = args[2]
    if (!eventName) return errorReply("ERR wrong number of arguments for 'graph' command")
    const data = latencyEvents.get(eventName)
    if (!data || data.samples.length === 0) return bulkReply('No data for graph')

    // Simple ASCII graph
    const samples = data.samples.slice(-20) // Last 20 samples
    const maxLatency = Math.max(...samples.map(s => s.latency), 1)
    const rows = []
    for (let level = 10; level >= 0; level--) {
      const threshold = (maxLatency * level) / 10
      let row = ''
      for (const s of samples) {
        row += s.latency >= threshold ? '█' : ' '
      }
      rows.push(row)
    }
    return bulkReply(rows.join('\n'))
  }

  if (sub === 'HELP') {
    const help = [
      'LATEST -- Show latest latency sample for each event',
      'HISTORY event -- Show latency history for an event',
      'RESET [event] -- Reset latency data',
      'DOCTOR -- Run latency diagnosis',
      'GRAPH event -- Show ASCII latency graph',
    ]
    return arrayReply(help.map(bulkReply))
  }

  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try LATENCY HELP.`)
})

// MEMORY command
export const MEMORY = cmd({
  arity: -2,
  syntax: 'MEMORY SUBCOMMAND [args...]',
  summary: 'Memory introspection and analysis.',
  group: 'server',
  examples: ['MEMORY USAGE key', 'MEMORY STATS', 'MEMORY PURGE', 'MEMORY MALLOC-STATS', 'MEMORY DOCTOR'],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()

  if (sub === 'USAGE') {
    const key = args[2]
    if (!key) return errorReply("ERR wrong number of arguments for 'usage' command")
    const entry = engine._get(key)
    if (!entry) return nilReply()
    // Return approximate memory usage
    let size = 100 // base overhead
    if (entry.type === 'string') size += String(entry.value).length
    else if (entry.type === 'hash') size += entry.value.size * 50
    else if (entry.type === 'list') size += entry.value.length * 50
    else if (entry.type === 'set') size += entry.value.size * 50
    else if (entry.type === 'zset') size += entry.value.length * 60
    return integerReply(size)
  }

  if (sub === 'STATS') {
    const used = engine.memoryBytes
    const peak = engine.stats.memoryPeak
    const limit = engine.memoryLimit
    const fragmentation = 1.0
    return arrayReply([
      bulkReply('peak.allocated'), integerReply(peak),
      bulkReply('total.allocated'), integerReply(used),
      bulkReply('startup.allocated'), integerReply(used),
      bulkReply('replication.backlog'), integerReply(0),
      bulkReply('clients.slaves'), integerReply(0),
      bulkReply('clients.normal'), integerReply(100),
      bulkReply('aof.buffer'), integerReply(0),
      bulkReply('lua.engine'), integerReply(0),
      bulkReply('total.frag'), integerReply(Math.round(used * fragmentation)),
      bulkReply('total.frag.bytes'), integerReply(Math.round(used * (fragmentation - 1))),
    ])
  }

  if (sub === 'PURGE') {
    // In real Redis this tries to release memory to OS
    engine._cache.dirty = true
    return integerReply(0) // bytes released
  }

  if (sub === 'MALLOC-STATS') {
    return bulkReply(`jemalloc stats (mock):
  Allocated: ${engine.memoryBytes} bytes
  Active: ${engine.memoryBytes} bytes
  Metadata: 0 bytes
  Resident: ${engine.memoryBytes} bytes
  Mapped: ${engine.memoryLimit} bytes`)
  }

  if (sub === 'DOCTOR') {
    const used = engine.memoryBytes
    const limit = engine.memoryLimit
    const pct = ((used / limit) * 100).toFixed(1)

    const report = []
    report.push('# Memory Doctor Report')
    report.push('')
    report.push('## Memory Usage')
    report.push(`- Used: ${formatBytes(used)} (${pct}% of limit)`)
    report.push(`- Peak: ${formatBytes(engine.stats.memoryPeak)}`)
    report.push(`- Limit: ${formatBytes(limit)}`)
    report.push(`- Fragmentation: 1.00`)
    report.push('')

    if (used / limit > 0.9) {
      report.push('⚠️ CRITICAL: Memory usage above 90%!')
      report.push('  - Consider increasing maxmemory')
      report.push('  - Review eviction policy (CONFIG SET maxmemory-policy)')
      report.push('  - Check for memory leaks with MEMORY STATS')
    } else if (used / limit > 0.75) {
      report.push('⚠️ WARNING: Memory usage above 75%')
      report.push('  - Monitor closely')
      report.push('  - Plan for scaling')
    } else {
      report.push('✅ Memory usage is healthy')
    }
    report.push('')
    report.push('## Recommendations')
    report.push('1. Use appropriate eviction policy for your use case')
    report.push('2. Monitor MEMORY STATS regularly')
    report.push('3. Use pipelining to reduce per-command overhead')
    report.push('4. Consider Redis Cluster for horizontal scaling')

    return bulkReply(report.join('\n'))
  }

  if (sub === 'HELP') {
    const help = [
      'USAGE key -- Estimate memory usage of a key',
      'STATS -- Show memory statistics',
      'PURGE -- Try to release memory to OS',
      'MALLOC-STATS -- Show allocator statistics',
      'DOCTOR -- Run memory diagnosis',
    ]
    return arrayReply(help.map(bulkReply))
  }

  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try MEMORY HELP.`)
})

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`
}

// MODULE command
let modules = new Map()

export const MODULE = cmd({
  arity: -2,
  syntax: 'MODULE SUBCOMMAND [args...]',
  summary: 'Manage Redis modules.',
  group: 'server',
  examples: ['MODULE LIST', 'MODULE LOAD /path/to/module.so', 'MODULE UNLOAD name'],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()

  if (sub === 'LIST') {
    if (modules.size === 0) return arrayReply([])
    return arrayReply(Array.from(modules.values()).map(m => arrayReply([
      bulkReply('name'), bulkReply(m.name),
      bulkReply('ver'), integerReply(m.version),
      bulkReply('api'), bulkReply(m.api),
      bulkReply('filters'), integerReply(m.filters),
      bulkReply('usedby'), arrayReply(m.usedby.map(bulkReply)),
      bulkReply('options'), arrayReply(m.options.map(bulkReply)),
    ])))
  }

  if (sub === 'LOAD') {
    const path = args[2]
    if (!path) return errorReply("ERR wrong number of arguments for 'load' command")
    const name = path.split('/').pop().replace('.so', '')
    if (modules.has(name)) return errorReply('ERR Module already loaded')
    modules.set(name, { name, version: 1, api: '1.0', filters: 0, usedby: [], options: [] })
    return okReply()
  }

  if (sub === 'UNLOAD') {
    const name = args[2]
    if (!name) return errorReply("ERR wrong number of arguments for 'unload' command")
    if (!modules.has(name)) return errorReply('ERR Module not found')
    modules.delete(name)
    return okReply()
  }

  if (sub === 'HELP') {
    const help = [
      'LIST -- List loaded modules',
      'LOAD path -- Load a module',
      'UNLOAD name -- Unload a module',
    ]
    return arrayReply(help.map(bulkReply))
  }

  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try MODULE HELP.`)
})

// FUNCTION command
let functions = new Map()

export const FUNCTION = cmd({
  arity: -2,
  syntax: 'FUNCTION SUBCOMMAND [args...]',
  summary: 'Manage server-side functions (Redis 7+).',
  group: 'server',
  examples: ['FUNCTION LOAD "code"', 'FUNCTION LIST', 'FUNCTION DELETE libname', 'FUNCTION FLUSH'],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()

  if (sub === 'LOAD') {
    const code = args[2]
    if (!code) return errorReply("ERR wrong number of arguments for 'load' command")
    // Mock: extract library name from code
    const match = code.match(/#!\s*name=(\w+)/)
    const libName = match ? match[1] : `lib_${functions.size + 1}`
    functions.set(libName, { name: libName, code, engine: 'LUA' })
    return bulkReply(libName)
  }

  if (sub === 'LIST') {
    if (functions.size === 0) return arrayReply([])
    return arrayReply(Array.from(functions.values()).map(f => arrayReply([
      bulkReply('library_name'), bulkReply(f.name),
      bulkReply('engine'), bulkReply(f.engine),
      bulkReply('functions'), arrayReply([]), // Would list actual functions
    ])))
  }

  if (sub === 'DELETE') {
    const libName = args[2]
    if (!libName) return errorReply("ERR wrong number of arguments for 'delete' command")
    if (!functions.has(libName)) return errorReply('ERR Library not found')
    functions.delete(libName)
    return okReply()
  }

  if (sub === 'FLUSH') {
    functions.clear()
    return okReply()
  }

  if (sub === 'KILL') {
    return okReply()
  }

  if (sub === 'STATS') {
    return arrayReply([
      bulkReply('running_scripts'), integerReply(0),
      bulkReply('engines'), arrayReply([bulkReply('LUA')]),
    ])
  }

  if (sub === 'HELP') {
    const help = [
      'LOAD code -- Load a function library',
      'LIST -- List loaded libraries',
      'DELETE name -- Delete a library',
      'FLUSH -- Remove all libraries',
      'KILL -- Kill running script',
      'STATS -- Show function statistics',
    ]
    return arrayReply(help.map(bulkReply))
  }

  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try FUNCTION HELP.`)
})

// CONFIG command (extend existing)
export const CONFIG = cmd({
  arity: -2,
  syntax: 'CONFIG SUBCOMMAND [args...]',
  summary: 'Manage server configuration.',
  group: 'server',
  examples: ['CONFIG GET *', 'CONFIG SET maxmemory 100mb', 'CONFIG REWRITE', 'CONFIG RESETSTAT'],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()

  if (sub === 'GET') {
    const pattern = args[2] || '*'
    const configs = {
      'maxmemory': engine.memoryLimit,
      'maxmemory-policy': engine.maxmemoryPolicy,
      'save': '900 1 300 10 60 10000',
      'appendonly': 'no',
      'requirepass': '',
      'tls-port': '0',
      'port': '6379',
      'bind': '127.0.0.1',
      'timeout': '0',
      'tcp-keepalive': '300',
      'databases': '16',
      'lua-time-limit': '5000',
      'slowlog-log-slower-than': '10000',
      'slowlog-max-len': '128',
      'latency-monitor-threshold': '0',
      'cluster-enabled': 'no',
      'cluster-config-file': 'nodes.conf',
      'cluster-node-timeout': '15000',
      'replica-serve-stale-data': 'yes',
      'replica-read-only': 'yes',
      'repl-diskless-sync': 'no',
      'repl-diskless-sync-delay': '5',
      'repl-disable-tcp-nodelay': 'no',
      'replica-priority': '100',
      'min-replicas-to-write': '0',
      'min-replicas-max-lag': '10',
      'maxclients': '10000',
      'maxmemory-eviction-tenacity': '10',
      'active-expire-effort': '1',
    }

    const filtered = {}
    const regex = pattern.replace(/\*/g, '.*')
    for (const [k, v] of Object.entries(configs)) {
      if (k.match(regex)) filtered[k] = v
    }

    return arrayReply(Object.entries(filtered).map(([k, v]) => arrayReply([bulkReply(k), bulkReply(String(v))])))
  }

  if (sub === 'SET') {
    const key = args[2]
    const value = args[3]
    if (!key || value === undefined) return errorReply("ERR wrong number of arguments for 'set' command")

    if (key === 'maxmemory') {
      const bytes = parseMemory(value)
      if (bytes === null) return errorReply('ERR invalid maxmemory value')
      engine.memoryLimit = bytes
    } else if (key === 'maxmemory-policy') {
      if (!EVICTION_POLICIES.includes(value)) {
        return errorReply(`ERR Invalid argument '${value}' for CONFIG SET 'maxmemory-policy'`)
      }
      engine.maxmemoryPolicy = value
    }
    // Other settings would be applied here

    return okReply()
  }

  if (sub === 'REWRITE') {
    return okReply()
  }

  if (sub === 'RESETSTAT') {
    engine.stats.totalCommands = 0
    engine.stats.totalErrors = 0
    engine.stats.keysCreated = 0
    engine.stats.keysExpired = 0
    engine.stats.memoryPeak = engine.memoryBytes
    engine.stats.multiBatches = 0
    engine.stats.scriptsRun = 0
    engine.stats.commandsByType = {}
    engine.stats.opsPerSecond = 0
    engine.stats.commandsPerMinute = 0
    return okReply()
  }

  if (sub === 'HELP') {
    const help = [
      'GET pattern -- Get configuration parameters',
      'SET key value -- Set a configuration parameter',
      'REWRITE -- Rewrite config file',
      'RESETSTAT -- Reset statistics',
    ]
    return arrayReply(help.map(bulkReply))
  }

  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try CONFIG HELP.`)
})

function parseMemory(str) {
  const match = String(str).match(/^(\d+)([kmg]?)$/i)
  if (!match) return null
  const num = parseInt(match[1])
  const unit = match[2].toLowerCase()
  if (unit === 'k') return num * 1024
  if (unit === 'm') return num * 1024 * 1024
  if (unit === 'g') return num * 1024 * 1024 * 1024
  return num
}

// INFO command extensions for more sections
// Already in server.js, but we can note here that it should handle more sections