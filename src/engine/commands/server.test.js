// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { MockRedisEngine } from '../engine.js'

let engine

beforeEach(() => {
  engine = new MockRedisEngine()
})

const ok = { type: 'simple', value: 'OK' }
const bulk = (value) => ({ type: 'bulk', value })
const integer = (value) => ({ type: 'integer', value })
const array = (value) => ({ type: 'array', value })
const nil = { type: 'nil', value: null }
const err = (value) => ({ type: 'error', value })

describe('PING / ECHO', () => {
  it('PING returns PONG without a message and the message as a bulk string with one', () => {
    expect(engine.rawExecute('PING')).toEqual({ type: 'simple', value: 'PONG' })
    expect(engine.rawExecute('PING', 'hello')).toEqual(bulk('hello'))
  })

  it('ECHO returns the message as a bulk string', () => {
    expect(engine.rawExecute('ECHO', 'hello world')).toEqual(bulk('hello world'))
  })

  it('ECHO returns wrong arity without a message', () => {
    expect(engine.rawExecute('ECHO')).toEqual(err("ERR wrong number of arguments for 'ECHO' command"))
  })
})

describe('SELECT', () => {
  it('switches the active database', () => {
    engine.rawExecute('SET', 'a', '1')
    expect(engine.rawExecute('SELECT', '3')).toEqual(ok)
    expect(engine.rawExecute('GET', 'a')).toEqual(nil)
    expect(engine.rawExecute('DBSIZE')).toEqual(integer(0))
    engine.rawExecute('SELECT', '0')
    expect(engine.rawExecute('GET', 'a')).toEqual(bulk('1'))
  })

  it('rejects a non-integer index', () => {
    expect(engine.rawExecute('SELECT', 'abc')).toEqual(
      err('ERR value is not an integer or out of range'),
    )
  })

  it('rejects an out-of-range index', () => {
    expect(engine.rawExecute('SELECT', '99')).toEqual(err('ERR DB index is out of range'))
    expect(engine.rawExecute('SELECT', '-1')).toEqual(err('ERR DB index is out of range'))
  })

  it('returns wrong arity without an index', () => {
    expect(engine.rawExecute('SELECT')).toEqual(err("ERR wrong number of arguments for 'SELECT' command"))
  })
})

describe('DBSIZE', () => {
  it('counts live keys in the active database', () => {
    expect(engine.rawExecute('DBSIZE')).toEqual(integer(0))
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('SET', 'b', '2')
    expect(engine.rawExecute('DBSIZE')).toEqual(integer(2))
  })

  it('ignores expired keys', () => {
    let clock = 0
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'live', '1')
    timed.rawExecute('SET', 'dead', '2')
    timed.rawExecute('PEXPIRE', 'dead', '1')
    clock = 1000
    expect(timed.rawExecute('DBSIZE')).toEqual(integer(1))
  })
})

describe('FLUSHDB / FLUSHALL', () => {
  it('FLUSHDB clears the active database', () => {
    engine.rawExecute('SET', 'a', '1')
    expect(engine.rawExecute('FLUSHDB')).toEqual(ok)
    expect(engine.rawExecute('DBSIZE')).toEqual(integer(0))
  })

  it('FLUSHDB accepts ASYNC / SYNC', () => {
    engine.rawExecute('SET', 'a', '1')
    expect(engine.rawExecute('FLUSHDB', 'ASYNC')).toEqual(ok)
    expect(engine.rawExecute('DBSIZE')).toEqual(integer(0))
    engine.rawExecute('SET', 'a', '1')
    expect(engine.rawExecute('FLUSHDB', 'SYNC')).toEqual(ok)
  })

  it('FLUSHDB rejects an unknown option', () => {
    expect(engine.rawExecute('FLUSHDB', 'NOPE')).toEqual(err('ERR syntax error'))
    expect(engine.rawExecute('FLUSHALL', 'NOPE')).toEqual(err('ERR syntax error'))
  })

  it('FLUSHALL clears every database', () => {
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('SELECT', '2')
    engine.rawExecute('SET', 'b', '2')
    expect(engine.rawExecute('FLUSHALL')).toEqual(ok)
    expect(engine.rawExecute('DBSIZE')).toEqual(integer(0))
    engine.rawExecute('SELECT', '0')
    expect(engine.rawExecute('DBSIZE')).toEqual(integer(0))
  })
})

