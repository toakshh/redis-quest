// MovementSystem — integrates velocity into position for every alive entity.
// Sim layer: no three.js, no react, no DOM, no allocation in the hot loop.
//
// Order of operations per entity, per tick:
//   1. Save the current position into prevX/Y/Z (the view interpolates
//      between prev and current for smooth rendering between fixed ticks).
//   2. Apply gravity to vertical velocity.
//   3. Apply ground friction to horizontal velocity (exponential decay).
//   4. Integrate: position += velocity * dt.

import { FEEL } from '../../config/feel.js'
import { SYSTEM_ORDER } from '../SimWorld.js'
import { FLAGS } from '../entity/EntityStore.js'

export function createMovementSystem() {
  const gravity = FEEL.move.gravity
  const friction = FEEL.move.groundFriction

  return {
    name: 'movement',
    order: SYSTEM_ORDER.MOVEMENT,
    update(world, dt) {
      if (dt <= 0) return
      const e = world.entities
      const { alive, posX, posY, posZ, velX, velY, velZ, prevX, prevY, prevZ, flags } = e
      // Exponential friction factor: velocity retains this fraction each tick.
      // Clamped at 0 so a large dt can't flip the sign of the velocity.
      const keep = Math.max(0, 1 - friction * dt)
      for (let id = 0; id < e.capacity; id++) {
        if (alive[id] === 0) continue

        // 1. Record previous position before we move.
        prevX[id] = posX[id]
        prevY[id] = posY[id]
        prevZ[id] = posZ[id]

        // A BLOCKED entity (e.g. held behind a closed API gate) does not move,
        // but its prev/current still get synced above so it renders stationary.
        if ((flags[id] & FLAGS.BLOCKED) !== 0) continue

        // 2. Gravity on the vertical axis.
        velY[id] += gravity * dt

        // 3. Ground friction on the horizontal plane.
        velX[id] *= keep
        velZ[id] *= keep

        // 4. Integrate position.
        posX[id] += velX[id] * dt
        posY[id] += velY[id] * dt
        posZ[id] += velZ[id] * dt
      }
    },
  }
}
