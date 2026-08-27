export const BEATS = [
  {
    id: 'ch1.b1_intro',
    chapter: 1,
    weight: 10, // Must happen early
    cooldownMs: 0,
    tags: ['intro', 'story'],
    requires: [
      (context) => context.stats.timeAlive < 60000
    ],
    execute: (world) => { /* Mutate world */ }
  },
  {
    id: 'ch1.b2_first_scare',
    chapter: 1,
    weight: 5,
    cooldownMs: 120000,
    tags: ['incident'],
    requires: [
      (context) => context.stats.timeAlive > 30000
    ],
    execute: (world) => {}
  },
  {
    id: 'ch1.b3_margit_encounter',
    chapter: 1,
    weight: 8,
    cooldownMs: 300000,
    tags: ['story', 'resident'],
    requires: [
      (context) => context.playerZone === 'ZoneA'
    ],
    execute: (world) => {}
  },
  {
    id: 'ch1.b4_caching_error',
    chapter: 1,
    weight: 6,
    cooldownMs: 60000,
    tags: ['incident', 'caching'],
    requires: [
      (context) => context.memory.fullness > 0.3
    ],
    execute: (world) => {}
  },
  {
    id: 'ch1.b5_delacroix',
    chapter: 1,
    weight: 7,
    cooldownMs: 300000,
    tags: ['story', 'resident'],
    requires: [
      (context) => context.storyGraph.completed.includes('ch1.b3_margit_encounter')
    ],
    execute: (world) => {}
  },
  {
    id: 'ch1.b6_evictor_warning',
    chapter: 1,
    weight: 9,
    cooldownMs: 200000,
    tags: ['pressure'],
    requires: [
      (context) => context.memory.fullness > 0.5
    ],
    execute: (world) => {}
  },
  {
    id: 'ch1.b7_first_combat',
    chapter: 1,
    weight: 5,
    cooldownMs: 120000,
    tags: ['combat'],
    requires: [
      (context) => context.stats.timeAlive > 180000
    ],
    execute: (world) => {}
  },
  {
    id: 'ch1.b8_chapter_end',
    chapter: 1,
    weight: 20,
    cooldownMs: 0,
    tags: ['ending'],
    requires: [
      (context) => context.storyGraph.completed.includes('ch1.b5_delacroix'),
      (context) => context.objectives.completed >= 3
    ],
    execute: (world) => { world.flags.push('ch1_complete') }
  }
]
