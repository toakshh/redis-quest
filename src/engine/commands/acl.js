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
} from '../reply.js'

// Mock user database for ACL
const DEFAULT_USER = {
  name: 'default',
  enabled: true,
  passwords: [], // empty = no password required
  categories: ['@all'],
  commands: [],
  keys: ['*'],
  channels: ['*'],
  selectors: [],
}

let users = { default: { ...DEFAULT_USER } }

// Reset users to initial state (for testing/new game)
export function resetACL() {
  users = { default: { ...DEFAULT_USER } }
}

export function getUser(name) {
  return users[name]
}

export function getAllUsers() {
  return Object.values(users).map(u => ({ ...u }))
}

export function setUser(name, rules) {
  if (!users[name]) {
    users[name] = { ...DEFAULT_USER, name, enabled: true }
  }
  const user = users[name]

  for (const rule of rules) {
    const upper = rule.toUpperCase()
    if (upper === 'ON') user.enabled = true
    else if (upper === 'OFF') user.enabled = false
    else if (upper === 'NOPass') user.passwords = []
    else if (upper.startsWith('>')) user.passwords.push(rule.slice(1))
    else if (upper.startsWith('<')) user.passwords.push(rule.slice(1)) // hashed
    else if (upper.startsWith('+@') || upper.startsWith('-@')) {
      const cat = upper.slice(1)
      if (upper.startsWith('+@')) {
        if (!user.categories.includes(cat)) user.categories.push(cat)
      } else {
        user.categories = user.categories.filter(c => c !== cat)
      }
    }
    else if (upper.startsWith('+') || upper.startsWith('-')) {
      const cmd = upper.slice(1)
      if (upper.startsWith('+')) {
        if (!user.commands.includes(cmd)) user.commands.push(cmd)
      } else {
        user.commands = user.commands.filter(c => c !== cmd)
      }
    }
    else if (upper.startsWith('~')) {
      user.keys = [rule.slice(1)]
    }
    else if (upper.startsWith('&')) {
      user.channels = [rule.slice(1)]
    }
    else if (upper === 'ALLKEYS') user.keys = ['*']
    else if (upper === 'ALLCHANNELS') user.channels = ['*']
    else if (upper === 'RESET') {
      Object.assign(user, { ...DEFAULT_USER, name })
    }
    else if (upper === 'RESETKEYS') user.keys = ['*']
    else if (upper === 'RESETCHANNELS') user.channels = ['*']
    else if (upper === 'RESETPASS') user.passwords = []
    else if (upper === 'RESETCMDS') user.commands = []
  }
  return user
}

export function delUser(name) {
  if (name === 'default') return false
  delete users[name]
  return true
}

export function checkAuth(username, password) {
  const user = users[username]
  if (!user || !user.enabled) return false
  if (user.passwords.length === 0) return true // no password required
  return user.passwords.includes(password)
}

export function checkPermission(username, command, key = null, channel = null) {
  const user = users[username]
  if (!user || !user.enabled) return false

  const cmd = command.toUpperCase()

  // Check command permissions
  if (user.commands.includes('ALLCOMMANDS') || user.commands.includes(cmd)) return true
  if (user.commands.includes('-' + cmd)) return false

  // Check category permissions
  const categories = getCommandCategories(cmd)
  for (const cat of categories) {
    if (user.categories.includes('@' + cat)) return true
    if (user.categories.includes('-@' + cat)) return false
  }

  // Default: if user has @all, allow
  if (user.categories.includes('@all')) return true

  return false
}

