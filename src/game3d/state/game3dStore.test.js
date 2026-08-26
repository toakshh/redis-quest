import { describe, it, expect, beforeEach } from 'vitest'
import { useGame3DStore, initial3DState } from './game3dStore.js'

describe('game3dStore', () => {
  beforeEach(() => {
    useGame3DStore.setState(initial3DState())
  })

  it('matches the initial shape', () => {
    expect(useGame3DStore.getState().phase).toBe('launcher')
    expect(useGame3DStore.getState().chapter).toBe(0)
    expect(useGame3DStore.getState().seed).toBeNull()
    expect(useGame3DStore.getState().ladderTier).toBe(0)
    expect(useGame3DStore.getState().fieldManualPages).toEqual([])
    expect(useGame3DStore.getState().vocabStage).toBe('physical')
    expect(useGame3DStore.getState().quality).toBe('auto')
    expect(useGame3DStore.getState().lastCheckpoint).toBeNull()
  })

  it('setPhase mutates only phase', () => {
    useGame3DStore.getState().setPhase('playing')
    const s = useGame3DStore.getState()
    expect(s.phase).toBe('playing')
    expect(s.chapter).toBe(0)
  })

  it('setChapter mutates only chapter', () => {
    useGame3DStore.getState().setChapter(3)
    const s = useGame3DStore.getState()
    expect(s.chapter).toBe(3)
    expect(s.phase).toBe('launcher')
  })

  it('setSeed mutates only seed', () => {
    useGame3DStore.getState().setSeed('gate-1337')
    expect(useGame3DStore.getState().seed).toBe('gate-1337')
  })

  it('setLadderTier(1) then setLadderTier(0) leaves tier at 1 (never decreases)', () => {
    useGame3DStore.getState().setLadderTier(1)
    useGame3DStore.getState().setLadderTier(0)
    expect(useGame3DStore.getState().ladderTier).toBe(1)
  })

  it('setLadderTier clamps to 0..3', () => {
    useGame3DStore.getState().setLadderTier(99)
    expect(useGame3DStore.getState().ladderTier).toBe(3)
  })

  it('unlockManualPage deduplicates', () => {
    useGame3DStore.getState().unlockManualPage('ch1-ttl')
    useGame3DStore.getState().unlockManualPage('ch1-ttl')
    expect(useGame3DStore.getState().fieldManualPages).toEqual(['ch1-ttl'])
  })

  it('updateSettings shallow-merges into settings without clobbering other fields', () => {
    useGame3DStore.getState().updateSettings({ reducedScares: true })
    const s = useGame3DStore.getState()
    expect(s.settings.reducedScares).toBe(true)
    expect(s.settings.threat).toBe('normal')
  })

  it('reset3D restores initial state', () => {
    useGame3DStore.getState().setPhase('playing')
    useGame3DStore.getState().setChapter(4)
    useGame3DStore.getState().unlockManualPage('x')
    useGame3DStore.getState().reset3D()
    expect(useGame3DStore.getState()).toMatchObject(initial3DState())
  })
})
