import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { MockRedisEngine } from '../../engine/engine'

const EngineContext = createContext(null)

export function Mode3DEngineProvider({ children, initialKeys = {} }) {
  const [engine] = useState(() => new MockRedisEngine())
  const [ready, setReady] = useState(false)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    // Initialize with any starting keys for 3D mode
    Object.entries(initialKeys).forEach(([key, value]) => {
      if (typeof value === 'string') {
        engine.execute(`SET ${key} ${value}`)
      } else if (value.type === 'list') {
        value.items.forEach(item => engine.execute(`RPUSH ${key} ${item}`))
      } else if (value.type === 'hash') {
        Object.entries(value.fields).forEach(([field, val]) => {
          engine.execute(`HSET ${key} ${field} ${val}`)
        })
      } else if (value.type === 'zset') {
        Object.entries(value.members).forEach(([member, score]) => {
          engine.execute(`ZADD ${key} ${score} ${member}`)
        })
      } else if (value.type === 'stream') {
        value.entries.forEach(entry => {
          const fields = Object.entries(entry).flat().join(' ')
          engine.execute(`XADD ${key} * ${fields}`)
        })
      }
    })

    // Set up mission-critical keys that the 3D world reads
    engine.execute('SET api:gate:mode locked')
    engine.execute('SET shield:status inactive')
    engine.execute('SET shield:power 0')
    engine.execute('SET environment:corruption 0')
    engine.execute('SET power:state online')

    setReady(true)
  }, [engine, initialKeys])

  // Expose save/restore for loop snapshots
  const saveSnapshot = () => engine.save()
  const restoreSnapshot = (rdb) => engine.restore(rdb)

  const value = useMemo(() => ({
    engine,
    ready,
    saveSnapshot,
    restoreSnapshot,
  }), [engine, ready])

  return (
    <EngineContext.Provider value={value}>
      {children}
    </EngineContext.Provider>
  )
}

export function use3DEngine() {
  const ctx = useContext(EngineContext)
  if (!ctx) {
    throw new Error('use3DEngine must be used within Mode3DEngineProvider')
  }
  return ctx
}