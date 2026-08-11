// Deterministic random helpers.
//
// Redis Quest's engine must be deterministic: same seed + same command
// sequence = identical state. Real randomness (Math.random) leaks in through
// RANDOMKEY and the zset skip-list heights, so we funnel non-determinism
// through this module and let callers inject a seeded PRNG.
//
// 7th-grade analogy: a seeded RNG is a shuffled deck of cards — deal the
// same deck in the same order and you always get the same hand.

// mulberry32 — a tiny, fast, well-distributed PRNG returning floats in [0, 1).
// Deterministic for a given integer seed.
export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Hash a string to a stable 32-bit integer (FNV-1a). Used to derive
// deterministic world positions from Redis key names.
export function hash32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// Create a deterministic PRNG factory. Pass a seed and get back a
// `random()` function; pass nothing and get Math.random.
export function createRng(seed) {
  if (seed === undefined || seed === null) return Math.random
  const next = mulberry32(hash32(String(seed)))
  // Interleave calls so two seeded rngs drift apart immediately.
  let calls = 0
  return function random() {
    if (calls++ % 2 === 0) return next()
    return next()
  }
}
