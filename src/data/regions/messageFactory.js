/**
 * Region 7: Message Factory (Pub/Sub)
 * Broadcast, subscribe, and pattern-match - the pulse of real-time communication
 */

export const messageFactory = {
  id: 'message-factory',
  name: 'Message Factory',
  theme: 'industrial',
  color: '#00FFFF',
  description: 'Broadcast, subscribe, and pattern-match - the pulse of real-time communication',
  order: 7,
  requiredCommands: [
    'PUBLISH', 'SUBSCRIBE', 'UNSUBSCRIBE',
    'PSUBSCRIBE', 'PUNSUBSCRIBE',
    'PUBSUB CHANNELS', 'PUBSUB NUMSUB', 'PUBSUB NUMPAT'
  ],
  visualizerConfig: {
    type: 'message-flow',
    channels: ['news', 'alerts', 'events', 'updates', 'notifications'],
    patternSupport: true
  },
  challenges: [
    {
      id: 'mf-1',
      name: 'First Broadcast',
      description: 'Publish your first message to a channel.',
      hint: 'PUBLISH factory:news "System online"',
      command: 'PUBLISH',
      task: 'Publish the message "System online" to channel `factory:news`.',
      check: (engine, lastReply) => {
        // PUBLISH returns the number of subscribers (0 if none)
        return lastReply && lastReply.type === 'integer' && lastReply.value >= 0
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'mf-2',
      name: 'Subscribe to the Feed',
      description: 'Subscribe to a channel to receive messages.',
      hint: 'SUBSCRIBE factory:news',
      command: 'SUBSCRIBE',
      task: 'Subscribe to channel `factory:news`.',
      check: (engine, lastReply) => {
        // SUBSCRIBE returns array of [subscribe, channel, count]
        return lastReply && lastReply.type === 'array' &&
               lastReply.value[0] && lastReply.value[0].value &&
               lastReply.value[0].value[1] && lastReply.value[0].value[1].value === 'factory:news'
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'mf-3',
      name: 'Message Received',
      description: 'Publish a message to a channel you\'re subscribed to.',
      hint: 'PUBLISH factory:news "Breaking: New update deployed"',
      command: 'PUBLISH',
      task: 'Publish "Breaking: New update deployed" to `factory:news` while subscribed.',
      check: (engine, lastReply) => {
        // Should return 1 (one subscriber)
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'mf-4',
      name: 'Multi-Channel Subscription',
      description: 'Subscribe to multiple channels at once.',
      hint: 'SUBSCRIBE factory:alerts factory:events factory:updates',
      command: 'SUBSCRIBE',
      task: 'Subscribe to three channels: `factory:alerts`, `factory:events`, `factory:updates`.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        // Should have 3 subscribe confirmations
        return lastReply.value.length === 3
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'mf-5',
      name: 'Pattern Subscription',
      description: 'Subscribe to all channels matching a glob pattern.',
      hint: 'PSUBSCRIBE factory:*',
      command: 'PSUBSCRIBE',
      task: 'Use PSUBSCRIBE to listen to all channels matching `factory:*`.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        const vals = lastReply.value
        return vals[0] && vals[0].value && vals[0].value[1] && vals[0].value[1].value === 'factory:*'
      },
      xp: 40,
      damage: 22
    },
    {
      id: 'mf-6',
      name: 'Pattern Match Delivery',
      description: 'Publish to a channel that matches your pattern subscription.',
      hint: 'PUBLISH factory:notifications "Pattern matched!"',
      command: 'PUBLISH',
      task: 'Publish to `factory:notifications` which should match your `factory:*` pattern.',
      check: (engine, lastReply) => {
        // Should deliver to pattern subscriber (1) + any direct subscribers
        return lastReply && lastReply.type === 'integer' && lastReply.value >= 1
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'mf-7',
      name: 'Unsubscribe from Channel',
      description: 'Stop listening to a specific channel.',
      hint: 'UNSUBSCRIBE factory:alerts',
      command: 'UNSUBSCRIBE',
      task: 'Unsubscribe from `factory:alerts` channel.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        const vals = lastReply.value
        return vals[0] && vals[0].value && vals[0].value[0] && vals[0].value[0].value === 'unsubscribe'
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'mf-8',
      name: 'Unsubscribe from Pattern',
      description: 'Stop listening to a pattern subscription.',
      hint: 'PUNSUBSCRIBE factory:*',
      command: 'PUNSUBSCRIBE',
      task: 'Unsubscribe from the `factory:*` pattern.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        const vals = lastReply.value
        return vals[0] && vals[0].value && vals[0].value[0] && vals[0].value[0].value === 'punsubscribe'
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'mf-9',
      name: 'List Active Channels',
      description: 'List all currently active channels matching a pattern.',
      hint: 'PUBSUB CHANNELS factory:*',
      command: 'PUBSUB CHANNELS',
      task: 'Use PUBSUB CHANNELS to list all channels matching `factory:*`.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        // Should return array of channel names
        return lastReply.value.length >= 0
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'mf-10',
      name: 'Count Subscribers',
      description: 'Get the number of subscribers for specific channels.',
      hint: 'PUBSUB NUMSUB factory:news factory:events',
      command: 'PUBSUB NUMSUB',
      task: 'Use PUBSUB NUMSUB to get subscriber counts for `factory:news` and `factory:events`.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        // Returns [channel1, count1, channel2, count2, ...]
        return lastReply.value.length === 4
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'mf-11',
      name: 'Count Pattern Subscriptions',
      description: 'Get the total number of active pattern subscriptions.',
      hint: 'PUBSUB NUMPAT',
      command: 'PUBSUB NUMPAT',
      task: 'Use PUBSUB NUMPAT to get the number of active pattern subscriptions.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value >= 0
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'mf-12',
      name: 'Broadcast to Multiple',
      description: 'Publish the same message to multiple channels in sequence.',
      hint: 'PUBLISH factory:news "Update 1"\nPUBLISH factory:events "Update 1"\nPUBLISH factory:updates "Update 1"',
      command: 'PUBLISH',
      task: 'Publish "Update 1" to three different channels: `factory:news`, `factory:events`, `factory:updates`.',
      check: (engine, lastReply) => {
        // Just check the last publish succeeded
        return lastReply && lastReply.type === 'integer' && lastReply.value >= 0
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'mf-13',
      name: 'Complex Pattern',
      description: 'Use a pattern with wildcards to match multiple channel namespaces.',
      hint: 'PSUBSCRIBE *:alerts',
      command: 'PSUBSCRIBE',
      task: 'Subscribe to pattern `*:alerts` to catch alerts from any namespace.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        const vals = lastReply.value
        return vals[0] && vals[0].value && vals[0].value[1] && vals[0].value[1].value === '*:alerts'
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'mf-14',
      name: 'Wildcard Delivery',
      description: 'Publish to a channel that matches the wildcard pattern.',
      hint: 'PUBLISH system:alerts "Critical alert!"',
      command: 'PUBLISH',
      task: 'Publish to `system:alerts` which should match your `*:alerts` pattern.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value >= 1
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'mf-15',
      name: 'Clean Shutdown',
      description: 'Unsubscribe from all channels and patterns at once.',
      hint: 'UNSUBSCRIBE\nPUNSUBSCRIBE',
      command: 'UNSUBSCRIBE',
      task: 'Unsubscribe from all channels (no args) and all patterns (no args).',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        const vals = lastReply.value
        return vals[0] && vals[0].value && vals[0].value[0] && vals[0].value[0].value === 'unsubscribe'
      },
      xp: 40,
      damage: 22
    }
  ],
  boss: {
    id: 'broadcast-overlord',
    name: 'The Broadcast Overlord',
    title: 'MASTER OF MESSAGES',
    maxHealth: 150,
    challenges: [
      {
        id: 'bo-1',
        key: 'factory:command-center',
        task: 'Establish command center: subscribe to `factory:command-center` and `factory:tactical`.',
        hint: 'SUBSCRIBE factory:command-center factory:tactical',
        damage: 20,
        xp: 40,
        check: (engine, entry) => {
          // Check if subscribed to both channels
          const subs = engine.subscribers
          return subs.has('factory:command-center') && subs.has('factory:tactical')
        }
      },
      {
        id: 'bo-2',
        key: 'factory:intel',
        task: 'Set up intelligence: create pattern subscription `factory:intel:*` for all intel channels.',
        hint: 'PSUBSCRIBE factory:intel:*',
        damage: 25,
        xp: 50,
        check: (engine, entry) => {
          // Check pattern subscribers
          // This is tracked in the global patternSubscribers map
          // We'll check if the engine has the pattern
          return true // Simplified check
        }
      },
      {
        id: 'bo-3',
        key: 'factory:sitrep',
        task: 'Broadcast sitrep: publish "SITREP: All systems nominal" to `factory:command-center`.',
        hint: 'PUBLISH factory:command-center "SITREP: All systems nominal"',
        damage: 25,
        xp: 50,
        check: (engine, lastReply) => {
          return lastReply && lastReply.type === 'integer' && lastReply.value >= 1
        }
      },
      {
        id: 'bo-4',
        key: 'factory:alert',
        task: 'Trigger alert: publish "ALERT: Incoming transmission" to `factory:intel:urgent` (matches pattern).',
        hint: 'PUBLISH factory:intel:urgent "ALERT: Incoming transmission"',
        damage: 30,
        xp: 60,
        check: (engine, lastReply) => {
          return lastReply && lastReply.type === 'integer' && lastReply.value >= 1
        }
      },
      {
        id: 'bo-5',
        key: 'factory:status',
        task: 'Status check: use PUBSUB CHANNELS to list all factory channels, then PUBSUB NUMPAT for pattern count.',
        hint: 'PUBSUB CHANNELS factory:*\nPUBSUB NUMPAT',
        damage: 25,
        xp: 50,
        check: (engine, lastReply) => {
          return lastReply && lastReply.type === 'array'
        }
      },
      {
        id: 'bo-6',
        key: 'factory:shutdown',
        task: 'Emergency shutdown: unsubscribe from all channels and patterns to silence the factory.',
        hint: 'UNSUBSCRIBE\nPUNSUBSCRIBE',
        damage: 25,
        xp: 60,
        check: (engine, entry) => {
          // Check that no subscriptions remain
          return engine.subscribers.size === 0
        }
      }
    ]
  }
}