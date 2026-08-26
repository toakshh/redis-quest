// Spatial hash — a 2D uniform grid over X/Z for broad-phase proximity queries.
// Sim layer: no three.js, no react, no DOM, no Date.now, no Math.random.
// Y is ignored: Protocol Zero's levels are floor-based, so proximity is a
// planar question. Allocation discipline (Law L10): the cell arrays are reused
// across rebuilds via length-reset, never recreated, and queryRadius fills a
// caller-supplied outArray so a hot query loop allocates nothing.

const CELL_X_PRIME = 73856093
const CELL_Z_PRIME = 19349663

export function createSpatialHash(cellSize = 4) {
  // Map<cellKey:number, number[]>. The arrays are pooled: on rebuild we set
  // each existing array's length to 0 (keeping its backing store) rather than
  // dropping the array and letting a fresh one be allocated.
  const cells = new Map()

  function cellKey(cellX, cellZ) {
    // Bitwise xor of the two primed coordinates. `| 0` keeps it a 32-bit int
    // so the Map keys stay in small-integer space.
    return ((cellX * CELL_X_PRIME) ^ (cellZ * CELL_Z_PRIME)) | 0
  }

  function cellCoord(v) {
    return Math.floor(v / cellSize)
  }

  const hash = {
    cellSize,
    cells,

    // Clear every pooled cell array (length reset, not delete) then reinsert
    // every alive entity by its X/Z. Keeps the Map entries around so their
    // arrays can be reused next frame.
    rebuild(entityStore) {
      for (const arr of cells.values()) arr.length = 0
      const { posX, posZ } = entityStore
      // Queries read live positions from the store, so we keep references to
      // the current backing arrays here rather than copying coordinates.
      this._posX = posX
      this._posZ = posZ
      entityStore.forEachAlive((id) => {
        const key = cellKey(cellCoord(posX[id]), cellCoord(posZ[id]))
        let bucket = cells.get(key)
        if (bucket === undefined) {
          bucket = []
          cells.set(key, bucket)
        }
        bucket.push(id)
      })
    },

    // Fill outArray with the ids of entities within `radius` of (x, z).
    // Returns the count. Never allocates: writes into the caller's array and
    // returns how many slots are valid.
    queryRadius(x, z, radius, outArray) {
      const posX = this._posX
      const posZ = this._posZ
      if (posX === undefined) return 0
      const r2 = radius * radius
      const minCX = cellCoord(x - radius)
      const maxCX = cellCoord(x + radius)
      const minCZ = cellCoord(z - radius)
      const maxCZ = cellCoord(z + radius)
      let count = 0
      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const bucket = cells.get(cellKey(cx, cz))
          if (bucket === undefined) continue
          for (let i = 0; i < bucket.length; i++) {
            const id = bucket[i]
            const dx = posX[id] - x
            const dz = posZ[id] - z
            if (dx * dx + dz * dz <= r2) {
              outArray[count++] = id
            }
          }
        }
      }
      return count
    },

    // Return the id of the nearest entity within maxRadius passing filterFn,
    // or -1 if none. filterFn(id) may be null to accept everything.
    queryNearest(x, z, maxRadius, filterFn) {
      const posX = this._posX
      const posZ = this._posZ
      if (posX === undefined) return -1
      const r2 = maxRadius * maxRadius
      const minCX = cellCoord(x - maxRadius)
      const maxCX = cellCoord(x + maxRadius)
      const minCZ = cellCoord(z - maxRadius)
      const maxCZ = cellCoord(z + maxRadius)
      let best = -1
      let bestD2 = r2
      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const bucket = cells.get(cellKey(cx, cz))
          if (bucket === undefined) continue
          for (let i = 0; i < bucket.length; i++) {
            const id = bucket[i]
            if (filterFn && !filterFn(id)) continue
            const dx = posX[id] - x
            const dz = posZ[id] - z
            const d2 = dx * dx + dz * dz
            if (d2 <= bestD2) {
              bestD2 = d2
              best = id
            }
          }
        }
      }
      return best
    },
  }

  return hash
}
