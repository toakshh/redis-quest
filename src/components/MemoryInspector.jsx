import { useEffect, useMemo, useRef, useState } from 'react'
import { entryMemoryBytes, formatBytes } from '../engine/datatypes/memory.js'

// Visual metadata per data type — mirrors the cyberpunk palette in index.css.
const TYPE_META = {
  string: { label: 'string', badge: 'border-cyan/40 bg-cyan/10 text-cyan', dot: 'bg-cyan', bar: 'bg-cyan' },
  hash: { label: 'hash', badge: 'border-amber/40 bg-amber/10 text-amber', dot: 'bg-amber', bar: 'bg-amber' },
  list: { label: 'list', badge: 'border-green/40 bg-green/10 text-green', dot: 'bg-green', bar: 'bg-green' },
  set: { label: 'set', badge: 'border-purple/40 bg-purple/10 text-purple', dot: 'bg-purple', bar: 'bg-purple' },
  zset: { label: 'zset', badge: 'border-red/40 bg-red/10 text-red', dot: 'bg-red', bar: 'bg-red' },
  stream: { label: 'stream', badge: 'border-orange-400/40 bg-orange-400/10 text-orange-400', dot: 'bg-orange-400', bar: 'bg-orange-400' },
}

// Deterministic ordering for the "type" sort mode.
const TYPE_RANK = { string: 0, hash: 1, list: 2, set: 3, zset: 4, stream: 5 }

const SORTS = [
  { key: 'mem', label: 'MEM' },
  { key: 'name', label: 'NAME' },
  { key: 'type', label: 'TYPE' },
  { key: 'ttl', label: 'TTL' },
]

// Cardinality / length summary for a key's value.
function entrySummary(entry) {
  switch (entry.type) {
    case 'string':
      return `len ${entry.value.length}`
    case 'hash':
      return `${entry.value.size} ${entry.value.size === 1 ? 'field' : 'fields'}`
    case 'list':
      return `${entry.value.length} ${entry.value.length === 1 ? 'elem' : 'elems'}`
    case 'set':
      return `${entry.value.size} ${entry.value.size === 1 ? 'member' : 'members'}`
    case 'zset':
      return `${entry.value.length} ${entry.value.length === 1 ? 'member' : 'members'}`
    case 'stream':
      return `${entry.value.length} entries`
    default:
      return ''
  }
}

// Snapshot of the active database: key metadata + per-key memory.
function buildSnapshot(engine) {
  const keys = []
  for (const [name, entry] of engine.store) {
    keys.push({
      name,
      type: entry.type,
      expiresAt: entry.expiresAt,
      bytes: entryMemoryBytes(name, entry),
      summary: entrySummary(entry),
    })
  }
  return keys
}

function formatTtl(ms) {
  if (ms <= 0) return 'expired'
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`
  const total = ms / 1000
  if (total < 60) return `${total.toFixed(1)}s`
  const m = Math.floor(total / 60)
  const s = Math.round(total % 60)
  return `${m}m ${s}s`
}

function truncate(name, max = 24) {
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`
}

