/**
 * Memory Village Incident 3: The Endless Shield
 * Teaches TTL inspection and setting expiration with EXPIRE.
 */

export const endlessShieldIncident = {
  id: 'endless-shield',
  title: 'Incident 3 - The Endless Shield',
  description: 'The village shield is consuming energy endlessly because no expiration is set (TTL -1). Inspect its TTL and apply a 30-second expiration timeout.',
  commands: ['TTL', 'EXPIRE'],
  initialKeys: {
    'village:shield': 'active',
  },

  setup(engine) {
    engine.rawExecute('SET', 'village:shield', 'active')
  },

  objectives: [
    {
      id: 'inspect-ttl',
      description: 'Inspect the TTL of village:shield with TTL',
      command: 'TTL village:shield',
      isCompleted(engine) {
        return engine.commandHistory.some(
          (entry) => entry.command === 'TTL' && entry.args[0] === 'village:shield'
        )
      },
    },
    {
      id: 'set-expire',
      description: 'Set a 30-second expiration on village:shield using EXPIRE',
      command: 'EXPIRE village:shield 30',
      isCompleted(engine) {
        const ttlReply = engine.rawExecute('TTL', 'village:shield')
        return typeof ttlReply.value === 'number' && ttlReply.value > 0
      },
    },
  ],

  hints: [
    'The village shield is draining power without an expiration. Check its remaining life with TTL village:shield.',
    'Inspect the shield with "TTL village:shield", then configure a 30-second expiration using EXPIRE.',
    'Run "TTL village:shield" followed by "EXPIRE village:shield 30".',
  ],

  isResolved(engine) {
    const ttlReply = engine.rawExecute('TTL', 'village:shield')
    return typeof ttlReply.value === 'number' && ttlReply.value > 0
  },
}

export default endlessShieldIncident
