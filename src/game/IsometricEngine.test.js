import { describe, it, expect, vi } from 'vitest'
import { IsometricEngineControls, getPhysicalMoveDelta } from './IsometricEngine.js'

describe('IsometricEngine QWERTY physical key bindings', () => {
  it('maps physical KeyW, KeyA, KeyS, KeyD, KeyE, Backquote correctly', () => {
    expect(getPhysicalMoveDelta({ code: 'KeyW' })).toEqual({ dx: 0, dy: -1 })
    expect(getPhysicalMoveDelta({ code: 'KeyS' })).toEqual({ dx: 0, dy: 1 })
    expect(getPhysicalMoveDelta({ code: 'KeyA' })).toEqual({ dx: -1, dy: 0 })
    expect(getPhysicalMoveDelta({ code: 'KeyD' })).toEqual({ dx: 1, dy: 0 })
    expect(getPhysicalMoveDelta({ code: 'UnknownKey' })).toBeNull()
  })

  it('triggers onMove and onInteract callbacks for physical keys', () => {
    const onMove = vi.fn()
    const onInteract = vi.fn()
    const onToggleTerminal = vi.fn()
    const controls = new IsometricEngineControls({
      onMove,
      onInteract,
      onToggleTerminal,
      isTerminalOpen: () => false,
    })

    controls.handleKeyDown({ code: 'KeyW', preventDefault: () => {} })
    expect(onMove).toHaveBeenCalledWith(0, -1)

    controls.handleKeyDown({ code: 'KeyA', preventDefault: () => {} })
    expect(onMove).toHaveBeenCalledWith(-1, 0)

    controls.handleKeyDown({ code: 'KeyE', preventDefault: () => {} })
    expect(onInteract).toHaveBeenCalled()

    controls.handleKeyDown({ code: 'Backquote', preventDefault: () => {} })
    expect(onToggleTerminal).toHaveBeenCalled()
  })

  it('retains native typing when terminal is open or user is typing in input', () => {
    const onMove = vi.fn()
    const onInteract = vi.fn()
    const controls = new IsometricEngineControls({
      onMove,
      onInteract,
      isTerminalOpen: () => true,
    })

    controls.handleKeyDown({ code: 'KeyW', target: { tagName: 'INPUT' }, preventDefault: () => {} })
    expect(onMove).not.toHaveBeenCalled()

    controls.handleKeyDown({ code: 'KeyE', target: { tagName: 'INPUT' }, preventDefault: () => {} })
    expect(onInteract).not.toHaveBeenCalled()
  })
})
