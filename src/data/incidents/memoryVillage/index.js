import { brokenGateIncident } from './brokenGate.js'
import { staleCacheIncident } from './staleCache.js'
import { endlessShieldIncident } from './endlessShield.js'
import { corruptedUserIncident } from './corruptedUser.js'
import { cacheRotStalkerIncident } from './cacheRotStalker.js'

export {
  brokenGateIncident,
  staleCacheIncident,
  endlessShieldIncident,
  corruptedUserIncident,
  cacheRotStalkerIncident,
}

export const MEMORY_VILLAGE_INCIDENTS = [
  brokenGateIncident,
  staleCacheIncident,
  endlessShieldIncident,
  corruptedUserIncident,
  cacheRotStalkerIncident,
]

export default MEMORY_VILLAGE_INCIDENTS
