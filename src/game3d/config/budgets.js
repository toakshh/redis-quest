// Performance budgets for Protocol Zero. These numbers are asserted by
// tests (see src/game3d/sim/SimWorld.test.js and the frame-budget benchmark
// in Phase 2). Do NOT edit a value here to make a failing test pass — fix
// the code that is over budget instead.

export const BUDGETS = {
  frame: {
    totalMs: 16.6,
    simStepMs: 2.0,
    physicsMs: 2.5,
    redisMs: 0.5,
    sceneUpdateMs: 1.5,
    drawMs: 4.0,
    postMs: 3.5,
    hudMs: 0.5,
    headroomMs: 2.1,
  },
  scene: {
    maxDrawCalls: 220,
    maxLevelChunks: 12,
    maxRealtimeLightsPerRoom: 4,
    maxParticleSystems: 8,
    lod1DistanceM: 25,
    lod2DistanceM: 60,
    hardCullDistanceM: 90,
  },
  sim: {
    maxEntities: 400,
    fixedHz: 60,
    directorIntervalTicks: 15,
    scareIntervalTicks: 15,
  },
  audio: {
    maxPannerNodes: 24,
    scareBusHeadroomDb: 12,
    combatDuckDb: -4,
    combatDuckMs: 60,
  },
  quality: {
    degradeBelowFps: 50,
    restoreAboveFps: 58,
    dprMin: 0.6,
    dprMax: 2.0,
  },
  bundle: {
    max3dChunkGzipBytes: 2_200_000,
    max2dGrowthBytes: 4_096,
    maxChapterAssetBytes: 35_000_000,
  },
}
