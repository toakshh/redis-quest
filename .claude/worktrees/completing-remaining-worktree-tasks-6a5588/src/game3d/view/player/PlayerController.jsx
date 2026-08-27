import React, { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSim } from '../SimProvider.jsx'
import { FEEL } from '../../config/feel.js'
import { PLAYER_EYE_HEIGHT } from '../../sim/entity/archetypes.js'
import { FLAGS } from '../../sim/entity/EntityStore.js'

// The player's hands on the world: pointer-lock mouse look, WASD, sprint,
// jump, and a hitscan weapon.
//
// Horizontal motion is applied as a direct position delta rather than through
// velX/velZ. MovementSystem applies ground friction to velocity every tick,
// which is right for AI steering but would make player input feel like ice.
// Vertical motion still goes through velY so gravity, jumping and the
// CollisionSystem's swept landing all behave normally.

const KEY_BINDS = {
  KeyW: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
}

const PITCH_LIMIT = Math.PI / 2 - 0.02
const MOUSE_SENSITIVITY = 0.0022
const FIRE_COOLDOWN_S = 0.18
const WEAPON_RANGE_M = 26
const WEAPON_DAMAGE = 1
// How wide a cone counts as "on target". cos(12°) — forgiving enough to be
// fair with a mouse, tight enough that spraying at a wall does nothing.
const AIM_DOT_MIN = Math.cos(0.21)

// `active` means the player has entered the game and input should be live.
// `locked` means the browser granted pointer lock. They are separate on
// purpose: pointer lock can be refused (an iframe without allow-pointer-lock,
// a hardened profile, an automation harness), and when it is, the game must
// still be playable — look then falls back to right-button drag rather than
// leaving the player stuck behind a veil.
export default function PlayerController({ active, locked, onFire }) {
  const { world } = useSim()
  const { camera } = useThree()

  const keys = useRef({ fwd: false, back: false, left: false, right: false, sprint: false, jump: false })
  // Initial facing comes from the level's player_start rotation rather than a
  // constant, so the level author decides which way the player looks when the
  // chapter opens. yaw 0 looks down -Z, matching three.js camera convention.
  const look = useRef({ yaw: initialYaw(world), pitch: 0 })
  const bobPhase = useRef(0)
  const fireTimer = useRef(0)
  const wantFire = useRef(false)
  // Scratch for spatial queries — allocated once, never per frame.
  const nearby = useRef(new Int32Array(64))

  // --- Input listeners. Bound to window so they survive the pointer moving
  // between the canvas and the HUD overlay.
  const dragging = useRef(false)

  useEffect(() => {
    if (!active) return

    function onKeyDown(e) {
      const bind = KEY_BINDS[e.code]
      if (bind) { keys.current[bind] = true; return }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.current.sprint = true
      if (e.code === 'Space') { keys.current.jump = true; e.preventDefault() }
    }
    function onKeyUp(e) {
      const bind = KEY_BINDS[e.code]
      if (bind) { keys.current[bind] = false; return }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.current.sprint = false
      if (e.code === 'Space') keys.current.jump = false
    }
    function onMouseMove(e) {
      // Pointer-locked: every mouse motion is look. Unlocked: only while the
      // right button is held, so the cursor stays usable for the HUD.
      if (!locked && !dragging.current) return
      look.current.yaw -= e.movementX * MOUSE_SENSITIVITY
      look.current.pitch -= e.movementY * MOUSE_SENSITIVITY
      if (look.current.pitch > PITCH_LIMIT) look.current.pitch = PITCH_LIMIT
      if (look.current.pitch < -PITCH_LIMIT) look.current.pitch = -PITCH_LIMIT
    }
    function onMouseDown(e) {
      if (e.button === 0) wantFire.current = true
      if (e.button === 2 && !locked) dragging.current = true
    }
    function onMouseUp(e) {
      if (e.button === 0) wantFire.current = false
      if (e.button === 2) dragging.current = false
    }
    function onContextMenu(e) {
      // Right-drag look would otherwise be interrupted by the context menu.
      e.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('contextmenu', onContextMenu)
    }
  }, [active, locked])

  // Going inactive must also release the keys, or the player keeps sprinting
  // into a wall while typing a command.
  useEffect(() => {
    if (active) return
    dragging.current = false
    keys.current.fwd = keys.current.back = keys.current.left = keys.current.right = false
    keys.current.sprint = keys.current.jump = false
    wantFire.current = false
  }, [active])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    const e = world.entities
    const id = world.playerId
    if (id == null || id < 0 || e.alive[id] === 0) return

    const dead = world.playerHealth01 <= 0
    const k = keys.current

    // --- Horizontal movement, relative to where the player is looking.
    let ix = 0
    let iz = 0
    if (k.fwd) iz -= 1
    if (k.back) iz += 1
    if (k.left) ix -= 1
    if (k.right) ix += 1

    let moving = false
    if (!dead && (ix !== 0 || iz !== 0)) {
      const len = Math.hypot(ix, iz)
      ix /= len
      iz /= len
      const speed = k.sprint ? FEEL.move.sprintSpeed : FEEL.move.walkSpeed
      const yaw = look.current.yaw
      const sin = Math.sin(yaw)
      const cos = Math.cos(yaw)
      // Rotate the input vector into world space and apply as a direct delta.
      const dx = (ix * cos - iz * sin) * speed * dt
      const dz = (ix * sin + iz * cos) * speed * dt
      e.posX[id] += dx
      e.posZ[id] += dz
      moving = true
      bobPhase.current += dt * FEEL.camera.headBobHz * Math.PI * 2 * (k.sprint ? 1.6 : 1)
    }

    // --- Jump. Only from the ground; CollisionSystem owns `grounded`.
    if (!dead && k.jump && world.grounded && world.grounded[id] === 1) {
      e.velY[id] = FEEL.move.jumpVelocity
    }

    // --- Weapon.
    fireTimer.current -= dt
    if (!dead && wantFire.current && fireTimer.current <= 0) {
      fireTimer.current = FIRE_COOLDOWN_S
      fireHitscan(world, id, look.current.yaw, nearby.current)
      if (onFire) onFire()
    }

    // --- Camera follows the simulated body, never the other way round.
    const bob = moving ? Math.sin(bobPhase.current) * FEEL.camera.headBobAmplitude : 0
    camera.rotation.order = 'YXZ'
    camera.rotation.set(look.current.pitch, look.current.yaw, 0)
    camera.position.set(
      e.posX[id],
      e.posY[id] + PLAYER_EYE_HEIGHT + bob,
      e.posZ[id],
    )

    const targetFov = k.sprint && moving ? FEEL.camera.fovSprint : FEEL.camera.fovDefault
    if (camera.fov !== undefined && Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8)
      camera.updateProjectionMatrix()
    }
  })

  // No visible body in first person, and deliberately no marker element:
  // R3F forwards unknown props onto the three.js object, so a `data-testid`
  // on a <group> throws (it is parsed as `data.testid`). The scene graph is
  // asserted with @react-three/test-renderer instead.
  return null
}

