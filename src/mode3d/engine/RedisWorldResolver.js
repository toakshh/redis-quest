import { WorldStateResolver } from '../../systems/consequences/WorldStateResolver'

export class RedisWorldResolver extends WorldStateResolver {
  constructor(engine) {
    super()
    this.engine = engine
    this._lastCorruption = 0
  }

  // Extend with 3D-specific entity resolution

  resolveDoorState(doorId) {
    const key = `door:${doorId}`
    const entry = this.engine._get(key)
    if (!entry || entry.wrongType) return { locked: true, open: false, key: null }
    try {
      return JSON.parse(entry.value)
    } catch {
      return { locked: true, open: false, key: null }
    }
  }

  resolveCorruptionState() {
    const entry = this.engine._get('environment:corruption')
    const val = entry && !entry.wrongType ? parseInt(entry.value, 10) : 0
    this._lastCorruption = val
    return {
      level: Math.min(100, Math.max(0, val)),
      isCritical: val >= 80,
      isHigh: val >= 50,
    }
  }

  resolveAnomalyShield(anomalyId) {
    const key = `anomaly:${anomalyId}:shield`
    const entry = this.engine._get(key)
    if (!entry || entry.wrongType) return { active: false, hp: 0, maxHp: 100 }
    try {
      return JSON.parse(entry.value)
    } catch {
      return { active: false, hp: 0, maxHp: 100 }
    }
  }

  resolvePowerState() {
    const entry = this.engine._get('power:state')
    if (!entry || entry.wrongType) return 'online'
    return entry.value
  }

  resolveRoomCorruption(roomId) {
    const key = `room:${roomId}:corruption`
    const entry = this.engine._get(key)
    if (!entry || entry.wrongType) return 0
    return Math.min(100, Math.max(0, parseInt(entry.value, 10)))
  }

  // Called each frame to sync engine state → 3D store
  syncToStore(store) {
    const gate = this.getApiGateState()
    const shield = this.getShieldExpiry('shield:main')
    const queue = this.getQueue('queue:orders')
    const corruption = this.resolveCorruptionState()
    const power = this.resolvePowerState()

    store.setRoomState('gate', { isLocked: gate.mode === 'locked', isOpen: gate.mode === 'open' })
    if (shield) {
      store.setRoomState('shield', { active: !shield.isExpired, progress: shield.progress })
    }
    store.setRoomState('queue', { length: queue.length, items: queue })
    store.environment.globalCorruption = corruption.level
    store.setPowerState(power)
  }
}

export function createRedisWorldResolver(engine) {
  return new RedisWorldResolver(engine)
}