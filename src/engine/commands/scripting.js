import { cmd } from '../registry.js'
import {
  okReply,
  simpleReply,
  bulkReply,
  nilReply,
  integerReply,
  arrayReply,
  errorReply,
  intValue,
} from '../reply.js'

// Minimal Lua interpreter for EVAL. Covers the subset of Lua that shows up
// in teaching scripts: `local` assignments, KEYS / ARGV, redis.call(),
// redis.pcall(), arithmetic, string concat (..), basic if/else, and return.
// The script is transpiled into a small JS sandbox and run with new Function.

const STATUS_MARKER = '__redis_status__'

// Convert a RedisReply into a Lua-visible JS value. Status replies keep their
// type via a tagged object so `return redis.call('SET', ...)` produces +OK.
function toLuaValue(reply) {
  switch (reply.type) {
    case 'simple':
    case 'status':
      return { [STATUS_MARKER]: reply.value }
    case 'bulk':
      return reply.value
    case 'integer':
      return reply.value
    case 'nil':
      return null
    case 'array':
      return reply.value.map(toLuaValue)
    case 'error':
      throw new Error(reply.value)
    default:
      return null
  }
}

// Convert a script result back into a RedisReply.
function fromLuaValue(value) {
  if (value !== null && typeof value === 'object' && value[STATUS_MARKER] !== undefined) {
    return simpleReply(value[STATUS_MARKER])
  }
  if (value === null || value === undefined) return nilReply()
  if (typeof value === 'number') {
    return Number.isInteger(value) ? integerReply(value) : bulkReply(String(value))
  }
  if (typeof value === 'string') return bulkReply(value)
  if (typeof value === 'boolean') return integerReply(value ? 1 : 0)
  if (Array.isArray(value)) return arrayReply(value.map(fromLuaValue))
  return bulkReply(String(value))
}

// Lua -> JS token rewrite. Order matters (keywords before identifiers).
// Only single-level if/else is supported; nested blocks and loops are out of
// the teaching subset this interpreter targets.
function transpile(script) {
  let js = String(script)
  js = js.replace(/--\[\[[\s\S]*?\]\]/g, '') // long comments
  js = js.replace(/--[^\n]*/g, '') // line comments
  js = js.replace(/\s*~=\s*/g, ' !== ')
  js = js.replace(/\s*<>\s*/g, ' !== ')
  js = js.replace(/\bnil\b/g, 'null')
  js = js.replace(/\btrue\b/g, 'true')
  js = js.replace(/\bfalse\b/g, 'false')
  js = js.replace(/\blocal\s+(\w+)\s*=/g, 'let $1 =')
  js = js.replace(/\band\b/g, '&&')
  js = js.replace(/\bor\b/g, '||')
  js = js.replace(/\bnot\s+/g, '!')
  js = js.replace(/\belseif\s+(.*?)\s+then\b/g, '} else if ($1) {')
  js = js.replace(/\bif\s+(.*?)\s+then\b/g, 'if ($1) {')
  // leave the `else` that `elseif` just produced alone
  js = js.replace(/\belse\b(?!\s+if\b)/g, '} else {')
  js = js.replace(/\bend\b/g, '}')
  js = js.replace(/\.\.(?!=)/g, '+') // string concat
  js = js.replace(/\bredis\.(?:call|pcall)\s*\(/g, 'redisCall(')
  js = js.replace(/\bKEYS\s*\[(\d+)\]/g, '__keys[$1 - 1]')
  js = js.replace(/\bARGV\s*\[(\d+)\]/g, '__argv[$1 - 1]')
  js = js.replace(/\bKEYS\b/g, '__keys')
  js = js.replace(/\bARGV\b/g, '__argv')
  js = js.replace(/#(\w+)/g, '__len($1)') // length operator
  // A Lua `local x = expr return y` on one line has no line break for JS
  // automatic semicolon insertion, so splice a `;` between statements — but
  // never after a statement keyword (e.g. `return redisCall(...)` must stay
  // a single statement).
  const STMT_KEYWORDS = new Set([
    'return', 'let', 'if', 'redisCall', 'tonumber', 'tostring', 'type', 'math',
  ])
  js = js.replace(
    /(^|[^A-Za-z0-9_])([A-Za-z0-9_]+)\s+(?=(?:return|let|if|redisCall|tonumber|tostring|type|math)\b)|([)"'\]}])\s+(?=(?:return|let|if|redisCall|tonumber|tostring|type|math)\b)/g,
    (m, sep, word, closer) => {
      if (sep !== undefined) {
        return STMT_KEYWORDS.has(word) ? m : `${sep}${word};\n`
      }
      return `${closer};\n`
    }
  )
  return js
}

function runLua(engine, script, keys, argv) {
  const source = transpile(script)
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    '__keys',
    '__argv',
    'redisCall',
    '__len',
    'tonumber',
    'tostring',
    'type',
    'math',
    `"use strict";\n${source}`
  )
  return fn(
    keys,
    argv,
    (name, ...callArgs) => {
      const argvStr = callArgs.map((a) => (a == null ? '' : String(a)))
      return toLuaValue(engine.rawExecute(String(name), ...argvStr))
    },
    (v) => (v ? v.length : 0),
    (v) => {
      if (typeof v === 'number') return v
      const n = Number(v)
      return Number.isNaN(n) ? null : n
    },
    (v) => (v === null || v === undefined ? 'nil' : String(v)),
    (v) => {
      if (v === null || v === undefined) return 'nil'
      if (typeof v === 'number') return 'number'
      if (typeof v === 'string') return 'string'
      if (typeof v === 'boolean') return 'boolean'
      return 'table'
    },
    {
      floor: Math.floor,
      ceil: Math.ceil,
      abs: Math.abs,
      max: Math.max,
      min: Math.min,
      sqrt: Math.sqrt,
      pow: Math.pow,
    }
  )
}

// Real SCRIPT LOAD stores scripts under their SHA-1 so EVALSHA can find them.
// Pure-JS SHA-1 (RFC 3174) so the browser bundle needs no node:crypto.
function sha1Hex(input) {
  const str = String(input)
  const bytes = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push((c >> 6) | 0xc0, (c & 0x3f) | 0x80)
    else bytes.push((c >> 12) | 0xe0, ((c >> 6) & 0x3f) | 0x80, (c & 0x3f) | 0x80)
  }
  const bitLen = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let i = 7; i >= 0; i--) bytes.push(Math.floor(bitLen / 2 ** (i * 8)) & 0xff)

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0

  for (let off = 0; off < bytes.length; off += 64) {
    const w = new Array(80)
    for (let i = 0; i < 16; i++) {
      w[i] =
        (bytes[off + i * 4] << 24) |
        (bytes[off + i * 4 + 1] << 16) |
        (bytes[off + i * 4 + 2] << 8) |
        bytes[off + i * 4 + 3]
    }
    for (let i = 16; i < 80; i++) {
      const n = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]
      w[i] = ((n << 1) | (n >>> 31)) | 0
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    for (let i = 0; i < 80; i++) {
      let f
      let k
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0
      e = d
      d = c
      c = ((b << 30) | (b >>> 2)) | 0
      b = a
      a = temp
    }
    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
  }

  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0')
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4)
}

