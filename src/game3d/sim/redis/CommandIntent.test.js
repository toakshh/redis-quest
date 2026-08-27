// Tests for CommandIntent: every tool maps to the correct command line, and
// the returned shape carries toolId + targetKey for downstream logging.

import { describe, it, expect } from 'vitest'
import { buildIntent, TOOLS } from './CommandIntent.js'

describe('buildIntent', () => {
  it('returns { line, toolId, targetKey }', () => {
    const intent = buildIntent(TOOLS.PROBE, 'session:7742')
    expect(intent).toEqual({
      line: 'GET session:7742',
      toolId: TOOLS.PROBE,
      targetKey: 'session:7742',
    })
  })

  it('PROBE defaults to GET and honours an alternate probe', () => {
    expect(buildIntent(TOOLS.PROBE, 'k').line).toBe('GET k')
    expect(buildIntent(TOOLS.PROBE, 'k', { probe: 'ttl' }).line).toBe('TTL k')
  })

  it('STORE emits SET, and SETEX when a ttl is given', () => {
    expect(buildIntent(TOOLS.STORE, 'k', { value: 'v' }).line).toBe('SET k v')
    expect(buildIntent(TOOLS.STORE, 'k', { value: 'v', ttlSeconds: 30 }).line).toBe('SETEX k 30 v')
  })

  it('TIMER prefers PEXPIRE with ms and falls back to EXPIRE', () => {
    expect(buildIntent(TOOLS.TIMER, 'k', { ms: 2500 }).line).toBe('PEXPIRE k 2500')
    expect(buildIntent(TOOLS.TIMER, 'k', { seconds: 5 }).line).toBe('EXPIRE k 5')
  })

  it('PURGE and RELEASE map to DEL and UNLINK', () => {
    expect(buildIntent(TOOLS.PURGE, 'k').line).toBe('DEL k')
    expect(buildIntent(TOOLS.RELEASE, 'k').line).toBe('UNLINK k')
  })

  it('ONESHOT builds an EVAL with a single key', () => {
    expect(buildIntent(TOOLS.ONESHOT, 'k', { script: 'return 1' }).line).toBe('EVAL "return 1" 1 k')
  })

  it('CREW adds to a stream, or reads its length', () => {
    expect(buildIntent(TOOLS.CREW, 'q', { field: 'job', value: '7' }).line).toBe('XADD q * job 7')
    expect(buildIntent(TOOLS.CREW, 'q', { read: true }).line).toBe('XLEN q')
  })

  it('TOLLGATE and SPREAD map to INCR and CLUSTER KEYSLOT', () => {
    expect(buildIntent(TOOLS.TOLLGATE, 'gate').line).toBe('INCR gate')
    expect(buildIntent(TOOLS.SPREAD, 'k').line).toBe('CLUSTER KEYSLOT k')
  })

  it('ANCHOR builds a fenced NX PX lock', () => {
    expect(buildIntent(TOOLS.ANCHOR, 'lock', { token: 'abc', ms: 5000 }).line).toBe('SET lock abc NX PX 5000')
  })

  it('quotes values containing whitespace so they stay one argument', () => {
    expect(buildIntent(TOOLS.STORE, 'k', { value: 'hello world' }).line).toBe('SET k "hello world"')
  })

  it('throws on an unknown tool id', () => {
    expect(() => buildIntent('NOPE', 'k')).toThrow(/unknown toolId/)
  })
})