function getCommandCategories(cmd) {
  const categoryMap = {
    'SET': ['write', 'string', 'fast'],
    'GET': ['read', 'string', 'fast'],
    'DEL': ['write', 'keyspace', 'fast'],
    'EXPIRE': ['write', 'keyspace', 'fast'],
    'HSET': ['write', 'hash', 'fast'],
    'HGET': ['read', 'hash', 'fast'],
    'LPUSH': ['write', 'list', 'fast'],
    'LRANGE': ['read', 'list', 'fast'],
    'SADD': ['write', 'set', 'fast'],
    'SMEMBERS': ['read', 'set', 'fast'],
    'ZADD': ['write', 'sortedset', 'fast'],
    'ZRANGE': ['read', 'sortedset', 'fast'],
    'KEYS': ['read', 'keyspace', 'slow'],
    'SCAN': ['read', 'keyspace', 'slow'],
    'INFO': ['read', 'server', 'slow'],
    'CONFIG': ['admin', 'dangerous', 'slow'],
    'ACL': ['admin', 'slow'],
    'CLUSTER': ['admin', 'slow'],
    'DEBUG': ['admin', 'dangerous', 'slow'],
    'MONITOR': ['admin', 'slow'],
    'SLOWLOG': ['admin', 'slow'],
    'LATENCY': ['admin', 'slow'],
    'MEMORY': ['admin', 'slow'],
    'MODULE': ['admin', 'dangerous', 'slow'],
    'FUNCTION': ['admin', 'slow'],
    'AUTH': ['connection', 'fast'],
    'HELLO': ['connection', 'fast'],
    'PING': ['connection', 'fast'],
    'ECHO': ['connection', 'fast'],
    'SELECT': ['connection', 'fast'],
    'QUIT': ['connection', 'fast'],
  }
  return categoryMap[cmd] || ['unknown']
}

