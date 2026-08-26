import { create } from 'zustand'

export const useCombatStore = create((set) => ({
  playerHealth: 100,
  damagePlayer: (amount) => set((state) => ({ playerHealth: Math.max(0, state.playerHealth - amount) })),
  healPlayer: (amount) => set((state) => ({ playerHealth: Math.min(100, state.playerHealth + amount) })),

  projectiles: [],
  fireProjectile: (position, direction, speed = 20) => set((state) => ({
    projectiles: [
      ...state.projectiles,
      {
        id: Date.now() + Math.random(),
        position,
        direction,
        speed,
        createdAt: Date.now()
      }
    ]
  })),
  removeProjectile: (id) => set((state) => ({
    projectiles: state.projectiles.filter((p) => p.id !== id)
  })),

  enemies: [],
  spawnEnemy: (position) => set((state) => ({
    enemies: [
      ...state.enemies,
      {
        id: Date.now() + Math.random(),
        position,
        health: 100
      }
    ]
  })),
  damageEnemy: (id, amount) => set((state) => {
    const enemies = state.enemies.map(e => {
      if (e.id === id) {
        return { ...e, health: e.health - amount }
      }
      return e
    }).filter(e => e.health > 0)
    return { enemies }
  })
}))
