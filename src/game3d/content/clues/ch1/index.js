export const CLUES = [
  {
    id: 'clue_ch1_1',
    type: 'visual_environmental',
    description: 'A wall scrawled with "TTL IS LIFE" in glowing red letters.',
    teaches: 'Expiry timers prevent memory exhaustion.'
  },
  {
    id: 'clue_ch1_2',
    type: 'audio_log',
    description: 'Audio log from the Archivist: "The Evictor does not hate you. It just hates what you keep."',
    teaches: 'The Evictor spawns or speeds up based on memory usage.'
  },
  {
    id: 'clue_ch1_3',
    type: 'document',
    description: 'A crumpled post-it note: "HSET user:1000 name Margit".',
    teaches: 'Basic hash setting syntax.'
  },
  {
    id: 'clue_ch1_4',
    type: 'system_terminal',
    description: 'A terminal flashing "WARNING: OOM limit reached. LRU policy active."',
    teaches: 'Eviction policies trigger when memory is full.'
  },
  {
    id: 'clue_ch1_5',
    type: 'npc_dialogue',
    description: 'Margit muttering about saving everything without limits.',
    teaches: 'Unbounded data structures are dangerous.'
  },
  {
    id: 'clue_ch1_6',
    type: 'haptic_vibration',
    description: 'A rhythmic pulsing in the floor as the latency spikes.',
    teaches: 'Blocking operations have physical consequences in the world.'
  }
]
