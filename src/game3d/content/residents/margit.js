export const MARGIT = {
  id: 'npc_margit',
  name: 'Margit (The Over-Cacher)',
  lesson: 'Caching everything indiscriminately fills memory and leads to eviction of important data.',
  states: {
    STATE_UNAWARE: {
      dialogue: [
        "I just have to save everything. If I save it, I can find it again faster...",
        "Why is it getting so crowded in here?"
      ],
      next: 'STATE_AWARE'
    },
    STATE_AWARE: {
      dialogue: [
        "It's taking things away! The Evictor is taking my memories!",
        "You have to help me, clear the cache!"
      ],
      next: 'STATE_RESOLVED'
    },
    STATE_RESOLVED: {
      dialogue: [
        "Only the important things. Set an expiry. Let the rest go..."
      ],
      next: null
    }
  }
}
