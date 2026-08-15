/**
 * Memory Village Incident 4: The Corrupted User
 * Teaches Redis hash commands (HGET, HGETALL, HSET, HDEL).
 */

export const corruptedUserIncident = {
  id: 'corrupted-user',
  title: 'Incident 4 - The Corrupted User',
  description: 'User 42\'s profile hash contains a poisoned status field. Inspect the profile with HGETALL and repair the status field with HSET.',
  commands: ['HGET', 'HGETALL', 'HSET', 'HDEL'],
  initialKeys: {
    'user:42': { name: 'Alex', status: 'poisoned', role: 'villager' },
  },

  setup(engine) {
    engine.rawExecute('HSET', 'user:42', 'name', 'Alex', 'status', 'poisoned', 'role', 'villager')
  },

  objectives: [
    {
      id: 'inspect-user-hash',
      description: 'Inspect all fields of hash user:42 using HGETALL',
      command: 'HGETALL user:42',
      isCompleted(engine) {
        return engine.commandHistory.some(
          (entry) => (entry.command === 'HGETALL' || entry.command === 'HGET') && entry.args[0] === 'user:42'
        )
      },
    },
    {
      id: 'repair-status-field',
      description: 'Repair the status field to active with HSET user:42 status active',
      command: 'HSET user:42 status active',
      isCompleted(engine) {
        const reply = engine.rawExecute('HGET', 'user:42', 'status')
        return reply.value === 'active'
      },
    },
  ],

  hints: [
    'User 42\'s account profile in hash user:42 has poisoned field data. Use HGETALL to inspect all fields.',
    'Examine the fields with "HGETALL user:42" or "HGET user:42 status", then set the status back to active using HSET.',
    'Run "HGETALL user:42" to inspect the hash, then execute "HSET user:42 status active".',
  ],

  isResolved(engine) {
    const reply = engine.rawExecute('HGET', 'user:42', 'status')
    return reply.value === 'active'
  },
}

export default corruptedUserIncident
