// LatencySystem — makes command cost *felt*. When a single command costs more
// than the stall threshold (a big DEL, a fat EVAL), the frame hitches for real
// by parking world.stallUntilMs in the future. It also tracks a p99 latency
// estimate over the last 100 commands, which REX uses to degrade its tone as
// the server gets sicker.
//
// Sim layer: no three.js, no react, no DOM. Allocation-free hot path (the p99
// scratch buffer is allocated once).

import { SYSTEM_ORDER } from '../SimWorld.js'

export const STALL_THRESHOLD_MS = 8
const WINDOW = 100

export function createLatencySystem() {
  const samples = new Float64Array(WINDOW)
  const scratch = new Float64Array(WINDOW)
  let count = 0 // how many samples recorded so far (caps at WINDOW)
  let head = 0 // next write index in the ring
  let lastSeq = -1 // engine.commandSeq of the last command we recorded

  function recordSample(costMs) {
    samples[head] = costMs
    head = (head + 1) % WINDOW
    if (count < WINDOW) count += 1
  }

  function computeP99() {
    if (count === 0) return 0
    for (let i = 0; i < count; i++) scratch[i] = samples[i]
    // Insertion sort over the (≤100) live samples — no allocation.
    for (let i = 1; i < count; i++) {
      const v = scratch[i]
      let j = i - 1
      while (j >= 0 && scratch[j] > v) {
        scratch[j + 1] = scratch[j]
        j--
      }
      scratch[j + 1] = v
    }
    const idx = Math.min(count - 1, Math.ceil(0.99 * count) - 1)
    return scratch[Math.max(0, idx)]
  }

  return {
    name: 'latency',
    order: SYSTEM_ORDER.LATENCY,

    update(world) {
      const engine = world.engine
      // Only record when a genuinely new command has executed since last tick,
      // so an idle tick does not re-count the previous command's cost.
      if (engine.commandSeq !== lastSeq) {
        lastSeq = engine.commandSeq
        const costMs = engine.lastCommandCostMs
        recordSample(costMs)
        if (costMs > STALL_THRESHOLD_MS) {
          world.stallUntilMs = world.clock() + costMs
        }
        world.latencyP99Ms = computeP99()
      }
    },
  }
}
