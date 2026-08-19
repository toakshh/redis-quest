// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { load3d, save3d, remove3d, clearAll3d } from './persistence3d.js'

describe('persistence3d', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a value through save3d/load3d', () => {
    save3d('foo', { a: 1 })
    expect(load3d('foo')).toEqual({ a: 1 })
  })

  it('returns the fallback for a missing key', () => {
    expect(load3d('missing', 'X')).toBe('X')
  })

  it('stores under the redis-quest:3d: prefix', () => {
    save3d('foo', 1)
    expect(localStorage.getItem('redis-quest:3d:foo')).toBe('1')
  })

  it('never writes a key a 2D load("foo") would read', () => {
    save3d('foo', 1)
    // the 2D wrapper reads 'redis-quest:foo' — must be untouched
    expect(localStorage.getItem('redis-quest:foo')).toBeNull()
  })

  it('remove3d deletes only the 3d-namespaced key', () => {
    save3d('foo', 1)
    remove3d('foo')
    expect(load3d('foo', 'gone')).toBe('gone')
  })

  it('clearAll3d removes 3d keys and leaves a manually-set 2D key intact', () => {
    save3d('foo', 1)
    save3d('bar', 2)
    localStorage.setItem('redis-quest:twoD', 'untouched')
    clearAll3d()
    expect(load3d('foo', 'gone')).toBe('gone')
    expect(load3d('bar', 'gone')).toBe('gone')
    expect(localStorage.getItem('redis-quest:twoD')).toBe('untouched')
  })
})
