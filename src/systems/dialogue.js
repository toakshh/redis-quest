// dialogue.js — bundles every REX dialogue JSON into one module. Text lives in
// src/data/rex-dialogue/*.json; editing a file hot-reloads in dev with zero
// code changes (per the "data-driven, hot-reloadable" constraint). All strings
// are validated against the 7th-grade readability gate in CI.

import generic from '../data/rex-dialogue/generic.json'
import memoryVillage from '../data/rex-dialogue/memory-village.json'
import stringForest from '../data/rex-dialogue/string-forest.json'
import listHarbor from '../data/rex-dialogue/list-harbor.json'
import setCaverns from '../data/rex-dialogue/set-caverns.json'
import hashCity from '../data/rex-dialogue/hash-city.json'
import leaderboardArena from '../data/rex-dialogue/leaderboard-arena.json'
import performanceLab from '../data/rex-dialogue/performance-lab.json'
import scriptTemple from '../data/rex-dialogue/script-temple.json'
import redisCore from '../data/rex-dialogue/redis-core.json'
import personalities from '../data/rex-dialogue/personalities.json'

export const DIALOGUE = {
  generic,
  'memory-village': memoryVillage,
  'string-forest': stringForest,
  'list-harbor': listHarbor,
  'set-caverns': setCaverns,
  'hash-city': hashCity,
  'leaderboard-arena': leaderboardArena,
  'performance-lab': performanceLab,
  'script-temple': scriptTemple,
  'redis-core': redisCore,
  personalities,
}

export function regionDialogue(regionId) {
  return DIALOGUE[regionId] || DIALOGUE.generic
}
