/**
 * Phase 6 Regions Index
 * Exports all Phase 6 region data modules
 */

export { leaderboardArena } from './leaderboardArena.js'
export { messageFactory } from './messageFactory.js'
export { timeTemple } from './timeTemple.js'

// Convenience array for iteration
export const phase6Regions = [leaderboardArena, messageFactory, timeTemple]

// Region lookup by ID
export const phase6RegionsById = {
  'leaderboard-arena': leaderboardArena,
  'message-factory': messageFactory,
  'time-temple': timeTemple
}