function scriptCache(engine) {
  if (!engine.scriptCache) engine.scriptCache = new Map()
  return engine.scriptCache
}

// Shared numkeys parsing + key/arg splitting for EVAL / EVALSHA.
function splitEvalArgs(engine, args) {
  const numkeys = intValue(args[2])
  if (numkeys === null || numkeys < 0) {
    return { error: errorReply('ERR value is not an integer or out of range') }
  }
  if (numkeys > args.length - 3) {
    return { error: errorReply("ERR Number of keys can't be greater than number of args") }
  }
  return {
    keys: args.slice(3, 3 + numkeys),
    argv: args.slice(3 + numkeys),
  }
}

export const EVAL = cmd({
  arity: -3,
  syntax: 'EVAL script numkeys [key ...] [arg ...]',
  summary: 'Execute a Lua script. Supports redis.call(), KEYS, ARGV, arithmetic and string concat.',
  group: 'scripting',
  examples: ["EVAL \"return redis.call('SET', KEYS[1], ARGV[1])\" 1 mykey hello"],
})((engine, args) => {
  const script = String(args[1])
  const { keys, argv, error } = splitEvalArgs(engine, args)
  if (error) return error
  try {
    const result = runLua(engine, script, keys, argv)
    engine.stats.scriptsRun++
    return fromLuaValue(result)
  } catch (err) {
    return errorReply(
      `ERR Error running script (call to f_${sha1Hex(script).slice(0, 8)}): @user_script:1: ${err.message}`
    )
  }
})

export const EVALSHA = cmd({
  arity: -3,
  syntax: 'EVALSHA sha1 numkeys [key ...] [arg ...]',
  summary: 'Execute a previously SCRIPT LOADed script by its SHA-1 digest.',
  group: 'scripting',
  examples: ["EVALSHA <sha> 1 mykey"],
})((engine, args) => {
  const sha = String(args[1]).toLowerCase()
  const script = scriptCache(engine).get(sha)
  if (script === undefined) {
    return errorReply('NOSCRIPT No matching script. Please use EVAL.')
  }
  const { keys, argv, error } = splitEvalArgs(engine, args)
  if (error) return error
  try {
    const result = runLua(engine, script, keys, argv)
    engine.stats.scriptsRun++
    return fromLuaValue(result)
  } catch (err) {
    return errorReply(
      `ERR Error running script (call to f_${sha.slice(0, 8)}): @user_script:1: ${err.message}`
    )
  }
})

export const SCRIPT = cmd({
  arity: -2,
  syntax: 'SCRIPT LOAD|EXISTS|FLUSH|KILL ...',
  summary: 'Manage the server-side script cache used by EVALSHA.',
  group: 'scripting',
  examples: ["SCRIPT LOAD \"return redis.call('GET', KEYS[1])\""],
})((engine, args) => {
  const sub = String(args[1] || '').toUpperCase()
  if (sub === 'LOAD') {
    const script = String(args[2] ?? '')
    const sha = sha1Hex(script)
    scriptCache(engine).set(sha, script)
    return bulkReply(sha)
  }
  if (sub === 'EXISTS') {
    const cache = scriptCache(engine)
    return arrayReply(
      args.slice(2).map((a) => integerReply(cache.has(String(a).toLowerCase()) ? 1 : 0))
    )
  }
  if (sub === 'FLUSH') {
    scriptCache(engine).clear()
    return okReply()
  }
  if (sub === 'KILL') {
    return errorReply('NOTBUSY No scripts in execution right now.')
  }
  return errorReply(`ERR Unknown subcommand or wrong number of arguments for '${sub}'. Try SCRIPT HELP.`)
})
