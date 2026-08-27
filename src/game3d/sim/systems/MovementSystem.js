// MovementSystem — integrates velocity into position for every alive entity.
// Sim layer: no three.js, no react, no DOM, no allocation in the hot loop.
//
// Order of operations per entity, per tick:
//   1. Save the current position into prevX/Y/Z (the view interpolates
//      between prev and current for smooth rendering between fixed ticks).
//   2. Apply gravity to vertical velocity.
//   3. For the player: apply yaw and key inputs to update velocity via player-specific
//      friction and acceleration. For other entities: apply standard ground friction.
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

        if (id === world.playerId) {
          const k = world.playerInputs || { fwd: false, back: false, left: false, right: false, sprint: false }
          const yaw = world.playerYaw ?? 0
          const dead = world.playerHealth01 <= 0

          let ix = 0
          let iz = 0
          if (!dead) {
            if (k.fwd) iz -= 1
            if (k.back) iz += 1
            if (k.left) ix -= 1
            if (k.right) ix += 1
          }

          const sin = Math.sin(yaw)
          const cos = Math.cos(yaw)

          let moveX = ix * cos + iz * sin
          let moveZ = -ix * sin + iz * cos
          const moveLen = Math.hypot(moveX, moveZ)
          if (moveLen > 1) {
            moveX /= moveLen
            moveZ /= moveLen
          }
          const hasInput = moveLen > 0.01

          const maxSpeed = k.sprint ? FEEL.move.sprintSpeed : FEEL.move.walkSpeed
          const isGrounded = world.grounded && world.grounded[id] === 1
          const accel = isGrounded ? FEEL.move.groundAccel : FEEL.move.groundAccel * FEEL.move.airControl
          const pFriction = isGrounded ? FEEL.move.groundFriction : 0

          // Apply player-specific friction
          const currentSpeed = Math.hypot(velX[id], velZ[id])
          if (currentSpeed > 0) {
            const drop = currentSpeed * pFriction * dt
            const newSpeed = Math.max(currentSpeed - drop, 0)
            velX[id] *= (newSpeed / currentSpeed)
            velZ[id] *= (newSpeed / currentSpeed)
          }

          // Apply player-specific acceleration
          if (hasInput) {
            const projVel = velX[id] * moveX + velZ[id] * moveZ
            const addSpeed = maxSpeed - projVel
            if (addSpeed > 0) {
              const accelAmount = Math.min(addSpeed, accel * dt * maxSpeed)
              velX[id] += moveX * accelAmount
              velZ[id] += moveZ * accelAmount
            }
          }
        } else {
          // 3. Ground friction on the horizontal plane.
          velX[id] *= keep
          velZ[id] *= keep
        }

        // 4. Integrate position.
        posX[id] += velX[id] * dt
        posY[id] += velY[id] * dt
        posZ[id] += velZ[id] * dt
      }
    },
  }
}
