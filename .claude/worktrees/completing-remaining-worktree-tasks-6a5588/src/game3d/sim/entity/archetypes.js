// Archetype ids and their physical bodies. The entity store keeps `archetype`
// as a Uint8 index, so these are plain integers used as array offsets — never
// strings, never a Map lookup in the hot loop.
//
// Sim layer: no three.js, no react, no DOM.

export const ARCHETYPE = Object.freeze({
  PLAYER: 0,
  CRAWLER: 1,
  STALKER: 2,
  RESIDENT: 3,
})

// Indexed by archetype id. `radius`/`height` describe the upright cylinder the
// CollisionSystem resolves; `eyeHeight` is where the camera sits for the
// player. Kept as parallel plain arrays so a lookup is one index, no object
// churn per entity per tick.
export const BODY_RADIUS = Object.freeze([0.4, 0.45, 0.55, 0.4])
export const BODY_HEIGHT = Object.freeze([1.8, 1.1, 2.2, 1.75])

export const PLAYER_EYE_HEIGHT = 1.62

// Archetype tuning the AI and combat systems read.
export const ARCHETYPE_STATS = Object.freeze({
  [ARCHETYPE.CRAWLER]: { health: 3, touchDamage: 1, speed: 3.6 },
  [ARCHETYPE.STALKER]: { health: 12, touchDamage: 3, speed: 2.4 },
})
