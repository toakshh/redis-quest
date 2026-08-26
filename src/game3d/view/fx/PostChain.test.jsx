// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import PostChain from './PostChain.jsx'

// Mock postprocessing library things to avoid WebGL crashes
vi.mock('@react-three/postprocessing', () => {
  const React = require('react')
  return {
    EffectComposer: ({ children }) => <div data-testid="effect-composer">{children}</div>,
    SSAO: vi.fn(() => <div data-testid="ssao" />),
    Bloom: vi.fn(() => <div data-testid="bloom" />),
    ChromaticAberration: React.forwardRef((props, ref) => <div data-testid="chromatic-aberration" />),
    Glitch: React.forwardRef((props, ref) => <div data-testid="glitch" />),
    Noise: React.forwardRef((props, ref) => <div data-testid="noise" />),
    Vignette: React.forwardRef((props, ref) => <div data-testid="vignette" />),
    SMAA: vi.fn(() => <div data-testid="smaa" />)
  }
})

vi.mock('postprocessing', () => {
  return {
    GlitchMode: { DISABLED: 0, SPORADIC: 1 }
  }
})

let useFrameCb = null
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb) => {
    useFrameCb = cb
  }
}))

vi.mock('../SimProvider.jsx', () => ({
  useSim: () => ({
    world: {
      clock: () => 1000,
      hitStopUntilMs: 0,
      latencyP99Ms: 15,
      playerHealth01: 0.5
    },
    runtime: {
      engine: {
        stats: { evictedKeys: 0 },
        hitRatio: () => 0.8
      }
    }
  })
}))

describe('PostChain', () => {
  it('1. Renders the EffectComposer and exact chain', () => {
    const { getByTestId } = render(<PostChain />)
    expect(getByTestId('effect-composer')).toBeDefined()
    expect(getByTestId('ssao')).toBeDefined()
    expect(getByTestId('bloom')).toBeDefined()
    expect(getByTestId('chromatic-aberration')).toBeDefined()
    expect(getByTestId('glitch')).toBeDefined()
    expect(getByTestId('noise')).toBeDefined()
    expect(getByTestId('vignette')).toBeDefined()
    expect(getByTestId('smaa')).toBeDefined()
  })

  it('2. Hooks up useFrame without crashing', () => {
    render(<PostChain />)
    expect(useFrameCb).toBeDefined()
    expect(() => {
      useFrameCb({ clock: { elapsedTime: 1 } }, 0.016)
    }).not.toThrow()
  })
})
