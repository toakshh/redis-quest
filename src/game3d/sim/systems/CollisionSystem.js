// CollisionSystem — resolves every entity against the level's static boxes.
// Runs at SYSTEM_ORDER.PHYSICS_SYNC, immediately after MovementSystem has
// integrated positions, so it corrects penetration in the same tick it occurs.
//
// Sim layer: no three.js, no react, no DOM. Deliberately NOT Rapier: physics
// that runs inside the deterministic sim must produce bit-identical results
// from the same seed and input log (the Phase 2 gate), and a WASM solver with
// its own internal state does not. Levels here are floor-and-wall boxes, so
// an upright-cylinder-vs-AABB resolver is both sufficient and exactly
// reproducible.
//
// Bodies are upright cylinders (radius, height) with the origin at the FEET,
// matching how the entity store's posY is used everywhere else.

import { SYSTEM_ORDER } from '../SimWorld.js'
import { BODY_RADIUS, BODY_HEIGHT } from '../entity/archetypes.js'
import { MAX_ENTITIES } from '../entity/EntityStore.js'

// How far above a surface an entity can be and still be snapped down onto it.
// Prevents a fast-falling body from tunnelling through a floor in one tick.
const SNAP_DOWN_M = 0.35

// Convert the level manifest's Rapier-style cuboid list ({ args: half-extents,
// position: centre }) into flat min/max bounds. Done once at construction so
// the per-tick loop reads a packed Float32Array with no object dereferencing.
export function boxesFromColliders(colliders) {
  const out = new Float32Array(colliders.length * 6)
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i]
    const [hx, hy, hz] = c.args
    const [cx, cy, cz] = c.position || [0, 0, 0]
    const o = i * 6
    out[o] = cx - hx
    out[o + 1] = cy - hy
    out[o + 2] = cz - hz
    out[o + 3] = cx + hx
    out[o + 4] = cy + hy
    out[o + 5] = cz + hz
  }
  return out
}

export function createCollisionSystem({ colliders = [], capacity = MAX_ENTITIES } = {}) {
  const boxes = boxesFromColliders(colliders)
  const boxCount = colliders.length

  // Pre-allocated once (Law L10). grounded[id] = 1 when the entity is standing
  // on something this tick; the player controller reads it to allow jumping.
  const grounded = new Uint8Array(capacity)

  return {
    name: 'collision',
    order: SYSTEM_ORDER.PHYSICS_SYNC,
    grounded,
    boxes,
    boxCount,

    update(world) {
      const e = world.entities
      const { alive, archetype, posX, posY, posZ, prevY, velY } = e

      for (let id = 0; id < e.capacity; id++) {
        if (alive[id] === 0) continue

        const r = BODY_RADIUS[archetype[id]] ?? 0.4
        const h = BODY_HEIGHT[archetype[id]] ?? 1.8
        let x = posX[id]
        let y = posY[id]
        let z = posZ[id]
        let onGround = 0

        // --- Pass 1: vertical. Find the highest surface directly beneath the
        // body's footprint that we are at or just above, and rest on it.
        for (let b = 0; b < boxCount; b++) {
          const o = b * 6
          const minX = boxes[o], minY = boxes[o + 1], minZ = boxes[o + 2]
          const maxX = boxes[o + 3], maxY = boxes[o + 4], maxZ = boxes[o + 5]

          // Footprint must overlap the box in the XZ plane.
          if (x + r < minX || x - r > maxX) continue
          if (z + r < minZ || z - r > maxZ) continue

          // Landing. Two ways to qualify, and the distinction matters: a body
          // merely being *inside* a box's y-range is NOT one of them, or a
          // player standing beside a 10m wall would be snapped to its roof.
          //   a) Swept: the feet were at or above the top face last tick and
          //      are at or below it now — this catches fast falls that would
          //      otherwise tunnel clean through a thin floor.
          //   b) Resting: the feet are already within snap range of the top
          //      face, which recovers small penetration without teleporting.
          if (velY[id] <= 0 && y <= maxY + SNAP_DOWN_M) {
            const swept = prevY[id] >= maxY - 0.001
            const resting = y >= maxY - SNAP_DOWN_M
            if (swept || resting) {
              y = maxY
              velY[id] = 0
              onGround = 1
            }
          } else if (velY[id] > 0 && y + h > minY && y + h < maxY) {
            // Head strike on the underside of a box: stop the ascent.
            y = minY - h
            velY[id] = 0
          }
        }

        // --- Pass 2: horizontal. Push the cylinder out of any box it still
        // overlaps, along the shortest axis. Runs after the vertical pass so
        // standing on a floor is not mistaken for penetrating its side.
        for (let b = 0; b < boxCount; b++) {
          const o = b * 6
          const minX = boxes[o], minY = boxes[o + 1], minZ = boxes[o + 2]
          const maxX = boxes[o + 3], maxY = boxes[o + 4], maxZ = boxes[o + 5]

          // Vertical spans must actually overlap, with a small tolerance so
          // resting exactly on a floor does not register as a side hit.
          if (y + h <= minY + 0.001 || y >= maxY - 0.001) continue

          // Closest point on the box's XZ rectangle to the cylinder centre.
          const cx = x < minX ? minX : x > maxX ? maxX : x
          const cz = z < minZ ? minZ : z > maxZ ? maxZ : z
          const dx = x - cx
          const dz = z - cz
          const d2 = dx * dx + dz * dz

          if (d2 >= r * r) continue

          if (d2 > 1e-8) {
            // Outside the rect but within the radius: push straight out along
            // the surface normal.
            const d = Math.sqrt(d2)
            const push = (r - d) / d
            x += dx * push
            z += dz * push
          } else {
            // Centre is inside the rect — pick the nearest face and eject.
            const toMinX = x - minX
            const toMaxX = maxX - x
            const toMinZ = z - minZ
            const toMaxZ = maxZ - z
            let best = toMinX
            let axis = 0
            if (toMaxX < best) { best = toMaxX; axis = 1 }
            if (toMinZ < best) { best = toMinZ; axis = 2 }
            if (toMaxZ < best) { best = toMaxZ; axis = 3 }
            if (axis === 0) x = minX - r
            else if (axis === 1) x = maxX + r
            else if (axis === 2) z = minZ - r
            else z = maxZ + r
          }
        }

        posX[id] = x
        posY[id] = y
        posZ[id] = z
        grounded[id] = onGround
      }
    },
  }
}
