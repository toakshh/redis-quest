export const CRAWLER = {
  id: 'enemy_crawler',
  archetype: 'crawler',
  spawnCost: 20, // Budget cost for the Encounter Builder
  fsm: {
    states: {
      IDLE: { moveSpeed: 0, next: 'PATROL' },
      PATROL: { moveSpeed: 2.0, next: 'CHASE' },
      CHASE: { moveSpeed: 4.5, next: 'ATTACK' },
      ATTACK: { moveSpeed: 0, next: 'COOLDOWN' },
      COOLDOWN: { moveSpeed: 1.0, next: 'PATROL' }
    }
  },
  physics: {
    radius: 0.5,
    height: 1.0
  },
  visuals: {
    model: 'crawler.glb',
    scale: 1.0
  }
}
