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
import { formatBytes } from '../datatypes/memory.js'

export const PING = cmd({
  arity: -1,
  syntax: 'PING [message]',
  summary: 'Ping the server. Returns PONG, or the message back as a bulk string.',
  group: 'server',
  examples: ['PING', 'PING "hello"'],
})((engine, args) => {
  if (args.length === 1) return simpleReply('PONG')
  return bulkReply(args[1])
})

export const ECHO = cmd({
  arity: 2,
  syntax: 'ECHO message',
  summary: 'Echo the given message back.',
  group: 'server',
  examples: ['ECHO "hello world"'],
})((engine, args) => bulkReply(args[1]))

export const SELECT = cmd({
  arity: 2,
  syntax: 'SELECT index',
  summary: 'Switch the active database (0-15 in this mock).',
  group: 'server',
  examples: ['SELECT 3'],
})((engine, args) => {
  const index = intValue(args[1])
  if (index === null) return errorReply('ERR value is not an integer or out of range')
  if (!engine.databases.has(index)) return errorReply('ERR DB index is out of range')
  engine.activeDb = index
  return okReply()
})

export const DBSIZE = cmd({
  arity: 1,
  syntax: 'DBSIZE',
  summary: 'Return the number of non-expired keys in the active database.',
  group: 'server',
  examples: ['DBSIZE'],
})((engine) => {
  let count = 0
  const now = engine.now()
  for (const entry of engine.store.values()) {
    if (entry.expiresAt === null || entry.expiresAt > now) count++
  }
  return integerReply(count)
})

export const FLUSHDB = cmd({
  arity: -1,
  syntax: 'FLUSHDB [ASYNC|SYNC]',
  summary: 'Delete all keys in the active database and invalidate pending WATCHes.',
  group: 'server',
  examples: ['FLUSHDB'],
})((engine, args) => {
  const opt = String(args[1] || '').toUpperCase()
  if (opt !== '' && opt !== 'ASYNC' && opt !== 'SYNC') return syntaxError()
  engine.store.clear()
  // a flush is a modification of every key, so abort any pending transaction
  for (const key of engine.watchedKeys.keys()) engine.watchedKeys.set(key, -1)
  engine._cache.dirty = true
  engine.emit('change')
  return okReply()
})

export const FLUSHALL = cmd({
  arity: -1,
  syntax: 'FLUSHALL [ASYNC|SYNC]',
  summary: 'Delete all keys in every database and invalidate pending WATCHes.',
  group: 'server',
  examples: ['FLUSHALL'],
})((engine, args) => {
  const opt = String(args[1] || '').toUpperCase()
  if (opt !== '' && opt !== 'ASYNC' && opt !== 'SYNC') return syntaxError()
  for (const db of engine.databases.values()) db.clear()
  for (const key of engine.watchedKeys.keys()) engine.watchedKeys.set(key, -1)
  engine._cache.dirty = true
  engine.emit('change')
  return okReply()
})

export const TIME = cmd({
  arity: 1,
  syntax: 'TIME',
  summary: 'Return the current server time as [unix seconds, microseconds].',
  group: 'server',
  examples: ['TIME'],
})((engine) => {
  const ms = engine.now()
  const seconds = Math.floor(ms / 1000)
  const microseconds = (ms % 1000) * 1000
  return arrayReply([bulkReply(String(seconds)), bulkReply(String(microseconds))])
})

export const INFO = cmd({
  arity: -1,
  syntax: 'INFO [section]',
  summary: 'Return server information and statistics in redis INFO format.',
  group: 'server',
  examples: ['INFO', 'INFO keyspace'],
})((engine, args) => {
  const section = String(args[1] || 'default').toLowerCase()
  const uptime = Math.max(1, Math.floor((engine.now() - engine.stats.startedAt) / 1000))
  const parts = []

  if (section === 'all' || section === 'default' || section === 'server') {
    parts.push(
      '# Server\r\n' +
        'redis_version:7.2.0\r\n' +
        'redis_mode:standalone\r\n' +
        'os:redis-quest\r\n' +
        'arch_bits:64\r\n' +
        'process_id:1\r\n' +
        `uptime_in_seconds:${uptime}\r\n`
    )
  }
  if (section === 'all' || section === 'default' || section === 'clients') {
    parts.push('# Clients\r\n' + 'connected_clients:1\r\n' + 'blocked_clients:0\r\n')
  }
  if (section === 'all' || section === 'default' || section === 'memory') {
    const used = engine.memoryBytes
    parts.push(
      '# Memory\r\n' +
        `used_memory:${used}\r\n` +
        `used_memory_human:${formatBytes(used)}\r\n` +
        `maxmemory:${engine.memoryLimit}\r\n` +
        `maxmemory_human:${formatBytes(engine.memoryLimit)}\r\n` +
        'mem_fragmentation_ratio:1.00\r\n'
    )
  }
  if (section === 'all' || section === 'default' || section === 'stats') {
    parts.push(
      '# Stats\r\n' +
        'total_connections_received:1\r\n' +
        `total_commands_processed:${engine.stats.totalCommands}\r\n` +
        `total_errors_received:${engine.stats.totalErrors}\r\n` +
        `instantaneous_ops_per_sec:${Math.round(engine.stats.opsPerSecond)}\r\n` +
        'keyspace_hits:0\r\n' +
        'keyspace_misses:0\r\n' +
        `used_memory_peak:${engine.stats.memoryPeak}\r\n`
    )
  }
  if (section === 'all' || section === 'default' || section === 'keyspace') {
    const lines = []
    const now = engine.now()
    for (const [index, db] of engine.databases) {
      let keys = 0
      let expires = 0
      for (const entry of db.values()) {
        if (entry.expiresAt === null || entry.expiresAt > now) {
          keys++
          if (entry.expiresAt !== null) expires++
        }
      }
      if (keys > 0) lines.push(`db${index}:keys=${keys},expires=${expires},avg_ttl=0`)
    }
    parts.push(`# Keyspace\r\n${lines.length > 0 ? lines.join('\r\n') + '\r\n' : ''}`)
  }

  return bulkReply(parts.join('\r\n'))
})

