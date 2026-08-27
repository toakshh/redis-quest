export const SCARE_TYPES = [
  {
    id: 'T1',
    name: 'Proximity lunge',
    baseEffectiveness: 0.8,
    cooldownMs: 60000,
    minTension: 'Medium',
    requiresLineOfSight: true,
    audioCue: 'sfx_lunge'
  },
  {
    id: 'T2',
    name: 'Sting reveal',
    baseEffectiveness: 0.9,
    cooldownMs: 90000,
    minTension: 'Medium',
    requiresLineOfSight: true,
    audioCue: 'sfx_sting'
  },
  {
    id: 'T3',
    name: 'False scare',
    baseEffectiveness: 0.5,
    cooldownMs: 30000,
    minTension: 'Low',
    requiresLineOfSight: false,
    audioCue: 'sfx_pipe_burst'
  },
  {
    id: 'T4',
    name: 'Behind-you',
    baseEffectiveness: 0.9,
    cooldownMs: 120000,
    minTension: 'High',
    requiresLineOfSight: false,
    audioCue: 'sfx_breath_behind'
  },
  {
    id: 'T5',
    name: 'Interface invasion',
    baseEffectiveness: 1.0,
    cooldownMs: 180000,
    minTension: 'Medium',
    requiresLineOfSight: false,
    audioCue: 'sfx_glitch'
  },
  {
    id: 'T6',
    name: 'Diegetic Redis scare',
    baseEffectiveness: 1.2,
    cooldownMs: 150000,
    minTension: 'High',
    requiresLineOfSight: false,
    audioCue: 'sfx_resident_deleted'
  },
  {
    id: 'T7',
    name: 'Relief punish',
    baseEffectiveness: 1.1,
    cooldownMs: 240000,
    minTension: 'Low', // Must happen during relief!
    requiresLineOfSight: true,
    audioCue: 'sfx_relief_punish'
  },
  {
    id: 'T8',
    name: 'Stalker reveal',
    baseEffectiveness: 1.5,
    cooldownMs: 300000,
    minTension: 'High',
    requiresLineOfSight: true,
    audioCue: 'sfx_evictor_reveal'
  }
]
