/**
 * Phase 6 REX Dialogue
 * Narrative dialogue for REX (Redis EXplorer) companion
 * for Leaderboard Arena, Message Factory, and Time Temple regions
 */

export const phase6Dialogue = {
  // Leaderboard Arena (Region 6) - Sorted Sets
  'leaderboard-arena': {
    intro: [
      'Welcome to the Leaderboard Arena, challenger. Here, every action is scored, every contender ranked.',
      'The Grand Arbiter watches from the podium. Only those who master the sorted set shall ascend.',
      'ZADD to enter, ZRANGE to survey, ZINCRBY to climb. Your rank is not given—it is earned.'
    ],
    hints: [
      'Sorted sets are like leaderboards: unique members, each with a score. Order is automatic.',
      'ZRANK gives rank from lowest score (0). ZREVRANK from highest (0). Choose your perspective.',
      'ZRANGEBYSCORE and ZREVRANGEBYSCORE let you query by score brackets. Use ( for exclusive bounds.',
      'ZUNIONSTORE merges leaderboards with WEIGHTS. ZINTERSTORE finds common contenders.',
      'ZPOPMIN/ZPOPMAX atomically remove and return extremes. Perfect for prize claiming.',
      'BZPOPMIN/BZPOPMAX block until a member exists. The arena never sleeps.'
    ],
    challengeStart: {
      'la-1': 'Your first contender steps into the light. Name them. Score them.',
      'la-2': 'The roster grows. Add three more souls to the ranking.',
      'la-3': 'Curiosity demands numbers. What does PlayerFour carry?',
      'la-4': 'From the bottom, where does PlayerThree stand?',
      'la-5': 'From the summit, where does the champion reside?',
      'la-6': 'Show me the podium. Top three. Scores revealed.',
      'la-7': 'The middle tier. Who dwells between 150 and 250?',
      'la-8': 'Count them all. How many contenders grace this arena?',
      'la-9': 'Narrow your gaze. How many between 100 and 200?',
      'la-10': 'A surge of effort. Boost PlayerOne by fifty.',
      'la-11': 'Two arenas, one ranking. Merge them with weighted glory.',
      'la-12': 'Veterans and contenders. Who appears in both? Intersect them.',
      'la-13': 'The weakest falls. Pop the minimum and claim their spot.',
      'la-14': 'Patience. Wait for a challenger in the waitlist. Timeout in five.',
      'la-15': 'A late entry arrives. Pop the maximum before they settle.',
      'la-16': 'Clean the bottom ranks. Remove the lowest two by position.',
      'la-17': 'Purge the unworthy. Strip all below 200 from the combined rolls.'
    },
    challengeComplete: {
      'la-1': 'PlayerOne inscribed at 100. The leaderboard lives.',
      'la-2': 'Four names now shine. The competition thickens.',
      'la-3': 'Three hundred. The summit claimed.',
      'la-4': 'Rank one from below. Steady progress.',
      'la-5': 'Rank zero from above. The view is different up here.',
      'la-6': 'Podium displayed. PlayerFour, PlayerTwo, PlayerThree.',
      'la-7': 'PlayerThree and PlayerTwo. The middle ground mapped.',
      'la-8': 'Four contenders. The arena fills.',
      'la-9': 'Three in range. The bracket defined.',
      'la-10': 'PlayerOne rises to 150. Momentum builds.',
      'la-11': 'Six souls united. Weights applied. A new hierarchy.',
      'la-12': 'Two veterans stand common. Intersection complete.',
      'la-13': 'PlayerOne removed at 150. The floor rises.',
      'la-14': 'Silence. The waitlist empty. Timeout reached.',
      'la-15': 'LateEntry claimed at 1000. Swift justice.',
      'la-16': 'Two removed. The leaderboard tightens.',
      'la-17': 'Scores below 200 purged. Only the strong remain.'
    },
    bossIntro: [
      'The Grand Arbiter descends. "You have climbed the ranks. Now face the final trial."',
      'Five finalists await. One champion. A hall of fame to build. An elite to extract.',
      'Show me you command the full power of the sorted set.'
    ],
    bossPhase: {
      'ga-1': 'Assemble the five finalists. Scores: 1000, 2000, 3000, 4000, 5000.',
      'ga-2': 'The Champion demands more. Grant them 10000 additional points.',
      'ga-3': 'Merge finalists with veterans. Weight the finalists double.',
      'ga-4': 'From the union, extract only those who were finalists. The elite.',
      'ga-5': 'Claim the podium. Remove the top three from the elite.'
    },
    bossPhaseComplete: {
      'ga-1': 'Finalists assembled. The arena holds its breath.',
      'ga-2': 'Champion ascends to 15000. Unreachable.',
      'ga-3': 'Hall of Fame forged. Weighted glory recorded.',
      'ga-4': 'The elite isolated. Five souls, purified.',
      'ga-5': 'Podium claimed. Two remain. The trial ends.'
    },
    bossDefeat: [
      'The Grand Arbiter kneels. "You have mastered the rankings. The arena is yours."',
      'The golden light of the leaderboard envelops you. ZSET WARDEN achievement unlocked.',
      'Onward, to the Message Factory. The pulse of communication awaits.'
    ],
    regionComplete: 'Leaderboard Arena conquered. Sorted sets bend to your will.'
  },

  // Message Factory (Region 7) - Pub/Sub
  'message-factory': {
    intro: [
      'The Message Factory hums with activity. Channels pulse. Patterns match. Information flows.',
      'The Broadcast Overlord oversees every transmission. Subscribe. Publish. Observe.',
      'Here, messages are not stored—they are delivered. Miss one, and it is gone forever.'
    ],
    hints: [
      'PUBLISH sends a message to a channel. Returns number of recipients (subscribers + pattern matches).',
      'SUBSCRIBE listens to exact channel names. UNSUBSCRIBE stops listening.',
      'PSUBSCRIBE uses glob patterns (* matches any, ? matches one). PUNSUBSCRIBE stops pattern listening.',
      'PUBSUB CHANNELS lists active channels. PUBSUB NUMSUB counts subscribers per channel.',
      'PUBSUB NUMPAT counts active pattern subscriptions.',
      'Messages are fire-and-forget. No history. No persistence. Pure real-time flow.'
    ],
    challengeStart: {
      'mf-1': 'Send the first signal. "System online" to factory:news.',
      'mf-2': 'Tune in. Subscribe to factory:news and listen.',
      'mf-3': 'Broadcast while listening. "Breaking: New update deployed".',
      'mf-4': 'Expand your reception. Three channels at once.',
      'mf-5': 'Think broader. Subscribe to the pattern factory:*.',
      'mf-6': 'Test the pattern. Publish to factory:notifications.',
      'mf-7': 'Narrow focus. Unsubscribe from factory:alerts.',
      'mf-8': 'Release the pattern. Unsubscribe from factory:*.',
      'mf-9': 'Survey the factory. List all factory:* channels.',
      'mf-10': 'Count the listeners. How many on factory:news and factory:events?',
      'mf-11': 'How many patterns currently active?',
      'mf-12': 'Simultaneous broadcast. Same message to three channels.',
      'mf-13': 'Cross-namespace alert. Subscribe to *:alerts.',
      'mf-14': 'Trigger the wildcard. Publish to system:alerts.',
      'mf-15': 'Silence the factory. Unsubscribe from all. Patterns too.'
    },
    challengeComplete: {
      'mf-1': 'Signal sent. Zero recipients, but the factory heard.',
      'mf-2': 'Subscribed. The channel flows through you now.',
      'mf-3': 'Message delivered. One recipient. The loop closes.',
      'mf-4': 'Three channels. Three streams. One listener.',
      'mf-5': 'Pattern locked. factory:* catches all.',
      'mf-6': 'Pattern matched. factory:notifications delivered.',
      'mf-7': 'factory:alerts released. One less stream.',
      'mf-8': 'Pattern released. The wildcard rests.',
      'mf-9': 'Channels listed. The factory map revealed.',
      'mf-10': 'Subscriber counts returned. Knowledge is power.',
      'mf-11': 'Pattern count known. The web measured.',
      'mf-12': 'Triple broadcast complete. Consistency achieved.',
      'mf-13': '*:alerts armed. Any namespace. Any alert.',
      'mf-14': 'system:alerts caught. Wildcard proves true.',
      'mf-15': 'Silence. All channels clear. All patterns void.'
    },
    bossIntro: [
      'The Broadcast Overlord materializes amidst static. "You understand the flow. Now command it."',
      'Command center. Tactical. Intel patterns. SitReps. Alerts. A full comms exercise.',
      'Execute the protocol. Leave no channel unmonitored, no message undelivered.'
    ],
    bossPhase: {
      'bo-1': 'Establish command. Subscribe to factory:command-center and factory:tactical.',
      'bo-2': 'Deploy intelligence. Pattern subscribe to factory:intel:*.',
      'bo-3': 'Broadcast sitrep. "SITREP: All systems nominal" to command-center.',
      'bo-4': 'Trigger urgent intel. "ALERT: Incoming transmission" to factory:intel:urgent.',
      'bo-5': 'Status check. List factory channels. Count active patterns.',
      'bo-6': 'Emergency shutdown. Silence everything. Unsubscribe all.'
    },
    bossPhaseComplete: {
      'bo-1': 'Command channels active. Strategic comms established.',
      'bo-2': 'Intel pattern deployed. All intel flows to you.',
      'bo-3': 'SitRep broadcast. Command center informed.',
      'bo-4': 'Urgent alert delivered. Pattern matched. Intel received.',
      'bo-5': 'Status retrieved. Factory mapped. Patterns counted.',
      'bo-6': 'Total silence. The factory goes dark. Control absolute.'
    },
    bossDefeat: [
      'The Broadcast Overlord dissolves into static. "You command the flow. The factory is yours."',
      'The cyan pulse of Pub/Sub courses through you. MESSAGE MASTER achievement unlocked.',
      'Onward, to the Time Temple. The sands of expiration await.'
    ],
    regionComplete: 'Message Factory conquered. Pub/Sub flows at your command.'
  },

  // Time Temple (Region 8) - Advanced TTL
  'time-temple': {
    intro: [
      'The Time Temple stands eternal. Here, every key knows its hour. Every moment measured.',
      'The Chronos Warden guards the timeline. Expire. Persist. Scan. Inspect.',
      'Time is not a constraint here—it is a tool. Wield it.'
    ],
    hints: [
      'EXPIRE sets TTL in seconds. PEXPIRE in milliseconds. Both accept NX/XX/GT/LT options.',
      'EXPIREAT/PEXPIREAT set absolute Unix timestamps (seconds/milliseconds).',
      'TTL returns seconds remaining. PTTL returns milliseconds. -2 = missing, -1 = persistent.',
      'PERSIST removes expiration entirely. The key becomes eternal.',
      'KEYS pattern finds all matching keys (blocking). SCAN iterates incrementally (non-blocking).',
      'TYPE reveals data type. OBJECT IDLETIME shows seconds since last access. OBJECT FREQ shows access frequency.',
      'Conditional options: NX=only if no expiry, XX=only if has expiry, GT=only if new>current, LT=only if new<current.'
    ],
    challengeStart: {
      'tt-1': 'Set the hourglass. temple:artifact expires in 60 seconds.',
      'tt-2': 'Millisecond precision. temple:relic expires in 30000ms.',
      'tt-3': 'Absolute time. temple:scroll expires at timestamp 1735689600.',
      'tt-4': 'Millisecond timestamp. temple:tablet expires at 1735689600000.',
      'tt-5': 'Check the sands. TTL of temple:artifact.',
      'tt-6': 'Check the grains. PTTL of temple:relic.',
      'tt-7': 'Eternal preservation. PERSIST temple:scroll.',
      'tt-8': 'Verify eternity. TTL of temple:scroll should be -1.',
      'tt-9': 'Check the void. TTL of nonexistent key returns -2.',
      'tt-10': 'Conditional NX. Try EXPIRE on tablet with NX (should fail).',
      'tt-11': 'Conditional XX. EXPIRE on tablet with XX (should succeed).',
      'tt-12': 'Greater than. EXPIRE tablet 300 GT (extend if longer).',
      'tt-13': 'Less than. EXPIRE tablet 60 LT (shorten if shorter).',
      'tt-14': 'List the temple. KEYS temple:*.',
      'tt-15': 'Scan the halls. SCAN 0 MATCH temple:* COUNT 10.',
      'tt-16': 'Inspect the artifact. TYPE temple:artifact.',
      'tt-17': 'Measure idle. OBJECT IDLETIME temple:artifact.',
      'tt-18': 'Measure frequency. OBJECT FREQ temple:artifact.',
      'tt-19': 'Past expiry. EXPIREAT temple:relic 1 (deletes immediately).',
      'tt-20': 'Confirm the void. TYPE temple:relic should be none.'
    },
    challengeComplete: {
      'tt-1': 'Hourglass set. 60 seconds to eternity.',
      'tt-2': 'Precision achieved. 30 seconds in milliseconds.',
      'tt-3': 'Timestamp sealed. The scroll knows its end.',
      'tt-4': 'Millisecond timestamp set. The tablet marked.',
      'tt-5': 'Sand measured. Seconds remain.',
      'tt-6': 'Grains counted. Milliseconds remain.',
      'tt-7': 'Scroll freed. No expiry binds it.',
      'tt-8': 'Confirmed. TTL returns -1. Eternal.',
      'tt-9': 'Void confirmed. -2 for the missing.',
      'tt-10': 'NX rejected. Tablet already timed.',
      'tt-11': 'XX accepted. Tablet expiry renewed.',
      'tt-12': 'GT honored. Expiry extended to 300.',
      'tt-13': 'LT honored. Expiry reduced to 60.',
      'tt-14': 'Temple keys revealed. All accounted for.',
      'tt-15': 'Scan complete. Cursor returned. Keys listed.',
      'tt-16': 'Type known. String. The artifact speaks.',
      'tt-17': 'Idle measured. Seconds since touch.',
      'tt-18': 'Frequency known. Access count revealed.',
      'tt-19': 'Past claimed. Relic deleted by time.',
      'tt-20': 'Void confirmed. Type is none. The relic is gone.'
    },
    bossIntro: [
      'The Chronos Warden materializes from the temporal mist. "You measure time. Now master it."',
      'Six trials. Eternal flame. Hourglass. Time-lock. Chronos key. Archive. Final sands.',
      'Show me you command expiration in all its forms.'
    ],
    bossPhase: {
      'cw-1': 'Light the eternal flame. Create temple:eternal-flame with NO expiration.',
      'cw-2': 'Turn the hourglass. temple:hourglass expires in exactly 10 seconds.',
      'cw-3': 'Seal the time-lock. temple:time-lock at timestamp 2000000000 via EXPIREAT.',
      'cw-4': 'Forge the chronos key. temple:chronos-key with 5000ms PEXPIRE.',
      'cw-5': 'Archive the timeline. SCAN all temple:* keys. TYPE each one.',
      'cw-6': 'Final sands. Make ALL temple keys persistent. PERSIST each.'
    },
    bossPhaseComplete: {
      'cw-1': 'Eternal flame burns. No expiry. Forever.',
      'cw-2': 'Hourglass turns. 10 seconds. Precise.',
      'cw-3': 'Time-lock sealed. Far future timestamp set.',
      'cw-4': 'Chronos key forged. 5 seconds in milliseconds.',
      'cw-5': 'Archive complete. All keys cataloged by type.',
      'cw-6': 'Final sands stilled. All expiries removed. Eternity achieved.'
    },
    bossDefeat: [
      'The Chronos Warden bows. "You have mastered time itself. The temple is yours."',
      'The mystical purple glow of TTL mastery surrounds you. TIME LORD achievement unlocked.',
      'Phase 6 complete. All regions conquered. The Redis Quest nears its end.'
    ],
    regionComplete: 'Time Temple conquered. Expiration bends to your will.'
  },

  // General Phase 6 transitions
  transitions: {
    '5-to-6': [
      'The Hash Haven fades behind you. Ahead, golden light reveals the Leaderboard Arena.',
      'Phase 6 begins. Three realms await: Rankings. Messages. Time.'
    ],
    '6-to-7': [
      'The Grand Arbiter falls. The arena\'s gold fades to cyan industrial light.',
      'The Message Factory activates. Conveyors of data hum to life.'
    ],
    '7-to-8': [
      'The Broadcast Overlord dissolves. Cyan static resolves into mystical purple.',
      'The Time Temple emerges from the mists. Gears turn. Hourglasses flow.'
    ],
    'phase6-complete': [
      'All three regions of Phase 6 lie conquered.',
      'Sorted Sets. Pub/Sub. Advanced TTL. Mastered.',
      'The final phase awaits. Prepare yourself, seeker.'
    ]
  }
}