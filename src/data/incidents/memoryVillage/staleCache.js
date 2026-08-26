/**
 * Memory Village Incident 2: The Rotting Cache
 * Teaches DEL and SET commands for cache invalidation or repair.
 */

export const staleCacheIncident = {
  id: 'stale-cache',
  title: 'Incident 2 - The Rotting Cache',
  description: 'Cached user data for user 42 has rotted and become corrupted. Invalidate the stale cache entry with DEL or repair it with SET.',
  commands: ['DEL', 'SET'],
  initialKeys: {
    'cache:user:42': 'corrupted',
  },

  setup(engine) {
    engine.rawExecute('SET', 'cache:user:42', 'corrupted')
  },

  objectives: [
    {
      id: 'invalidate-or-repair-cache',
      description: 'Invalidate cache:user:42 using DEL or repair it using SET',
      command: 'DEL cache:user:42',
      isCompleted(engine) {
        const reply = engine.rawExecute('GET', 'cache:user:42')
        return reply.value === null || reply.value !== 'corrupted'
      },
    },
  ],

  hints: [
    'User 42\'s cached profile is corrupted. Inspect cache:user:42 or invalidate it.',
    'Clear the corrupted key with "DEL cache:user:42" or replace it with a valid value using "SET cache:user:42 valid".',
    'Run "DEL cache:user:42" to invalidate the stale cache, or "SET cache:user:42 active" to repair it.',
  ],

  isResolved(engine) {
    const reply = engine.rawExecute('GET', 'cache:user:42')
    return reply.value === null || reply.value !== 'corrupted'
  },
}

export default staleCacheIncident