function initialYaw(world) {
  const spawns = (world && world.level && world.level.spawnPoints) || []
  const start = spawns.find((s) => s.id === 'player_start')
  return start && Array.isArray(start.rotation) ? start.rotation[1] : 0
}

// Hitscan: pick the hostile nearest to the player's aim line within range and
// damage it through the CombatSystem's queue, so the hit resolves on the same
// tick boundary as every other damage source.
function fireHitscan(world, playerId, yaw, scratch) {
  if (!world.combat) return
  const e = world.entities
  const px = e.posX[playerId]
  const pz = e.posZ[playerId]
  // Forward vector matching the camera's yaw convention.
  const fx = -Math.sin(yaw)
  const fz = -Math.cos(yaw)

  const count = world.hash.queryRadius(px, pz, WEAPON_RANGE_M, scratch)
  let best = -1
  let bestDist = Infinity

  for (let i = 0; i < count; i++) {
    const id = scratch[i]
    if (id === playerId || e.alive[id] === 0) continue
    if ((e.flags[id] & FLAGS.HOSTILE) === 0) continue
    if (e.health[id] <= 0) continue

    const dx = e.posX[id] - px
    const dz = e.posZ[id] - pz
    const dist = Math.hypot(dx, dz)
    if (dist < 0.001) continue
    // Angle test: is it inside the aim cone?
    if ((dx / dist) * fx + (dz / dist) * fz < AIM_DOT_MIN) continue
    if (dist < bestDist) { bestDist = dist; best = id }
  }

  if (best >= 0) world.combat.queueDamage(best, WEAPON_DAMAGE, playerId)
}
