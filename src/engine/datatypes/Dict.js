// Dict — Map-backed hashtable used for Redis hashes (and as the member
// index inside the skip list). Values are strings (hash fields map to
// string values), but the class itself is generic.
//
// The `bucketCount` is derived so the Memory Inspector can render the
// hash's dict buckets authentically (like redis-cli `DEBUG OBJECT` shows
// `encoding:listpack` / `encoding:hashtable`). We model a power-of-two
// bucket array sized to load factor ~1.

export class Dict {
  constructor(initialSize = 4) {
    this.map = new Map()
    this._size = initialSize
  }

  static from(entries) {
    const d = new Dict()
    for (const [k, v] of entries) d.set(k, v)
    return d
  }

  get size() {
    return this.map.size
  }

  get bucketCount() {
    // grow the bucket array as the load factor approaches 1
    let b = this._size
    while (this.map.size >= b) b *= 2
    return b
  }

  // simple hash for bucket visualization (stable across keys)
  hash(key) {
    const s = String(key)
    let h = 5381
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) | 0
    }
    return Math.abs(h)
  }

  bucket(key) {
    return this.hash(key) % this.bucketCount
  }

  get(key) {
    return this.map.get(String(key))
  }

  has(key) {
    return this.map.has(String(key))
  }

  set(key, value) {
    this.map.set(String(key), value)
  }

  delete(key) {
    return this.map.delete(String(key))
  }

  clear() {
    this.map.clear()
  }

  keys() {
    return [...this.map.keys()]
  }

  values() {
    return [...this.map.values()]
  }

  entries() {
    return [...this.map.entries()]
  }
}
