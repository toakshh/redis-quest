// Command registry: Map<CANONICAL_NAME, fn> per the spec. Metadata (arity,
// syntax, summary, world, examples) is attached as properties on the fn so
// the map stays a plain Map<string, fn> while the app can introspect docs.

import * as strings from './commands/strings.js'
import * as keys from './commands/keys.js'
import * as hashes from './commands/hashes.js'
import * as lists from './commands/lists.js'
import * as sets from './commands/sets.js'
import * as zsets from './commands/zsets.js'
import * as pubsub from './commands/pubsub.js'
import * as transactions from './commands/transactions.js'
import * as scripting from './commands/scripting.js'
import * as server from './commands/server.js'
import * as acl from './commands/acl.js'
import * as cluster from './commands/cluster.js'
import * as debug from './commands/debug.js'
import * as geo from './commands/geo.js'
import * as streams from './commands/streams.js'

export const registry = new Map()

export function register(name, fn, meta = {}) {
  fn.displayName = name
  fn.arity = meta.arity
  fn.syntax = meta.syntax
  fn.summary = meta.summary
  fn.world = meta.world
  fn.examples = meta.examples || []
  fn.group = meta.group
  registry.set(name, fn)
}

export function registerModule(module, opts = {}) {
  for (const [name, entry] of Object.entries(module)) {
    if (entry && typeof entry === 'function') {
      register(name, entry, opts[name] || {})
    }
  }
}

const groups = [strings, keys, hashes, lists, sets, zsets, pubsub, transactions, scripting, server, acl, cluster, debug, geo, streams]
for (const group of groups) {
  for (const [name, entry] of Object.entries(group)) {
    if (entry && typeof entry === 'function') {
      const meta = entry.meta || {}
      register(name, entry, meta)
    }
  }
}

// The metadata for each command module is carried via `X.meta` on each
// exported fn; we use a helper to attach it at definition time.
export function cmd(meta) {
  return (fn) => {
    fn.meta = meta
    return fn
  }
}

export function commandCount() {
  return registry.size
}

export function listCommands() {
  return [...registry.keys()]
}

export function findCommand(name) {
  return registry.get(String(name).toUpperCase())
}
