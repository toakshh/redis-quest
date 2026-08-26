import { use3DGameStore } from '../../stores/use3DGameStore'

export const STAMINA_CONFIG = {
  max: 100,
  sprintDrain: 18,      // per second
  regenRate: 12,        // per second when not sprinting
  regenDelay: 0.5,      // seconds after stopping sprint before regen starts
  jumpCost: 15,
  dodgeCost: 25,
  minForSprint: 5,
}

export function useStaminaSystem() {
  const { player, spendStamina, regenStamina, setSprinting } = use3DGameStore.getState()

  let regenTimer = 0

  const update = (dt, sprinting, jumped, dodged) => {
    if (sprinting) {
      spendStamina(STAMINA_CONFIG.sprintDrain * dt)
      regenTimer = 0
    } else {
      regenTimer += dt
      if (regenTimer >= STAMINA_CONFIG.regenDelay) {
        regenStamina(dt)
      }
    }

    if (jumped) {
      spendStamina(STAMINA_CONFIG.jumpCost)
    }

    if (dodged) {
      spendStamina(STAMINA_CONFIG.dodgeCost)
    }

    // Auto-disable sprint if stamina too low
    if (player.stamina < STAMINA_CONFIG.minForSprint && sprinting) {
      setSprinting(false)
    }
  }

  const canSprint = () => player.stamina >= STAMINA_CONFIG.minForSprint
  const canJump = () => player.stamina >= STAMINA_CONFIG.jumpCost
  const canDodge = () => player.stamina >= STAMINA_CONFIG.dodgeCost

  return { update, canSprint, canJump, canDodge, config: STAMINA_CONFIG }
}

// React hook version
export function useStamina() {
  const stamina = use3DGameStore(state => state.player.stamina)
  const maxStamina = use3DGameStore(state => state.player.maxStamina)
  const sprinting = use3DGameStore(state => state.player.sprinting)

  return {
    value: stamina,
    max: maxStamina,
    pct: stamina / maxStamina,
    sprinting,
    config: STAMINA_CONFIG,
  }
}