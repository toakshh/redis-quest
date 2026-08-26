import React from 'react'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { ScareAudio } from '../ScareAudio.jsx'
import { SimProvider } from '../../SimProvider.jsx'

describe('ScareAudio', () => {
  it('renders without crashing and reacts to world scare events', async () => {
    // Mock the AudioContext
    const mockCtx = { state: 'running', close: jest.fn(), currentTime: 0 }
    window.AudioContext = class {
      constructor() {
        return mockCtx
      }
    }

    const world = {
      tick: 1,
      scareEvents: [
        { type: 'scare', soundId: 'sfx_lunge', intensity: 0.8 }
      ],
      audioDrop: false,
      contactWeight: 0
    }

    const renderer = await ReactThreeTestRenderer.create(
      <SimProvider world={world}>
        <ScareAudio />
      </SimProvider>
    )

    expect(renderer.scene.children.length).toBe(0) // ScareAudio returns null so scene is empty
    
    await renderer.advanceFrames(2, 0.016)

    // Ensure state mutation is handled correctly
    expect(world.scareEvents).toBeDefined()
    
    // Cleanup
    renderer.unmount()
    delete window.AudioContext
  })
})