export default function MemoryInspector({ engine, className = '' }) {
  const [snapshot, setSnapshot] = useState(() => buildSnapshot(engine))
  const [now, setNow] = useState(() => engine.now())
  const [sort, setSort] = useState('mem')
  const [mutatedMap, setMutatedMap] = useState({}) // keyName -> timestamp

  const prevSnapshotRef = useRef(snapshot)

  // Rebuild snapshot & track mutation timestamps for flash animations
  useEffect(() => {
    const refresh = () => {
      const nextSnapshot = buildSnapshot(engine)
      const currentTime = engine.now()
      const prevMap = new Map(prevSnapshotRef.current.map((k) => [k.name, k]))
      const nextMutations = { ...mutatedMap }
      let hasNewMutation = false

      for (const key of nextSnapshot) {
        const prev = prevMap.get(key.name)
        if (!prev || prev.bytes !== key.bytes || prev.summary !== key.summary || prev.type !== key.type) {
          nextMutations[key.name] = currentTime
          hasNewMutation = true
        }
      }

      prevSnapshotRef.current = nextSnapshot
      setSnapshot(nextSnapshot)
      if (hasNewMutation) {
        setMutatedMap(nextMutations)
      }
    }

    const handleCommand = ({ args }) => {
      if (args && args.length > 1) {
        const keyName = String(args[1])
        setMutatedMap((prev) => ({ ...prev, [keyName]: engine.now() }))
      }
    }

    engine.on('change', refresh)
    engine.on('expired', refresh)
    engine.on('command', handleCommand)

    return () => {
      engine.off('change', refresh)
      engine.off('expired', refresh)
      engine.off('command', handleCommand)
    }
  }, [engine, mutatedMap])

  useEffect(() => {
    const timer = setInterval(() => setNow(engine.now()), 250)
    return () => clearInterval(timer)
  }, [engine])

  const keys = snapshot
  // Only keys that haven't lapsed yet, checked against the ticking `now`.
  const visible = keys.filter(
    (key) => key.expiresAt === null || key.expiresAt > now,
  )
  const liveBytes = visible.reduce((sum, key) => sum + key.bytes, 0)

  const sorted = useMemo(() => {
    const list = [...visible]
    switch (sort) {
      case 'mem':
        list.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
        break
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'type':
        list.sort(
          (a, b) =>
            (TYPE_RANK[a.type] ?? 9) - (TYPE_RANK[b.type] ?? 9) ||
            a.name.localeCompare(b.name),
        )
        break
      case 'ttl':
        list.sort(
          (a, b) =>
            (a.expiresAt === null ? Infinity : a.expiresAt) -
              (b.expiresAt === null ? Infinity : b.expiresAt) ||
            a.name.localeCompare(b.name),
        )
        break
      default:
        break
    }
    return list
  }, [visible, sort])

  const usedBytes = engine.memoryBytes
  const limitBytes = engine.memoryLimit
  const pct = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0
  const danger = pct >= 85

  return (
    <div className={`panel flex min-h-0 flex-col ${className}`}>
      {/* Header */}
      <div className="border-b border-edge px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="glow-text text-sm font-bold tracking-widest text-cyan">
              MEM INSPECTOR
            </span>
            <span className="rounded border border-edge px-1 text-[10px] text-dim">
              db{engine.activeDb}
            </span>
          </div>
          <span className="text-[11px] text-dim">
            {sorted.length} {sorted.length === 1 ? 'key' : 'keys'}
          </span>
        </div>

        {/* used_memory vs maxmemory bar */}
        <div className="mt-2">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-dim">used_memory</span>
            <span className={danger ? 'glow-text-red text-red' : 'text-fg'}>
              {formatBytes(usedBytes)}
              <span className="text-dim"> / {formatBytes(limitBytes)}</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel2">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                danger ? 'bg-red shadow-glow-red' : 'bg-cyan shadow-glow'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-1 border-b border-edge px-3 py-1.5">
        <span className="text-[10px] tracking-widest text-dim">SORT</span>
        {SORTS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            aria-pressed={sort === key}
            className={`rounded px-1.5 py-0.5 text-[10px] tracking-wider transition-colors ${
              sort === key
                ? 'border border-cyan/50 bg-cyan/10 text-cyan'
                : 'border border-transparent text-dim hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Key rows */}
      {sorted.length === 0 ? (
        <div className="px-3 py-6 text-center text-[11px] text-dim">
          <p className="mb-1 text-cyan/80">&gt;_ no keys in db{engine.activeDb}</p>
          <p>
            Run <span className="text-cyan">SET</span>, <span className="text-amber">HSET</span>,{' '}
            <span className="text-green">LPUSH</span> or similar to see it here.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-edge/60 overflow-y-auto px-1 py-1">
          {sorted.map((key) => {
            const meta = TYPE_META[key.type] ?? TYPE_META.string
            const ttlMs = key.expiresAt === null ? null : key.expiresAt - now
            const share = liveBytes > 0 ? (key.bytes / liveBytes) * 100 : 0
            const mutatedTime = mutatedMap[key.name]
            const isRecentlyMutated = mutatedTime && now - mutatedTime < 1500

            return (
              <li
                key={key.name}
                data-modified={isRecentlyMutated ? 'true' : 'false'}
                className={`group px-2 py-1.5 transition-all duration-300 ${
                  isRecentlyMutated
                    ? 'bg-cyan-500/20 ring-1 ring-cyan-400/80 border-cyan-500/50 shadow-glow animate-pulse font-semibold'
                    : 'hover:bg-panel2'
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* type badge */}
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] leading-none ${meta.badge}`}
                  >
                    <span className={`h-1 w-1 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  {/* key name */}
                  <span
                    className="min-w-0 flex-1 truncate text-[12px] text-fg flex items-center gap-1"
                    title={key.name}
                  >
                    {truncate(key.name)}
                    {isRecentlyMutated && (
                      <span className="px-1 text-[8px] bg-amber-500/30 text-amber-300 rounded border border-amber-500/40 uppercase tracking-widest font-mono">
                        ⚡ MUTATED
                      </span>
                    )}
                  </span>
                  {/* cardinality */}
                  <span className="hidden shrink-0 text-[10px] text-dim sm:inline">
                    {key.summary}
                  </span>
                  {/* ttl countdown */}
                  <span
                    className={`shrink-0 text-[10px] tabular-nums ${
                      ttlMs === null
                        ? 'text-dim/70'
                        : ttlMs <= 0
                          ? 'glow-text-red text-red'
                          : ttlMs < 5000
                            ? 'text-amber'
                            : 'text-green'
                    }`}
                  >
                    {ttlMs === null ? '∞ ttl' : `⏳ ${formatTtl(ttlMs)}`}
                  </span>
                  {/* memory */}
                  <span className="shrink-0 text-[10px] tabular-nums text-cyan/90">
                    {formatBytes(key.bytes)}
                  </span>
                </div>
                {/* per-key share of this db's memory */}
                <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-panel2/80">
                  <div
                    className={`h-full ${meta.bar}`}
                    style={{ width: `${Math.max(share, key.bytes > 0 ? 1.5 : 0)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-edge px-3 py-1.5 text-[10px] text-dim">
        <span>db{engine.activeDb} live</span>
        <span className="tabular-nums">{formatBytes(liveBytes)}</span>
      </div>
    </div>
  )
}
