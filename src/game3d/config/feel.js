// Every game-feel number lives here. Do not scatter timing constants into
// components — feel is iterated dozens of times and must be tunable from
// one file.

export const FEEL = {
  camera: {
    fovDefault: 75,
    fovSprint: 82,
    fovAdsMultiplier: 0.82,
    fovLerpMs: 180,
    headBobHz: 1.2,
    headBobAmplitude: 0.035,
    strafeRollDeg: 1.5,
    landingDipM: 0.12,
    landingDipMs: 220,
  },
  move: {
    walkSpeed: 4.2,
    sprintSpeed: 7.0,
    crouchSpeed: 2.0,
    slideImpulse: 9.5,
    slideDurationMs: 650,
    jumpVelocity: 5.2,
    gravity: -18.0,
    airControl: 0.28,
    groundAccel: 48,
    groundFriction: 12,
    coyoteTimeMs: 120,
  },
  weapon: {
    recoilStiffness: 180,
    recoilDamping: 12,
    swayLagMs: 90,
    swayAmplitudeDeg: 1.8,
    adsLerpMs: 140,
    breathHz: 0.25,
    breathAmplitudeDeg: 0.35,
  },
  impact: {
    hitStopMs: 60,
    flashFrames: 3,
    cameraKickDeg: 2.4,
    shakeDecayPerSec: 6.0,
    shakeMaxDeg: 3.0,
  },
  ui: {
    cardComposerSlowFactor: 0.35,
    terminalSlowFactor: 0.25,
    receiptVisibleMs: 500,
    hintIdleTriggerMs: 25_000,
  },
}
