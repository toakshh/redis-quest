// scareFairness.js
export function ruleNoScareNearPreciseInput(candidate, context) {
  if (context.isPressureTest) return true
  if (context.timeSincePreciseInput !== undefined && context.timeSincePreciseInput < 3000) return false
  return true
}

export function ruleNoInstantKillWithoutTelegraph(candidate, context) {
  if (candidate.isInstantKill && !candidate.hasTelegraph) return false
  return true
}

export function ruleNoScareDuringDebrief(candidate, context) {
  if (context.inDebrief) return false
  return true
}

export function ruleNoRepeatsWithinFour(candidate, context) {
  const history = context.recentScares || []
  const recentThree = history.slice(-3)
  if (recentThree.includes(candidate.id)) return false
  return true
}

export function ruleMustHaveAudioCue(candidate, context) {
  return typeof candidate.audioCue === 'string' && candidate.audioCue.length > 0
}

export const FAIRNESS_RULES = [
  ruleNoScareNearPreciseInput,
  ruleNoInstantKillWithoutTelegraph,
  ruleNoScareDuringDebrief,
  ruleNoRepeatsWithinFour,
  ruleMustHaveAudioCue
]

export function evaluateFairness(candidate, context) {
  for (const rule of FAIRNESS_RULES) {
    if (!rule(candidate, context)) return false
  }
  return true
}