// ---- COMMAND introspection ------------------------------------------------

const READ_ONLY = new Set([
  'GET', 'MGET', 'STRLEN', 'DBSIZE', 'TIME', 'INFO', 'PING', 'ECHO', 'COMMAND', 'CLIENT',
])
const MULTI_KEY = new Set(['MGET', 'MSET', 'WATCH'])
const NO_KEY = new Set([
  'PING', 'ECHO', 'SELECT', 'DBSIZE', 'TIME', 'INFO', 'COMMAND', 'CLIENT',
  'FLUSHDB', 'FLUSHALL', 'MULTI', 'EXEC', 'DISCARD', 'UNWATCH', 'EVAL', 'EVALSHA', 'SCRIPT',
])

function keyRange(name) {
  if (MULTI_KEY.has(name)) return [1, -1]
  if (NO_KEY.has(name)) return [0, 0]
  return [1, 1]
}

function commandInfo(fn, name) {
  const arity = fn.arity === undefined ? 0 : fn.arity
  const flags = READ_ONLY.has(name) ? ['readonly'] : ['write']
  const [firstKey, lastKey] = keyRange(name)
  return [
    bulkReply(name),
    integerReply(arity),
    arrayReply(flags.map(simpleReply)),
    integerReply(firstKey),
    integerReply(lastKey),
    integerReply(firstKey === 0 ? 0 : 1),
  ]
}

export const COMMAND = cmd({
  arity: -1,
  syntax: 'COMMAND [COUNT|INFO command ...|DOCS]',
  summary: 'Introspect the command registry.',
  group: 'server',
  examples: ['COMMAND', 'COMMAND COUNT', 'COMMAND INFO SET'],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()
  if (sub === '') {
    return arrayReply(
      [...engine.commandRegistry.entries()].map(([name, fn]) => arrayReply(commandInfo(fn, name)))
    )
  }
  if (sub === 'COUNT') return integerReply(engine.commandRegistry.size)
  if (sub === 'INFO') {
    return arrayReply(
      args.slice(2).map((n) => {
        const canon = String(n).toUpperCase()
        const fn = engine.commandRegistry.get(canon)
        return fn ? arrayReply(commandInfo(fn, canon)) : nilReply()
      })
    )
  }
  if (sub === 'DOCS') {
    return arrayReply(
      [...engine.commandRegistry.entries()].map(([name, fn]) =>
        arrayReply([
          bulkReply(name),
          arrayReply([bulkReply('summary'), bulkReply(fn.summary || '')]),
        ])
      )
    )
  }
  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try COMMAND HELP.`)
})

// ---- CLIENT ---------------------------------------------------------------

export const CLIENT = cmd({
  arity: -2,
  syntax: 'CLIENT SETNAME connection-name | GETNAME | ID | SETINFO ...',
  summary: 'Manage the current connection: set or query its client name.',
  group: 'server',
  examples: ['CLIENT SETNAME myapp', 'CLIENT GETNAME'],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()
  if (sub === 'SETNAME') {
    const name = args[2]
    if (name === undefined) return errorReply("ERR wrong number of arguments for 'setname' command")
    if (/[\s]/.test(name)) {
      return errorReply('ERR Client names cannot contain spaces, newlines or special characters.')
    }
    engine.connectionId = String(name)
    return okReply()
  }
  if (sub === 'GETNAME') return bulkReply(engine.connectionId)
  if (sub === 'ID') return integerReply(1)
  if (sub === 'SETINFO') {
    if (args.length < 4) return errorReply("ERR wrong number of arguments for 'setinfo' command")
    return okReply()
  }
  if (sub === 'LIST') {
    return bulkReply(
      `id=1 addr=127.0.0.1:0 laddr=127.0.0.1:0 fd=0 name=${engine.connectionId} ` +
        `age=0 idle=0 flags=N db=${engine.activeDb} sub=0 psub=0 multi=-1 qbuf=0 ` +
        'qbuf-free=0 argv-mem=0 multi-mem=0 rbs=1024 rbp=0 obl=0 oll=0 omem=0 ' +
        'tot-mem=0 events=r cmd=client|list user=default redir=-1 resp=2 lib-name= lib-ver='
    )
  }
  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try CLIENT HELP.`)
})
