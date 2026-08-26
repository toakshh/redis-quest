import { useGameStore } from '../../store/gameStore'
import { use3DGameStore } from '../../stores/use3DGameStore'

// Maps 2D skill tree unlocks to 3D gameplay perks
const SKILL_TO_3D_PERK = {
  // Combat skills
  'plasma-mastery': { type: 'weapon', weapon: 'plasma', damageBonus: 0.25, heatReduction: 0.15 },
  'rapid-fire': { type: 'weapon', weapon: 'plasma', fireRateBonus: 0.3 },
  'overcharge': { type: 'weapon', weapon: 'plasma', overchargeDamage: 1.5, overchargeCost: 20 },

  'cyberdeck-affinity': { type: 'weapon', weapon: 'cyberdeck', chargeRegenBonus: 0.5, cooldownReduction: 0.25 },
  'script-injection': { type: 'weapon', weapon: 'cyberdeck', extraProjectile: true },

  // Movement skills
  'sprinter': { type: 'movement', staminaRegenBonus: 0.5, sprintSpeedBonus: 0.15 },
  'wall-runner': { type: 'movement', wallRun: true },
  'double-jump': { type: 'movement', doubleJump: true },
  'slide': { type: 'movement', slide: true },

  // Survival skills
  'iron-will': { type: 'survival', maxHealthBonus: 25, damageResistance: 0.1 },
  'adrenaline': { type: 'survival', lowHealthDamageBonus: 0.5, lowHealthSpeedBonus: 0.2 },
  'scavenger': { type: 'survival', ammoFindBonus: 0.5, healthFindBonus: 0.3 },

  // Technical skills
  'redis-internals': { type: 'technical', commandSpeedBonus: 0.3, autocompleteBonus: true },
  'lua-master': { type: 'technical', luaExecutionSpeed: 2, luaErrorReduction: 0.5 },
  'cluster-admin': { type: 'technical', clusterCommandBonus: true, failoverSpeedBonus: 0.5 },

  // Horror/sanity skills
  'mental-fortitude': { type: 'sanity', sanityDrainReduction: 0.3, hallucinationResistance: 0.5 },
  'void-walker': { type: 'sanity', corruptionZoneImmunity: true, anomalySenseRange: 20 },
}

export function syncSkillsTo3D() {
  const gameStore = useGameStore.getState()
  const mode3DStore = use3DGameStore.getState()

  const unlockedSkills = gameStore.unlockedSkills || []
  const perks = unlockedSkills
    .map(skillId => SKILL_TO_3D_PERK[skillId])
    .filter(Boolean)

  // Apply perks to 3D store
  perks.forEach(perk => {
    applyPerk(perk)
  })

  // Store retained skills for loop persistence
  mode3DStore.retainSkill(...unlockedSkills)

  return perks
}

