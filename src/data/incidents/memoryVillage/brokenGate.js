/**
 * Memory Village Incident 1: The Broken Gate
 * Teaches GET and SET commands.
 */

export const brokenGateIncident = {
  id: 'broken-gate',
  title: 'Incident 1 - The Broken Gate',
  description: 'The Memory Village gate is stuck open, exposing the town. Inspect the key api:gate:mode and set it to locked.',
  commands: ['GET', 'SET'],
  initialKeys: {
    'api:gate:mode': 'open',
  },

  setup(engine) {
    engine.rawExecute('SET', 'api:gate:mode', 'open')
  },

  objectives: [
    {
      id: 'inspect-gate-mode',
      description: 'Inspect the gate mode key api:gate:mode with GET',
      command: 'GET api:gate:mode',
      isCompleted(engine) {
        // Check command history for a GET on api:gate:mode
        return engine.commandHistory.some(
          (entry) => entry.command === 'GET' && entry.args[0] === 'api:gate:mode'
        )
      },
    },
    {
      id: 'repair-gate-mode',
      description: 'Repair api:gate:mode to "locked" with SET',
      command: 'SET api:gate:mode locked',
      isCompleted(engine) {
        const reply = engine.rawExecute('GET', 'api:gate:mode')
        return reply.value === 'locked'
      },
    },
  ],

  hints: [
    'The village gate is wide open. Use GET to inspect the current value of api:gate:mode.',
    'Execute "GET api:gate:mode" to verify its status, then use SET to change its value to "locked".',
    'Run "GET api:gate:mode" and then "SET api:gate:mode locked" to repair the gate.',
  ],

  isResolved(engine) {
    const reply = engine.rawExecute('GET', 'api:gate:mode')
    return reply.value === 'locked'
  },
}

export default brokenGateIncident
