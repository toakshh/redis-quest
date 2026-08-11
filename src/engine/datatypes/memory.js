// Memory estimator — approximates Redis `used_memory` by modeling the
// per-structure overhead Redis pays for. These constants are documented
// estimates of redisObject + dictEntry + sds + structure overhead; they are
// deliberately simple so the game's memory bar is a *tension mechanic* and
// the tests are deterministic.
//
// Overhead model (bytes):
//   KEY_ENTRY    48   per key (dictEntry + key sds + redisObject header)
//   STRING_VALUE  0   value bytes only (len is charged)
//   HASH_FIELD   64   per field (dictEntry + field sds + value redisObject)
//   LIST_NODE    56   per element (listNode + value redisObject + sds hdr)
//   SET_MEMBER   56   per member (dictEntry + member sds + redisObject)
//   ZSET_NODE   128   per member (skiplist levels + zsetObject + dictEntry)
//   ZSET_SCORE   16   extra for the score double itself (conservative)
//
// `used_memory` = sum over keys of KEY_ENTRY + structure bytes.
// Long strings > 64 bytes are embeeded/dict-charged differently in real
// Redis; we simplify: everything above counts value bytes.

export const MEMORY_CONSTANTS = {
  KEY_ENTRY: 48,
  HASH_FIELD: 64,
  LIST_NODE: 56,
  SET_MEMBER: 56,
  ZSET_NODE: 128,
  ZSET_SCORE: 16,
  DEFAULT_MEMORY_LIMIT: 10 * 1024 * 1024, // 10 MB default "maxmemory"
}

// UTF-8 byte length (surrogates -> 3 bytes, astral -> 4).
export function utf8Bytes(str) {
  let bytes = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.codePointAt(i)
    if (c <= 0x7f) bytes += 1
    else if (c <= 0x7ff) bytes += 2
    else if (c <= 0xffff) bytes += 3
    else {
      bytes += 4
      i++
    }
  }
  return bytes
}

export function stringBytes(value) {
  return typeof value === 'number' ? utf8Bytes(String(value)) : utf8Bytes(String(value))
}

export function hashBytes(dict) {
  let total = 0
  for (const [f, v] of dict.entries()) {
    total += MEMORY_CONSTANTS.HASH_FIELD + stringBytes(f) + stringBytes(v)
  }
  return total
}

export function listBytes(list) {
  let total = 0
  for (const node of list.toArray()) {
    total += MEMORY_CONSTANTS.LIST_NODE + stringBytes(node.value)
  }
  return total
}

export function setBytes(set) {
  let total = 0
  for (const member of set) {
    total += MEMORY_CONSTANTS.SET_MEMBER + stringBytes(member)
  }
  return total
}

export function zsetBytes(skiplist) {
  let total = 0
  for (const node of skiplist.toArray()) {
    total += MEMORY_CONSTANTS.ZSET_NODE + MEMORY_CONSTANTS.ZSET_SCORE + stringBytes(node.member)
  }
  return total
}

// Memory used by a single value (no key overhead). Deterministic.
export function valueMemoryBytes(type, value) {
  switch (type) {
    case 'string':
      return stringBytes(value)
    case 'hash':
      return hashBytes(value)
    case 'list':
      return listBytes(value)
    case 'set':
      return setBytes(value)
    case 'zset':
      return zsetBytes(value)
    default:
      return 0
  }
}

// Full per-key memory including the key-entry overhead.
export function entryMemoryBytes(name, entry) {
  return MEMORY_CONSTANTS.KEY_ENTRY + valueMemoryBytes(entry.type, entry.value)
}

// Total used_memory across all non-expired keys in a store Map.
export function totalMemoryBytes(store) {
  let total = 0
  for (const [name, entry] of store) {
    total += entryMemoryBytes(name, entry)
  }
  return total
}

// Human-friendly bytes.
export function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
