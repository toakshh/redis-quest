// Tests for the 2D spatial hash: rebuild, radius queries, nearest lookup with
// a filter, the caller-supplied outArray contract, and allocation reuse.

import { describe, it, expect } from 'vitest'
import { createSpatialHash } from './spatialHash.js'
import { createEntityStore } from './EntityStore.js'

function seedStore(positions) {
  const s = createEntityStore(64)
  for (const [x, z] of positions) s.spawn(0, x, 0, z)
  return s
}

describe('spatialHash', () => {
  it('defaults to a cell size of 4', () => {
    expect(createSpatialHash().cellSize).toBe(4)
  })

  it('finds entities inside the radius and excludes those outside', () => {
    const store = seedStore([
      [0, 0],
      [1, 1],
      [10, 10],
    ])
    const hash = createSpatialHash(4)
    hash.rebuild(store)
    const out = new Int32Array(16)
    const n = hash.queryRadius(0, 0, 2, out)
    const ids = Array.from(out.slice(0, n)).sort()
    expect(ids).toEqual([0, 1])
  })

  it('ignores the Y axis entirely', () => {
    const s = createEntityStore(4)
    s.spawn(0, 0, 999, 0) // far away on Y, on top on X/Z
    const hash = createSpatialHash(4)
    hash.rebuild(s)
    const out = new Int32Array(4)
    expect(hash.queryRadius(0, 0, 1, out)).toBe(1)
  })

  it('queryRadius returns 0 when nothing is near', () => {
    const store = seedStore([[100, 100]])
    const hash = createSpatialHash(4)
    hash.rebuild(store)
    const out = new Int32Array(4)
    expect(hash.queryRadius(0, 0, 5, out)).toBe(0)
  })

  it('queryNearest returns the closest id', () => {
    const store = seedStore([
      [5, 0],
      [2, 0],
      [8, 0],
    ])
    const hash = createSpatialHash(4)
    hash.rebuild(store)
    expect(hash.queryNearest(0, 0, 20, null)).toBe(1) // the one at (2,0)
  })

  it('queryNearest respects the filter function', () => {
    const store = seedStore([
      [2, 0],
      [3, 0],
    ])
    const hash = createSpatialHash(4)
    hash.rebuild(store)
    // Reject id 0 → the next-nearest (id 1) wins.
    expect(hash.queryNearest(0, 0, 20, (id) => id !== 0)).toBe(1)
  })

  it('queryNearest returns -1 when nothing is within maxRadius', () => {
    const store = seedStore([[50, 50]])
    const hash = createSpatialHash(4)
    hash.rebuild(store)
    expect(hash.queryNearest(0, 0, 5, null)).toBe(-1)
  })

  it('rebuild reflects moved entities', () => {
    const s = createEntityStore(4)
    const id = s.spawn(0, 0, 0, 0)
    const hash = createSpatialHash(4)
    hash.rebuild(s)
    const out = new Int32Array(4)
    expect(hash.queryRadius(0, 0, 1, out)).toBe(1)
    // Move it far and rebuild — it should no longer be near the origin.
    s.posX[id] = 100
    hash.rebuild(s)
    expect(hash.queryRadius(0, 0, 1, out)).toBe(0)
    expect(hash.queryRadius(100, 0, 1, out)).toBe(1)
  })

  it('reuses the same cell arrays across rebuilds (no reallocation)', () => {
    const store = seedStore([
      [0, 0],
      [1, 0],
    ])
    const hash = createSpatialHash(4)
    hash.rebuild(store)
    const key = hash.cells.keys().next().value
    const arrRef = hash.cells.get(key)
    hash.rebuild(store)
    expect(hash.cells.get(key)).toBe(arrRef) // same array object, length reset
  })

  it('handles a despawned entity dropping out of queries after rebuild', () => {
    const s = createEntityStore(4)
    const a = s.spawn(0, 0, 0, 0)
    s.spawn(0, 1, 0, 0)
    const hash = createSpatialHash(4)
    hash.rebuild(s)
    const out = new Int32Array(4)
    expect(hash.queryRadius(0, 0, 3, out)).toBe(2)
    s.despawn(a)
    hash.rebuild(s)
    expect(hash.queryRadius(0, 0, 3, out)).toBe(1)
  })
})
