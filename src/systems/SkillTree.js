// SkillTree — skill catalog and unlock validation for Redis Quest.
//
// The tree is data-driven: each node declares its cost, prerequisites and the
// region that unlocks it. Future skills exist as locked nodes so the player
// can see the shape of the tree ahead, with connections drawn between a node
// and its prerequisites. Only Memory Village skills are reachable in this
// phase; the rest are roadmap placeholders.

export const SKILLS = [
  {
    id: 'crystal-clarity',
    name: 'Crystal Clarity',
    kind: 'passive',
    desc: 'GET shows a value preview without consuming the crystal.',
    icon: '🔍',
    color: 'cyan',
    cost: 1,
    region: 'memory-village',
  },
  {
    id: 'swift-retrieval',
    name: 'Swift Retrieval',
    kind: 'passive',
    desc: 'Retrieval beams travel faster between well and player.',
    icon: '⚡',
    color: 'blue',
    cost: 2,
    region: 'future',
    requires: ['crystal-clarity'],
  },
  {
    id: 'memorialist',
    name: 'Memorialist',
    kind: 'passive',
    desc: 'Golden countdown halos tick slower while you watch.',
    icon: '⏳',
    color: 'amber',
    cost: 2,
    region: 'future',
    requires: ['crystal-clarity'],
  },
  {
    id: 'clean-sweep',
    name: 'Clean Sweep',
    kind: 'passive',
    desc: 'FLUSHDB storms earn bonus XP.',
    icon: '🧹',
    color: 'green',
    cost: 3,
    region: 'future',
    requires: ['swift-retrieval', 'memorialist'],
  },
]

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]))

/** A skill is available when its region is unlocked and prerequisites are met. */
export function isSkillUnlockable(skillId, { skills, regions }) {
  const def = SKILL_BY_ID[skillId]
  if (!def) return false
  if (skills[skillId]) return false // already owned
  if (def.region !== 'future' && !(regions && regions[def.region])) return false
  const prereqs = def.requires || []
  return prereqs.every((p) => skills[p])
}

/** Collect skills that are currently purchasable. */
export function purchasableSkills(state) {
  return SKILLS.filter((s) => isSkillUnlockable(s.id, state)).map((s) => s.id)
}

/**
 * Try to unlock a skill. Pure decision — the caller mutates state.
 * @returns {{ ok: boolean, reason?: string, skill?: object }}
 */
export function canUnlockSkill(skillId, { skills, skillPoints, regions }) {
  const def = SKILL_BY_ID[skillId]
  if (!def) return { ok: false, reason: 'unknown-skill' }
  if (skills[skillId]) return { ok: false, reason: 'already-owned' }
  if (!isSkillUnlockable(skillId, { skills, regions })) {
    return { ok: false, reason: 'locked' }
  }
  if ((skillPoints || 0) < def.cost) return { ok: false, reason: 'no-points' }
  return { ok: true, skill: def }
}
