// The 3D mode's own zustand store (Law L3: this file, and everything that
// imports it, must never reach into src/store/gameStore.js — the 2D game's
// store is a completely separate product with separate state). No
// persistence side effects live here; persistence is wired at the call
// site through persistence3d.js.

import { create } from 'zustand'

export function initial3DState() {
  return {
    phase: 'launcher', // 'launcher' | 'loading' | 'playing' | 'paused' | 'debrief' | 'ended'
    chapter: 0, // 0 = not started, 1..6
    seed: null, // string | null
    ladderTier: 0, // 0..3 — the interaction ladder
    fieldManualPages: [], // array of page ids, in unlock order
    vocabStage: 'physical', // 'physical' | 'mixed' | 'real'
    settings: {
      threat: 'normal', // 'low' | 'normal' | 'high'
      puzzlePressure: 'normal',
      reducedScares: false,
      photosensitiveSafe: false,
      audioSpikeLimiter: false,
      predictableMode: false,
      headBob: true,
      cameraShake: true,
      subtitles: true,
      captions: true,
    },
    quality: 'auto', // 'auto' | 'low' | 'medium' | 'high'
    lastCheckpoint: null,
  }
}

export const useGame3DStore = create((set, get) => ({
  ...initial3DState(),

  setPhase(phase) {
    set({ phase })
  },

  setChapter(n) {
    set({ chapter: n })
  },

  setSeed(seed) {
    set({ seed })
  },

  setLadderTier(tier) {
    const clamped = Math.max(0, Math.min(3, tier))
    set({ ladderTier: Math.max(get().ladderTier, clamped) })
  },

  unlockManualPage(pageId) {
    const pages = get().fieldManualPages
    if (pages.includes(pageId)) return
    set({ fieldManualPages: [...pages, pageId] })
  },

  setVocabStage(stage) {
    set({ vocabStage: stage })
  },

  updateSettings(partial) {
    set({ settings: { ...get().settings, ...partial } })
  },

  setQuality(q) {
    set({ quality: q })
  },

  setCheckpoint(checkpoint) {
    set({ lastCheckpoint: checkpoint })
  },

  reset3D() {
    set(initial3DState())
  },
}))
