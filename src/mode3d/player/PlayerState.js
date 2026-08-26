// Runtime player state model (computed from store, not stored directly)
export class PlayerState {
  constructor(store) {
    this.store = store
  }

  get vitals() {
    const p = this.store.player
    return {
      health: p.health,
      maxHealth: p.maxHealth,
      healthPct: p.health / p.maxHealth,
      stamina: p.stamina,
      maxStamina: p.maxStamina,
      staminaPct: p.stamina / p.maxStamina,
      isDead: p.health <= 0,
      isCritical: p.health / p.maxHealth < 0.25,
    }
  }

  get movement() {
    const p = this.store.player
    return {
      position: p.position,
      velocity: p.velocity,
      grounded: p.grounded,
      sprinting: p.sprinting,
      crouching: p.crouching,
      speed: Math.hypot(p.velocity[0], p.velocity[2]),
      verticalSpeed: p.velocity[1],
    }
  }

  get weapon() {
    const p = this.store.player
    const active = p.weapons[p.activeWeapon]
    return {
      type: p.activeWeapon,
      ammo: active?.ammo ?? 0,
      maxAmmo: active?.maxAmmo ?? 0,
      heat: active?.heat ?? 0,
      charges: active?.charges ?? 0,
      maxCharges: active?.maxCharges ?? 0,
      cooldown: active?.cooldown ?? 0,
      canFire: active?.ammo > 0 && active?.heat < 100,
      canUseCyberdeck: active?.charges > 0 && Date.now() > (active?.cooldown ?? 0),
    }
  }

  get inventory() {
    return this.store.player.inventory
  }

  get perks() {
    return {
      damageResistance: this.store.player.damageResistance || 0,
      damageMultiplier: this.store.player.damageMultiplier || 1,
      speedMultiplier: this.store.player.speedMultiplier || 1,
      staminaRegenMultiplier: this.store.player.staminaRegenMultiplier || 1,
      canWallRun: this.store.player.canWallRun || false,
      canDoubleJump: this.store.player.canDoubleJump || false,
      canSlide: this.store.player.canSlide || false,
      corruptionImmune: this.store.player.corruptionImmune || false,
      anomalySenseRange: this.store.player.anomalySenseRange || 10,
    }
  }

  // Apply damage with resistance
  applyDamage(amount, source) {
    const resistance = this.perks.damageResistance
    const finalDamage = Math.max(1, amount * (1 - resistance))
    this.store.playerDamage(finalDamage)
    return finalDamage
  }

  // Heal
  heal(amount) {
    this.store.playerHeal(amount)
  }

  // Use stamina
  useStamina(amount) {
    this.store.spendStamina(amount)
  }
}

// Create player state instance
export function createPlayerState(store) {
  return new PlayerState(store)
}