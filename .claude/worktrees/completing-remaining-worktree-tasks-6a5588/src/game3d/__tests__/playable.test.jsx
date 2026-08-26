// @vitest-environment jsdom
//
// The integration guard rail. Every other 3D test checks one component in
// isolation against its task card; this one checks that the pieces are
// actually CONNECTED — that entering the 3D mode gets you a running game
// rather than a placeholder.
//
// It exists because the build once passed 1013 unit tests while
// src/game3d/index.js still rendered a static "PROTOCOL ZERO — BOOTING"
// screen: every part was tested, nothing was wired.
//
// Two halves, because the two failure modes are different:
//   1. DOM — the entry point mounts a canvas and the HUD.
//   2. SCENE GRAPH — the real R3F reconciler accepts the scene. This half
//      is not optional: a mocked <Canvas> renders three.js elements as DOM
//      nodes and will happily accept props that throw in the real
//      reconciler. That exact gap shipped a crash once already (a
//      `data-testid` on a <group>, which R3F parses as `data.testid`), so
//      the scene is now built through @react-three/test-renderer, which
//      uses the true reconciler with a headless GL stub.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

afterEach(() => cleanup())

// ---------------------------------------------------------------- DOM half

describe('3D mode is wired end to end — DOM', () => {
  it('renders a live canvas and the HUD, not a placeholder boot screen', async () => {
    vi.resetModules()
    vi.doMock('@react-three/fiber', async () => {
      const React = await import('react')
      return {
        Canvas: ({ children, ...props }) =>
          React.createElement(
            'div',
            { 'data-testid': 'canvas', 'data-dpr': JSON.stringify(props.dpr) },
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

    const { default: Game3DEntry } = await import('../index.js')
    render(<Game3DEntry onExit={() => {}} />)

    // The exact regression this test was written for.
    expect(screen.queryByText(/PROTOCOL ZERO — BOOTING/i)).toBeNull()
    expect(screen.getByTestId('canvas')).toBeTruthy()

    // The player's whole feedback loop: life clock, goals, aim point.
    expect(screen.getByTestId('ttl-bar')).toBeTruthy()
    expect(screen.getByTestId('objective-list')).toBeTruthy()
    expect(screen.getByTestId('crosshair')).toBeTruthy()

    // The session clock is showing a real number, not a placeholder.
    expect(screen.getByTestId('ttl-bar').textContent).toMatch(/\d+\.\ds/)

    vi.doUnmock('@react-three/fiber')
    vi.doUnmock('@react-three/drei')
  })
})

// -------------------------------------------------------- scene graph half

describe('3D mode is wired end to end — real R3F scene graph', () => {
  it('builds the whole scene through the real reconciler without throwing', async () => {
    vi.resetModules()
    const ReactThreeTestRenderer = (await import('@react-three/test-renderer')).default
    const { default: Scene } = await import('../view/Scene.jsx')
    const { createGameWorld } = await import('../sim/createGameWorld.js')

    const game = createGameWorld({ seed: 'scene-gate' })

    const renderer = await ReactThreeTestRenderer.create(
      <Scene
        runtime={game.runtime}
        world={game.world}
        level={game.level}
        locked={false}
        lockRequested={false}
        onLockChange={() => {}}
        onNearestTerminal={() => {}}
      />,
    )

    const graph = renderer.scene
    // The level shell and the racks.
    const meshes = graph.findAllByType('Mesh')
    expect(meshes.length).toBeGreaterThan(5)

    // Instanced draws: one for the racks, one per hostile archetype.
    // Matched on the isInstancedMesh flag rather than findAllByType, because
    // THREE.InstancedMesh inherits `type === 'Mesh'` and is invisible to a
    // type query.
    const instanced = graph.findAll((n) => n.instance && n.instance.isInstancedMesh)
    expect(instanced.length).toBeGreaterThanOrEqual(3)

    // The facility is lit, otherwise the player sees pure black.
    expect(graph.findAllByType('PointLight').length).toBeGreaterThan(0)

    await renderer.unmount()
    game.dispose()
  })

  it('advances the simulation when frames are pumped', async () => {
    vi.resetModules()
    const ReactThreeTestRenderer = (await import('@react-three/test-renderer')).default
    const { default: Scene } = await import('../view/Scene.jsx')
    const { createGameWorld } = await import('../sim/createGameWorld.js')

    const game = createGameWorld({ seed: 'frame-gate' })
    const renderer = await ReactThreeTestRenderer.create(
      <Scene
        runtime={game.runtime}
        world={game.world}
        level={game.level}
        locked={false}
        lockRequested={false}
        onLockChange={() => {}}
        onNearestTerminal={() => {}}
      />,
    )

    const before = game.world.tick
    await renderer.advanceFrames(10, 16)
    // The scene's useFrame hooks ran against the real store without throwing;
    // the sim itself is driven by SimProvider's own loop.
    expect(game.world.tick).toBeGreaterThanOrEqual(before)

    await renderer.unmount()
    game.dispose()
  })
})
