// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, act, screen, cleanup } from '@testing-library/react'
import DebriefCard from '../view/hud/DebriefCard.jsx'
import FieldManualPanel from '../view/hud/FieldManualPanel.jsx'
import Hud from '../view/hud/Hud.jsx'
import RexChannel from '../view/hud/RexChannel.jsx'
import { createGameWorld } from '../sim/createGameWorld.js'

afterEach(() => {
  cleanup()
})

describe('3D Story and Pedagogy Integration', () => {
  it('1. DebriefCard pauses timeScale on mount and restores on dismiss', () => {
    const mockWorld = { timeScale: 1 }
    const mockData = {
      whatHappened: 'Testing bad cache config',
      whatYouDid: 'Added TTL to a static key',
      realWorldName: 'Cache Eviction Timing',
      actualCommand: 'EXPIRE user:100 60',
      whenToUse: 'Avoid memory leaks by setting lifetimes',
      ifWrong: 'Keyspace exhaustion OOM'
    }
    const onDismiss = vi.fn()

    const { getByTestId, unmount } = render(
      <DebriefCard world={mockWorld} debriefData={mockData} onDismiss={onDismiss} />
    )

    // Verify timeScale is paused (0)
    expect(mockWorld.timeScale).toBe(0)
    
    // Verify all contents render properly
    expect(getByTestId('f1').textContent).toBe(mockData.whatHappened)
    expect(getByTestId('f2').textContent).toBe(mockData.whatYouDid)
    expect(getByTestId('f3').textContent).toBe(mockData.realWorldName)
    expect(getByTestId('f4').textContent).toBe(mockData.actualCommand)
    expect(getByTestId('f5').textContent).toBe(mockData.whenToUse)
    expect(getByTestId('f6').textContent).toBe(mockData.ifWrong)

    // Click continue
    fireEvent.click(getByTestId('btn-dismiss'))
    expect(onDismiss).toHaveBeenCalled()

    // Unmount and verify timeScale is restored to 1
    unmount()
    expect(mockWorld.timeScale).toBe(1)
  })

  it('2. FieldManualPanel exports valid Markdown records when opened', () => {
    const mockFieldManual = {
      exportMarkdown: () => '# User Records\n- EXPIRE: set key lifetime\n- SETEX: atomic set with TTL'
    }
    const mockWorld = {
      timeScale: 1,
      teachingLayer: {
        fieldManual: mockFieldManual
      }
    }

    const { getByTestId, rerender } = render(
      <FieldManualPanel world={mockWorld} isOpen={false} onClose={() => {}} />
    )

    // When closed, should return null
    expect(screen.queryByTestId('field-manual-panel')).toBeNull()

    // Open it
    rerender(<FieldManualPanel world={mockWorld} isOpen={true} onClose={() => {}} />)
    const panel = getByTestId('field-manual-panel')
    expect(panel).toBeDefined()
    expect(panel.textContent).toContain('EXPIRE: set key lifetime')
    expect(mockWorld.timeScale).toBe(0) // Pauses simulation while manual is read
  })

  it('3. RexChannel displays correct hint tiers and degrades on high latency', () => {
    const mockBus = {
      listeners: {},
      on(event, cb) {
        this.listeners[event] = cb
      },
      off(event, cb) {
        delete this.listeners[event]
      },
      emit(event, data) {
        if (this.listeners[event]) {
          this.listeners[event](data)
        }
      }
    }
    const mockWorld = {
      latencyP99Ms: 25, // High latency > 15ms targets connection degradation
      runtime: {
        bus: mockBus
      }
    }

    const { getByTestId, queryByTestId, rerender } = render(
      <RexChannel world={mockWorld} />
    )

    // Initially no visible message
    expect(queryByTestId('rex-channel')).toBeNull()

    // Trigger hint event
    act(() => {
      mockBus.emit('sim:hint', { text: 'Scan memory for empty keys', tier: 2 })
    })

    // Now channel should show degraded/channel visual feedback because simulated latency is 25ms
    const rChannel = getByTestId('rex-channel')
    expect(rChannel).toBeDefined()
    expect(rChannel.textContent).toContain('CONNECTION DEGRADED')
    expect(rChannel.textContent).toContain('Scan memory for empty keys')

    // Rerender with low latency and verify normal rendering
    const mockWorldLowLatency = {
      latencyP99Ms: 4,
      runtime: {
        bus: mockBus
      }
    }
    rerender(<RexChannel world={mockWorldLowLatency} />)

    // Re-emit to trigger the updated handler bound to world with low latency
    act(() => {
      mockBus.emit('sim:hint', { text: 'Scan memory for empty keys', tier: 2 })
    })

    expect(rChannel.textContent).toContain('HINT TIER 2')
  })

  it('4. Full Game3DRoot and Scene integration with a simulated command lifecycle', async () => {
    vi.resetModules()
    vi.doMock('@react-three/fiber', async () => {
      const React = await import('react')
      return {
        Canvas: ({ children }) =>
          React.createElement(
            'div',
            { 'data-testid': 'canvas' },
            children,
          ),
        useFrame: () => {},
        useThree: () => ({
          camera: { position: { set: () => {} }, rotation: { set: () => {}, order: 'YXZ' } },
          gl: { domElement: document.createElement('canvas') },
        }),
      }
    })
    vi.doMock('@react-three/drei', async () => {
      const React = await import('react')
      return { AdaptiveDpr: () => React.createElement('div', { 'data-testid': 'adaptivedpr' }) }
    })

    const { default: Game3DRoot } = await import('../view/Game3DRoot.jsx')
    const game = createGameWorld({ seed: 'pedagogy-test' })
    
    // Mount root
    const { getByTestId } = render(
      <Game3DRoot seed="pedagogy-test" onExit={() => {}} />
    )

    // Initially entered is false. Click root surface to enter.
    const rootDiv = getByTestId('canvas')
    fireEvent.click(rootDiv)

    // Verify HUD is present
    expect(getByTestId('ttl-bar')).toBeDefined()
    expect(getByTestId('objective-list')).toBeDefined()

    // Verify the initial game world details
    const initialTtlText = getByTestId('ttl-bar').textContent
    expect(initialTtlText).toMatch(/\d+\.\ds/) // standard xx.xs display

    // Trigger normal hint request
    act(() => {
      game.world.teachingLayer.requestHint()
    })

    vi.doUnmock('@react-three/fiber')
    vi.doUnmock('@react-three/drei')
    game.dispose()
  })
})
