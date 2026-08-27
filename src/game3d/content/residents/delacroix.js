export const DELACROIX = {
  id: 'npc_delacroix',
  name: 'Delacroix (The Synchronous Waiter)',
  lesson: 'Using blocking commands without timeout handling causes latency spikes that anger the system.',
  states: {
    STATE_WAITING: {
      dialogue: [
        "I've been waiting for a message. It said it would arrive.",
        "I can't do anything else until it does. The queue is empty."
      ],
      next: 'STATE_PANIC'
    },
    STATE_PANIC: {
      dialogue: [
        "The system is grinding to a halt! I'm blocking the main thread!",
        "Break the block, please!"
      ],
      next: 'STATE_RESOLVED'
    },
    STATE_RESOLVED: {
      dialogue: [
        "A timeout... yes. I should have set a timeout.",
        "It flows again."
      ],
      next: null
    }
  }
}