export const ACL = cmd({
  arity: -2,
  syntax: 'ACL SUBCOMMAND [args...]',
  summary: 'Manage Redis ACL users and permissions.',
  group: 'server',
  examples: [
    'ACL LIST',
    'ACL USERS',
    'ACL GETUSER default',
    'ACL SETUSER alice on >password +@all ~*',
    'ACL DELUSER alice',
    'ACL CAT',
    'ACL GENPASS',
    'ACL WHOAMI',
    'ACL LOG',
    'ACL DRYRUN alice SET key value',
  ],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()

  if (sub === 'LIST') {
    const lines = Object.values(users).map(u => {
      const flags = []
      if (u.enabled) flags.push('on')
      else flags.push('off')
      if (u.passwords.length === 0) flags.push('nopass')
      else flags.push('>?' + u.passwords.length)
      flags.push('keys:' + u.keys.join(','))
      flags.push('channels:' + u.channels.join(','))
      flags.push('commands:' + (u.commands.length ? u.commands.join(',') : '(none)'))
      flags.push('categories:' + u.categories.join(','))
      return `user ${u.name} ${flags.join(' ')}`
    })
    return bulkReply(lines.join('\n'))
  }

  if (sub === 'USERS') {
    return arrayReply(Object.keys(users).map(bulkReply))
  }

  if (sub === 'GETUSER') {
    const name = args[2]
    if (!name) return errorReply("ERR wrong number of arguments for 'getuser' command")
    const user = users[name]
    if (!user) return errorReply(`ERR no such user '${name}'`)
    const flags = []
    if (user.enabled) flags.push('on')
    else flags.push('off')
    if (user.passwords.length === 0) flags.push('nopass')
    else flags.push('>?' + user.passwords.length)
    flags.push('keys:' + user.keys.join(','))
    flags.push('channels:' + user.channels.join(','))
    flags.push('commands:' + (user.commands.length ? user.commands.join(',') : '(none)'))
    flags.push('categories:' + user.categories.join(','))
    return arrayReply(flags.map(bulkReply))
  }

  if (sub === 'SETUSER') {
    const name = args[2]
    if (!name) return errorReply("ERR wrong number of arguments for 'setuser' command")
    const rules = args.slice(3)
    if (rules.length === 0) return errorReply("ERR wrong number of arguments for 'setuser' command")
    const user = setUser(name, rules)
    const flags = []
    if (user.enabled) flags.push('on')
    else flags.push('off')
    if (user.passwords.length === 0) flags.push('nopass')
    else flags.push('>?' + user.passwords.length)
    flags.push('keys:' + user.keys.join(','))
    flags.push('channels:' + user.channels.join(','))
    flags.push('commands:' + (user.commands.length ? user.commands.join(',') : '(none)'))
    flags.push('categories:' + user.categories.join(','))
    return arrayReply(flags.map(bulkReply))
  }

  if (sub === 'DELUSER') {
    const names = args.slice(2)
    if (names.length === 0) return errorReply("ERR wrong number of arguments for 'deluser' command")
    let count = 0
    for (const name of names) {
      if (delUser(name)) count++
    }
    return integerReply(count)
  }

  if (sub === 'CAT') {
    const category = args[2] ? String(args[2]).toUpperCase() : null
    const categories = {
      keyspace: ['DEL', 'EXPIRE', 'KEYS', 'SCAN', 'TYPE', 'TTL'],
      read: ['GET', 'MGET', 'HGET', 'HMGET', 'LRANGE', 'SMEMBERS', 'ZRANGE'],
      write: ['SET', 'MSET', 'HSET', 'HMSET', 'LPUSH', 'RPUSH', 'SADD', 'ZADD'],
      string: ['SET', 'GET', 'APPEND', 'STRLEN'],
      hash: ['HSET', 'HGET', 'HDEL', 'HEXISTS'],
      list: ['LPUSH', 'RPUSH', 'LPOP', 'RPOP', 'LRANGE'],
      set: ['SADD', 'SREM', 'SMEMBERS', 'SISMEMBER'],
      sortedset: ['ZADD', 'ZREM', 'ZRANGE', 'ZRANK'],
      admin: ['ACL', 'CONFIG', 'CLUSTER', 'DEBUG', 'MODULE', 'FUNCTION', 'SHUTDOWN'],
      dangerous: ['DEBUG', 'FLUSHALL', 'FLUSHDB', 'CONFIG REWRITE', 'MODULE LOAD'],
      connection: ['AUTH', 'HELLO', 'PING', 'ECHO', 'SELECT', 'QUIT', 'CLIENT'],
      blocking: ['BLPOP', 'BRPOP', 'BZPOPMIN', 'BZPOPMAX'],
      fast: ['GET', 'SET', 'INCR', 'LPUSH', 'LPOP', 'HSET', 'HGET', 'SADD', 'SREM', 'ZADD', 'ZREM'],
      slow: ['KEYS', 'SCAN', 'SORT', 'MONITOR', 'SLOWLOG'],
      pubsub: ['PUBLISH', 'SUBSCRIBE', 'PSUBSCRIBE', 'UNSUBSCRIBE'],
      transaction: ['MULTI', 'EXEC', 'DISCARD', 'WATCH', 'UNWATCH'],
      scripting: ['EVAL', 'EVALSHA', 'SCRIPT'],
    }
    if (category) {
      const cmds = categories[category.toLowerCase()] || []
      return arrayReply(cmds.map(bulkReply))
    }
    return arrayReply(Object.keys(categories).map(bulkReply))
  }

  if (sub === 'GENPASS') {
    const bits = args[2] ? parseInt(args[2]) : 256
    // Generate a mock secure password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let pass = ''
    for (let i = 0; i < bits / 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return bulkReply(pass)
  }

  if (sub === 'WHOAMI') {
    // In real Redis, this returns the authenticated user
    // Here we'll use the engine's connectionId as the username
    const username = engine.connectionId || 'default'
    return bulkReply(username)
  }

  if (sub === 'LOG') {
    // Mock ACL log - in real Redis this shows auth failures
    const logEntries = [
      { timestamp: Date.now() - 10000, username: 'attacker', command: 'CONFIG SET', reason: 'no permissions' },
      { timestamp: Date.now() - 5000, username: 'hacker', command: 'DEBUG SEGFAULT', reason: 'command not allowed' },
    ]
    return arrayReply(logEntries.map(e => arrayReply([
      bulkReply(String(e.timestamp)),
      bulkReply(e.username),
      bulkReply(e.command),
      bulkReply(e.reason),
    ])))
  }

  if (sub === 'DRYRUN') {
    const username = args[2]
    const command = args.slice(3).join(' ')
    if (!username || !command) return errorReply("ERR wrong number of arguments for 'dryrun' command")
    const user = users[username]
    if (!user) return errorReply(`ERR no such user '${username}'`)

    const tokens = command.split(' ')
    const cmd = tokens[0].toUpperCase()
    const key = tokens[1] || null
    const allowed = checkPermission(username, cmd, key)

    return arrayReply([
      bulkReply(username),
      bulkReply(command),
      bulkReply(allowed ? 'allowed' : 'denied'),
    ])
  }

  if (sub === 'LOAD') {
    return okReply()
  }

  if (sub === 'SAVE') {
    return okReply()
  }

  if (sub === 'HELP') {
    const help = [
      'LIST -- List all users and their ACL rules',
      'USERS -- List all user names',
      'GETUSER username -- Get the ACL rules for a specific user',
      'SETUSER username rule [rule ...] -- Create or update a user with ACL rules',
      'DELUSER username [username ...] -- Delete one or more users',
      'CAT [category] -- List command categories or commands in a category',
      'GENPASS [bits] -- Generate a secure password',
      'WHOAMI -- Return the current authenticated user',
      'LOG [count] -- Show ACL log entries',
      'DRYRUN username command -- Simulate command execution for a user',
      'LOAD -- Load ACL rules from file (no-op in mock)',
      'SAVE -- Save ACL rules to file (no-op in mock)',
    ]
    return arrayReply(help.map(bulkReply))
  }

  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try ACL HELP.`)
})

export const HELLO = cmd({
  arity: -1,
  syntax: 'HELLO [protocol] [AUTH username password] [SETNAME name]',
  summary: 'Switch protocol and authenticate (Redis 6+).',
  group: 'connection',
  examples: ['HELLO 3', 'HELLO 3 AUTH alice secret', 'HELLO 3 SETNAME myapp'],
})((engine, args) => {
  if (args.length === 1) {
    return arrayReply([
      bulkReply('server'),
      bulkReply('redis-quest'),
      bulkReply('7.2.0'),
      bulkReply('1000000'),
      arrayReply([]),
      arrayReply([]),
      arrayReply([]),
    ])
  }

  let protocol = 2
  let username = null
  let password = null
  let setname = null

  for (let i = 1; i < args.length; i++) {
    const arg = String(args[i]).toUpperCase()
    if (arg === 'AUTH') {
      username = args[++i]
      password = args[++i]
    } else if (arg === 'SETNAME') {
      setname = args[++i]
    } else if (/^\d+$/.test(arg)) {
      protocol = parseInt(arg)
    }
  }

  if (username) {
    if (!checkAuth(username, password)) {
      return errorReply('WRONGPASS invalid username-password pair')
    }
    engine.connectionId = username
  }
  if (setname) {
    engine.connectionId = setname
  }

  return arrayReply([
    bulkReply('server'),
    bulkReply('redis-quest'),
    bulkReply('7.2.0'),
    bulkReply(String(protocol)),
    arrayReply([]),
    arrayReply([]),
    arrayReply([]),
  ])
})

export const AUTH = cmd({
  arity: -2,
  syntax: 'AUTH [username] password',
  summary: 'Authenticate to the server.',
  group: 'connection',
  examples: ['AUTH password', 'AUTH alice secret'],
})((engine, args) => {
  let username = 'default'
  let password = args[1]

  if (args.length === 3) {
    username = args[1]
    password = args[2]
  }

  if (!checkAuth(username, password)) {
    return errorReply('WRONGPASS invalid username-password pair')
  }

  engine.connectionId = username
  return okReply()
})