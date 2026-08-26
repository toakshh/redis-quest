import { use3DGameStore } from '../../stores/use3DGameStore'

// BGSAVE-style snapshot system for time-loop rollback
// Serializes the MockRedisEngine RDB + 3D game state

export class LoopSnapshotSystem {
  constructor(engine) {
    this.engine = engine
    this.snapshots = new Map() // loop number -> snapshot
    this.maxSnapshots = 7
  }

  // Create a full snapshot at loop start
  createSnapshot(loopNumber) {
    const rdb = this.engine.save()
    const state = use3DGameStore.getState()

    const snapshot = {
      loop: loopNumber,
      timestamp: Date.now(),
      rdb,
      // 3D state that persists across loops
      retainedSkills: state.loop.retainedSkills,
      retainedTerminalHistory: state.loop.retainedTerminalHistory,
      branchingFlags: { ...state.loop.branchingFlags },
      anomaliesSeen: { ...state.loop.anomaliesSeen },
      sanityBaseline: state.loop.sanityBaseline,
      // Player progression that carries over
      unlockedAchievements: state.player.inventory.filter(i => i.type === 'relic').map(i => i.id),
    }

    this.snapshots.set(loopNumber, snapshot)

    // Cleanup old snapshots
    if (this.snapshots.size > this.maxSnapshots) {
      const oldest = Math.min(...this.snapshots.keys())
      this.snapshots.delete(oldest)
    }

    return snapshot
  }

  // Restore from a snapshot (on death/rollback)
  restoreSnapshot(loopNumber) {
    const snapshot = this.snapshots.get(loopNumber)
    if (!snapshot) {
      console.warn(`No snapshot found for loop ${loopNumber}`)
      return null
    }

    // Restore engine state
    this.engine.restore(snapshot.rdb)

    return snapshot
  }

  // Get the most recent snapshot (for auto-rollback)
  getLatestSnapshot() {
    const latest = Math.max(...this.snapshots.keys())
    return this.snapshots.get(latest)
  }

  // Get snapshot for a specific loop
  getSnapshot(loopNumber) {
    return this.snapshots.get(loopNumber)
  }

  // Clear all snapshots (new game)
  clear() {
    this.snapshots.clear()
  }

  // Export for save/load
  export() {
    return Array.from(this.snapshots.entries()).map(([loop, snap]) => ({
      loop,
      timestamp: snap.timestamp,
      rdb: snap.rdb, // RDB is already a serializable object
      retainedSkills: snap.retainedSkills,
      retainedTerminalHistory: snap.retainedTerminalHistory,
      branchingFlags: snap.branchingFlags,
      anomaliesSeen: snap.anomaliesSeen,
      sanityBaseline: snap.sanityBaseline,
    }))
  }

  // Import from export
  import(data) {
    this.snapshots.clear()
    data.forEach(snap => {
      this.snapshots.set(snap.loop, snap)
    })
  }
}

// React hook for using the snapshot system
export function useLoopSnapshots(engine) {
  const store = use3DGameStore

  const createSnapshot = (loopNumber) => {
    if (!engine) return null
    const system = new LoopSnapshotSystem(engine)
    return system.createSnapshot(loopNumber)
  }

  const restoreSnapshot = (loopNumber) => {
    if (!engine) return null
    const system = new LoopSnapshotSystem(engine)
    return system.restoreSnapshot(loopNumber)
  }

  return { createSnapshot, restoreSnapshot }
}

// Auto-save terminal history to loop state
export function persistTerminalHistory() {
  const state = use3DGameStore.getState()
  const history = state.terminal.history.slice(-50) // Keep last 50 commands
  store.loop.retainedTerminalHistory = [
    ...new Set([
      ...store.loop.retainedTerminalHistory,
      ...history.map(h => h.line),
    ]),
  ].slice(-100)
}

// Called on loop rollback to restore terminal history
export function restoreTerminalHistory() {
  const state = use3DGameStore.getState()
  state.terminal.history = state.loop.retainedTerminalHistory.map(line => ({
    line,
    reply: '[LOOP RESTORED]',
    ts: Date.now(),
  }))
}