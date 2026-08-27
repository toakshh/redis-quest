/**
 * Region 6: Leaderboard Arena (Sorted Sets)
 * Ascend the ranks using Sorted Sets - where every score tells a story
 */

export const leaderboardArena = {
  id: 'leaderboard-arena',
  name: 'Leaderboard Arena',
  theme: 'competitive',
  color: '#FFD700',
  description: 'Ascend the ranks using Sorted Sets - where every score tells a story',
  order: 6,
  requiredCommands: [
    'ZADD', 'ZREM', 'ZSCORE', 'ZRANK', 'ZREVRANK',
    'ZRANGE', 'ZREVRANGE', 'ZRANGEBYSCORE', 'ZREVRANGEBYSCORE',
    'ZCARD', 'ZCOUNT', 'ZINCRBY',
    'ZUNIONSTORE', 'ZINTERSTORE',
    'ZPOPMIN', 'BZPOPMIN', 'BZPOPMAX',
    'ZREMRANGEBYRANK', 'ZREMRANGEBYSCORE'
  ],
  visualizerConfig: {
    type: 'leaderboard',
    maxEntries: 100,
    animation: 'glow'
  },
  challenges: [
    {
      id: 'la-1',
      name: 'First Blood',
      description: 'Add your first contender to the arena leaderboard.',
      hint: 'ZADD arena:leaderboard 100 "PlayerOne"',
      command: 'ZADD',
      task: 'Create a sorted set `arena:leaderboard` with member "PlayerOne" and score 100.',
      check: (engine) => {
        const entry = engine._get('arena:leaderboard')
        return entry && entry.type === 'zset' && entry.value.scoreOf('PlayerOne') === 100
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'la-2',
      name: 'Rising Stars',
      description: 'Add multiple competitors at once to populate the rankings.',
      hint: 'ZADD arena:leaderboard 200 "PlayerTwo" 150 "PlayerThree" 300 "PlayerFour"',
      command: 'ZADD',
      task: 'Add three more members to `arena:leaderboard`: "PlayerTwo" (200), "PlayerThree" (150), "PlayerFour" (300).',
      check: (engine) => {
        const entry = engine._get('arena:leaderboard')
        if (!entry || entry.type !== 'zset') return false
        return entry.value.scoreOf('PlayerTwo') === 200 &&
               entry.value.scoreOf('PlayerThree') === 150 &&
               entry.value.scoreOf('PlayerFour') === 300
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'la-3',
      name: 'Score Check',
      description: 'Retrieve the score of a specific competitor.',
      hint: 'ZSCORE arena:leaderboard "PlayerFour"',
      command: 'ZSCORE',
      task: 'Get the score of "PlayerFour" from `arena:leaderboard`.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'bulk' && lastReply.value === '300'
      },
      xp: 20,
      damage: 12
    },
    {
      id: 'la-4',
      name: 'Rank and File',
      description: 'Find the zero-based rank of a competitor (lowest score = rank 0).',
      hint: 'ZRANK arena:leaderboard "PlayerThree"',
      command: 'ZRANK',
      task: 'Get the rank of "PlayerThree" in `arena:leaderboard`.',
      check: (engine, lastReply) => {
        // PlayerThree has 150, PlayerOne has 100 -> rank 1
        return lastReply && lastReply.type === 'integer' && lastReply.value === 1
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'la-5',
      name: 'Reverse Rankings',
      description: 'Find the rank from highest score (highest score = rank 0).',
      hint: 'ZREVRANK arena:leaderboard "PlayerFour"',
      command: 'ZREVRANK',
      task: 'Get the reverse rank of "PlayerFour" in `arena:leaderboard`.',
      check: (engine, lastReply) => {
        // PlayerFour has 300 (highest) -> rev rank 0
        return lastReply && lastReply.type === 'integer' && lastReply.value === 0
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'la-6',
      name: 'Top Contenders',
      description: 'Retrieve the top 3 competitors by score (highest first).',
      hint: 'ZREVRANGE arena:leaderboard 0 2 WITHSCORES',
      command: 'ZREVRANGE',
      task: 'Get the top 3 members from `arena:leaderboard` with their scores.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        // Should return [PlayerFour, 300, PlayerTwo, 200, PlayerThree, 150]
        const vals = lastReply.value.map(v => v.value)
        return vals[0] === 'PlayerFour' && vals[1] === '300' &&
               vals[2] === 'PlayerTwo' && vals[3] === '200'
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'la-7',
      name: 'Score Range Query',
      description: 'Find all competitors with scores between 150 and 250.',
      hint: 'ZRANGEBYSCORE arena:leaderboard 150 250 WITHSCORES',
      command: 'ZRANGEBYSCORE',
      task: 'Get members from `arena:leaderboard` with scores between 150 and 250 (inclusive).',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        const vals = lastReply.value.map(v => v.value)
        // Should have PlayerThree (150) and PlayerTwo (200)
        return vals.includes('PlayerThree') && vals.includes('150') &&
               vals.includes('PlayerTwo') && vals.includes('200')
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'la-8',
      name: 'Count the Field',
      description: 'Count total competitors and those in a score range.',
      hint: 'ZCARD arena:leaderboard',
      command: 'ZCARD',
      task: 'Get the total number of members in `arena:leaderboard`.',
      check: (engine, lastReply) => {
        return lastReply && lastReply.type === 'integer' && lastReply.value === 4
      },
      xp: 20,
      damage: 12
    },
    {
      id: 'la-9',
      name: 'Range Count',
      description: 'Count competitors within a specific score bracket.',
      hint: 'ZCOUNT arena:leaderboard 100 200',
      command: 'ZCOUNT',
      task: 'Count members in `arena:leaderboard` with scores between 100 and 200.',
      check: (engine, lastReply) => {
        // PlayerOne (100), PlayerThree (150), PlayerTwo (200) = 3
        return lastReply && lastReply.type === 'integer' && lastReply.value === 3
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'la-10',
      name: 'Score Boost',
      description: 'Increment a competitor\'s score by a given amount.',
      hint: 'ZINCRBY arena:leaderboard 50 "PlayerOne"',
      command: 'ZINCRBY',
      task: 'Increase "PlayerOne"\'s score by 50 in `arena:leaderboard`.',
      check: (engine, lastReply) => {
        // PlayerOne was 100, now 150
        return lastReply && lastReply.type === 'bulk' && lastReply.value === '150'
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'la-11',
      name: 'Union of Arenas',
      description: 'Merge two leaderboards into a combined ranking.',
      hint: 'ZADD arena:qualifiers 80 "QualOne" 120 "QualTwo"\nZUNIONSTORE arena:combined 2 arena:leaderboard arena:qualifiers',
      command: 'ZUNIONSTORE',
      task: 'Create `arena:qualifiers` with two members, then union with `arena:leaderboard` into `arena:combined`.',
      check: (engine) => {
        const entry = engine._get('arena:combined')
        if (!entry || entry.type !== 'zset') return false
        // Should have all 6 members
        return entry.value.length === 6
      },
      xp: 40,
      damage: 22
    },
    {
      id: 'la-12',
      name: 'Intersection of Champions',
      description: 'Find competitors who appear in both leaderboards.',
      hint: 'ZADD arena:veterans 150 "PlayerOne" 200 "PlayerTwo" 500 "Legend"\nZINTERSTORE arena:common 2 arena:leaderboard arena:veterans',
      command: 'ZINTERSTORE',
      task: 'Create `arena:veterans` then intersect with `arena:leaderboard` into `arena:common`.',
      check: (engine) => {
        const entry = engine._get('arena:common')
        if (!entry || entry.type !== 'zset') return false
        // Should have PlayerOne and PlayerTwo (common members)
        return entry.value.length === 2 &&
               entry.value.scoreOf('PlayerOne') !== null &&
               entry.value.scoreOf('PlayerTwo') !== null
      },
      xp: 40,
      damage: 22
    },
    {
      id: 'la-13',
      name: 'Pop the Bottom',
      description: 'Remove and return the lowest-scoring competitor.',
      hint: 'ZPOPMIN arena:leaderboard',
      command: 'ZPOPMIN',
      task: 'Remove and return the member with the lowest score from `arena:leaderboard`.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        const vals = lastReply.value.map(v => v.value)
        // Lowest was PlayerOne at 150 (after incrby)
        return vals[0] === 'PlayerOne' && vals[1] === '150'
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'la-14',
      name: 'Blocking Pop Min',
      description: 'Wait for a member to appear in a sorted set and pop the minimum.',
      hint: 'BZPOPMIN arena:waitlist 5',
      command: 'BZPOPMIN',
      task: 'Use BZPOPMIN on `arena:waitlist` with a 5 second timeout (returns nil if empty).',
      check: (engine, lastReply) => {
        // In our mock engine, this returns nil when empty
        return lastReply && lastReply.type === 'nil'
      },
      xp: 25,
      damage: 15
    },
    {
      id: 'la-15',
      name: 'Blocking Pop Max',
      description: 'Wait for a member and pop the maximum score.',
      hint: 'ZADD arena:waitlist 1000 "LateEntry"\nBZPOPMAX arena:waitlist 5',
      command: 'BZPOPMAX',
      task: 'Add a member to `arena:waitlist`, then use BZPOPMAX to pop the highest score.',
      check: (engine, lastReply) => {
        if (!lastReply || lastReply.type !== 'array') return false
        const vals = lastReply.value.map(v => v.value)
        return vals[0] === 'arena:waitlist' && vals[1] === 'LateEntry' && vals[2] === '1000'
      },
      xp: 30,
      damage: 18
    },
    {
      id: 'la-16',
      name: 'Clean Sweep by Rank',
      description: 'Remove all competitors ranked 0 to 1 (lowest scores).',
      hint: 'ZREMRANGEBYRANK arena:leaderboard 0 1',
      command: 'ZREMRANGEBYRANK',
      task: 'Remove the two lowest-ranked members from `arena:leaderboard`.',
      check: (engine) => {
        const entry = engine._get('arena:leaderboard')
        if (!entry || entry.type !== 'zset') return false
        // After removing 2 lowest, should have 2 left (was 4, popped 1, removed 2 = 1 left? Let's check)
        // Original: PlayerOne(150), PlayerThree(150), PlayerTwo(200), PlayerFour(300)
        // After ZPOPMIN: PlayerThree(150), PlayerTwo(200), PlayerFour(300)
        // After ZREMRANGEBYRANK 0 1: removes PlayerThree(150) and PlayerTwo(200)
        // Left: PlayerFour(300) = 1
        return entry.value.length === 1 && entry.value.scoreOf('PlayerFour') === 300
      },
      xp: 35,
      damage: 20
    },
    {
      id: 'la-17',
      name: 'Score Purge',
      description: 'Remove all competitors with scores below a threshold.',
      hint: 'ZREMRANGEBYSCORE arena:combined -inf (200',
      command: 'ZREMRANGEBYSCORE',
      task: 'Remove all members from `arena:combined` with scores less than 200 (exclusive).',
      check: (engine) => {
        const entry = engine._get('arena:combined')
        if (!entry || entry.type !== 'zset') return false
        // Check that no member has score < 200
        for (const node of entry.value.toArray()) {
          if (node.score < 200) return false
        }
        return true
      },
      xp: 35,
      damage: 20
    }
  ],
  boss: {
    id: 'grand-arbiter',
    name: 'The Grand Arbiter',
    title: 'KEEPER OF THE RANKINGS',
    maxHealth: 150,
    challenges: [
      {
        id: 'ga-1',
        key: 'arena:finalists',
        task: 'Assemble the finalists: create sorted set `arena:finalists` with 5 members having scores 1000, 2000, 3000, 4000, 5000.',
        hint: 'ZADD arena:finalists 1000 "Challenger1" 2000 "Challenger2" 3000 "Challenger3" 4000 "Challenger4" 5000 "Champion"',
        damage: 20,
        xp: 40,
        check: (engine, entry) => {
          return entry && entry.type === 'zset' && entry.value.length === 5
        }
      },
      {
        id: 'ga-2',
        key: 'arena:champion',
        task: 'Crown the champion: increment "Champion"\'s score by 10000 using ZINCRBY.',
        hint: 'ZINCRBY arena:finalists 10000 "Champion"',
        damage: 25,
        xp: 50,
        check: (engine, entry) => {
          return entry && entry.type === 'zset' && entry.value.scoreOf('Champion') === 15000
        }
      },
      {
        id: 'ga-3',
        key: 'arena:hall-of-fame',
        task: 'Build the hall of fame: union `arena:finalists` and `arena:veterans` into `arena:hall-of-fame` with WEIGHTS 2 1.',
        hint: 'ZUNIONSTORE arena:hall-of-fame 2 arena:finalists arena:veterans WEIGHTS 2 1',
        damage: 30,
        xp: 60,
        check: (engine, entry) => {
          return entry && entry.type === 'zset' && entry.value.length >= 5
        }
      },
      {
        id: 'ga-4',
        key: 'arena:elite',
        task: 'Extract the elite: intersect `arena:hall-of-fame` with `arena:finalists` into `arena:elite`.',
        hint: 'ZINTERSTORE arena:elite 2 arena:hall-of-fame arena:finalists',
        damage: 30,
        xp: 60,
        check: (engine, entry) => {
          return entry && entry.type === 'zset' && entry.value.length === 5
        }
      },
      {
        id: 'ga-5',
        key: 'arena:top3',
        task: 'Claim the podium: pop the top 3 from `arena:elite` using ZPOPMAX (or ZREVRANGE + ZREM).',
        hint: 'ZPOPMIN arena:elite 3  (Note: ZPOPMAX not in this engine, use ZREVRANGE 0 2 then ZREM)',
        damage: 25,
        xp: 50,
        check: (engine, entry) => {
          // After popping top 3, should have 2 left
          return entry && entry.type === 'zset' && entry.value.length === 2
        }
      }
    ]
  }
}