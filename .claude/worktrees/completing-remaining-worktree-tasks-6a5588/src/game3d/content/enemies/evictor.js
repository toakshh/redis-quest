export const EVICTOR = {
  id: 'enemy_evictor',
  archetype: 'stalker',
  spawnCost: 100, // Very high budget cost, usually one per level
  fsm: {
    states: {
      STALK: { 
        // Speed is dynamically bound to world.memoryPressure in the entity update system
        baseSpeed: 1.5, 
        maxSpeed: 6.0 
      },
      EVICT: { 
        baseSpeed: 0, 
        action: 'DELETE_MEMORY'
      }
    }
  },
  physics: {
    radius: 1.0,
    height: 2.5
  },
  visuals: {
    model: 'evictor.glb',
    scale: 1.2
  }
}