describe('TIME', () => {
  it('returns [seconds, microseconds] as bulk strings', () => {
    const reply = engine.rawExecute('TIME')
    expect(reply.type).toBe('array')
    expect(reply.value).toHaveLength(2)
    expect(reply.value[0].type).toBe('bulk')
    expect(reply.value[1].type).toBe('bulk')
    expect(Number(reply.value[0].value)).toBeGreaterThan(0)
  })
})

describe('INFO', () => {
  it('returns server info as a bulk string with section headers', () => {
    const reply = engine.rawExecute('INFO')
    expect(reply.type).toBe('bulk')
    expect(reply.value).toContain('# Server\r\n')
    expect(reply.value).toContain('redis_version:7.2.0')
    expect(reply.value).toContain('# Memory\r\n')
    expect(reply.value).toContain('used_memory:')
    expect(reply.value).toContain('# Keyspace\r\n')
  })

  it('supports section filters', () => {
    const serverOnly = engine.rawExecute('INFO', 'server')
    expect(serverOnly.value).toContain('# Server\r\n')
    expect(serverOnly.value).not.toContain('# Memory\r\n')

    const statsOnly = engine.rawExecute('INFO', 'stats')
    expect(statsOnly.value).toContain('# Stats\r\n')
    expect(statsOnly.value).toContain('total_commands_processed:')

    engine.rawExecute('SET', 'a', '1')
    const keyspace = engine.rawExecute('INFO', 'keyspace')
    expect(keyspace.value).toContain('db0:keys=1,expires=0')
  })
})

describe('COMMAND', () => {
  it('COMMAND COUNT returns the number of registered commands', () => {
    const reply = engine.rawExecute('COMMAND', 'COUNT')
    expect(reply).toEqual(integer(engine.commandRegistry.size))
    expect(reply.value).toBeGreaterThan(0)
  })

  it('COMMAND INFO returns metadata for the given commands', () => {
    const reply = engine.rawExecute('COMMAND', 'INFO', 'GET', 'SET')
    expect(reply.type).toBe('array')
    expect(reply.value).toHaveLength(2)
    expect(reply.value[0].value[0]).toEqual(bulk('GET'))
    expect(reply.value[0].value[1]).toEqual(integer(2))
  })

  it('COMMAND INFO returns nil for an unknown command', () => {
    const reply = engine.rawExecute('COMMAND', 'INFO', 'NOPE')
    expect(reply.type).toBe('array')
    expect(reply.value[0]).toEqual(nil)
  })

  it('COMMAND with no subcommand lists every command', () => {
    const reply = engine.rawExecute('COMMAND')
    expect(reply.type).toBe('array')
    expect(reply.value.length).toBe(engine.commandRegistry.size)
  })
})

describe('CLIENT', () => {
  it('GETNAME returns the default connection name', () => {
    expect(engine.rawExecute('CLIENT', 'GETNAME')).toEqual(bulk('local-terminal'))
  })

  it('SETNAME updates the connection name and GETNAME reflects it', () => {
    expect(engine.rawExecute('CLIENT', 'SETNAME', 'myapp')).toEqual(ok)
    expect(engine.rawExecute('CLIENT', 'GETNAME')).toEqual(bulk('myapp'))
  })

  it('SETNAME rejects names containing whitespace', () => {
    expect(engine.rawExecute('CLIENT', 'SETNAME', 'has space')).toEqual(
      err('ERR Client names cannot contain spaces, newlines or special characters.'),
    )
  })

  it('ID returns an integer', () => {
    expect(engine.rawExecute('CLIENT', 'ID')).toEqual(integer(1))
  })

  it('LIST returns connection info as a bulk string', () => {
    const reply = engine.rawExecute('CLIENT', 'LIST')
    expect(reply.type).toBe('bulk')
    expect(reply.value).toContain('name=local-terminal')
  })

  it('returns wrong arity for CLIENT without a subcommand', () => {
    expect(engine.rawExecute('CLIENT')).toEqual(err("ERR wrong number of arguments for 'CLIENT' command"))
  })

  it('rejects an unknown subcommand', () => {
    expect(engine.rawExecute('CLIENT', 'NOPE')).toEqual(
      err("ERR Unknown subcommand or wrong number of arguments for 'NOPE'. Try CLIENT HELP."),
    )
  })
})