function applyPerk(perk) {
  const store = use3DGameStore.getState()

  switch (perk.type) {
    case 'weapon':
      if (perk.weapon === 'plasma') {
        if (perk.damageBonus) {
          store.player.weapons.plasma.damageMultiplier = (store.player.weapons.plasma.damageMultiplier || 1) * (1 + perk.damageBonus)
        }
        if (perk.heatReduction) {
          store.player.weapons.plasma.heatMultiplier = (store.player.weapons.plasma.heatMultiplier || 1) * (1 - perk.heatReduction)
        }
        if (perk.fireRateBonus) {
          store.player.weapons.plasma.fireRateMultiplier = (store.player.weapons.plasma.fireRateMultiplier || 1) * (1 + perk.fireRateBonus)
        }
        if (perk.overchargeDamage) {
          store.player.weapons.plasma.canOvercharge = true
          store.player.weapons.plasma.overchargeMultiplier = perk.overchargeDamage
          store.player.weapons.plasma.overchargeCost = perk.overchargeCost
        }
      }
      if (perk.weapon === 'cyberdeck') {
        if (perk.chargeRegenBonus) {
          store.player.weapons.cyberdeck.regenMultiplier = (store.player.weapons.cyberdeck.regenMultiplier || 1) * (1 + perk.chargeRegenBonus)
        }
        if (perk.cooldownReduction) {
          store.player.weapons.cyberdeck.cooldownMultiplier = (store.player.weapons.cyberdeck.cooldownMultiplier || 1) * (1 - perk.cooldownReduction)
        }
        if (perk.extraProjectile) {
          store.player.weapons.cyberdeck.extraProjectile = true
        }
      }
      break

    case 'movement':
      if (perk.staminaRegenBonus) {
        store.player.staminaRegenMultiplier = (store.player.staminaRegenMultiplier || 1) * (1 + perk.staminaRegenBonus)
      }
      if (perk.sprintSpeedBonus) {
        store.player.sprintSpeedMultiplier = (store.player.sprintSpeedMultiplier || 1) * (1 + perk.sprintSpeedBonus)
      }
      if (perk.wallRun) store.player.canWallRun = true
      if (perk.doubleJump) store.player.canDoubleJump = true
      if (perk.slide) store.player.canSlide = true
      break

    case 'survival':
      if (perk.maxHealthBonus) {
        store.player.maxHealth += perk.maxHealthBonus
        store.player.health = Math.min(store.player.maxHealth, store.player.health + perk.maxHealthBonus)
      }
      if (perk.damageResistance) {
        store.player.damageResistance = (store.player.damageResistance || 0) + perk.damageResistance
      }
      if (perk.lowHealthDamageBonus) {
        store.player.lowHealthDamageMultiplier = perk.lowHealthDamageBonus
      }
      if (perk.lowHealthSpeedBonus) {
        store.player.lowHealthSpeedMultiplier = perk.lowHealthSpeedBonus
      }
      if (perk.ammoFindBonus) store.player.ammoFindMultiplier = (store.player.ammoFindMultiplier || 1) * (1 + perk.ammoFindBonus)
      if (perk.healthFindBonus) store.player.healthFindMultiplier = (store.player.healthFindMultiplier || 1) * (1 + perk.healthFindBonus)
      break

    case 'technical':
      if (perk.commandSpeedBonus) store.player.commandSpeedMultiplier = (store.player.commandSpeedMultiplier || 1) * (1 + perk.commandSpeedBonus)
      if (perk.autocompleteBonus) store.terminal.autocomplete = true
      if (perk.luaExecutionSpeed) store.player.luaSpeedMultiplier = perk.luaExecutionSpeed
      if (perk.luaErrorReduction) store.player.luaErrorMultiplier = (store.player.luaErrorMultiplier || 1) * (1 - perk.luaErrorReduction)
      if (perk.clusterCommandBonus) store.player.canClusterCommands = true
      if (perk.failoverSpeedBonus) store.player.failoverSpeedMultiplier = (store.player.failoverSpeedMultiplier || 1) * (1 + perk.failoverSpeedBonus)
      break

    case 'sanity':
      if (perk.sanityDrainReduction) store.player.sanityDrainMultiplier = (store.player.sanityDrainMultiplier || 1) * (1 - perk.sanityDrainReduction)
      if (perk.hallucinationResistance) store.player.hallucinationResistance = (store.player.hallucinationResistance || 0) + perk.hallucinationResistance
      if (perk.corruptionZoneImmunity) store.player.corruptionImmune = true
      if (perk.anomalySenseRange) store.player.anomalySenseRange = perk.anomalySenseRange
      break
  }
}

// Get all available perks for a skill (for UI display)
export function getPerksForSkill(skillId) {
  return SKILL_TO_3D_PERK[skillId] || null
}

// Get all unlocked perks
export function getUnlockedPerks() {
  const gameStore = useGameStore.getState()
  return gameStore.unlockedSkills
    .map(skillId => ({ skillId, perk: SKILL_TO_3D_PERK[skillId] }))
    .filter(p => p.perk)
}

// Called when entering 3D mode
export function initialize3DSkills() {
  return syncSkillsTo3D()
}

// Called on loop rollback - skills already retained in loop.retainedSkills
export function reapplyRetainedSkills() {
  const store = use3DGameStore.getState()
  store.loop.retainedSkills.forEach(skillId => {
    const perk = SKILL_TO_3D_PERK[skillId]
    if (perk) applyPerk(perk)
  })
}