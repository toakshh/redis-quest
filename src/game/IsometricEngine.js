// IsometricEngine.js - Handles controls and keyboard input bindings using KeyboardEvent.code
// QWERTY Physical Control Bindings: KeyW, KeyA, KeyS, KeyD, KeyE, Backquote

export class IsometricEngineControls {
  constructor(options = {}) {
    this.onMove = options.onMove || (() => {})
    this.onInteract = options.onInteract || (() => {})
    this.onToggleTerminal = options.onToggleTerminal || (() => {})
    this.isTerminalOpen = options.isTerminalOpen || (() => false)
    
    this.handleKeyDown = this.handleKeyDown.bind(this)
  }

  attach(target = window) {
    target.addEventListener('keydown', this.handleKeyDown)
  }

  detach(target = window) {
    target.removeEventListener('keydown', this.handleKeyDown)
  }

  handleKeyDown(e) {
    // If typing inside CLI terminal (or any input/textarea), retain native layout typing mapping,
    // but handle Backquote to toggle terminal if needed.
    const isTyping = this.isTerminalOpen() || ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)

    // Backquote (Key ` / ~) toggles terminal in physical position
    if (e.code === 'Backquote' || e.key === '`' || e.key === '~') {
      e.preventDefault()
      this.onToggleTerminal()
      return
    }

    // When inside input/terminal, do not capture WASD / E movement/interactions
    if (isTyping) {
      return
    }

    let dx = 0
    let dy = 0

    // KeyW / KeyS / KeyA / KeyD physical key codes (QWERTY layout regardless of system layout)
    // Fallback to e.key for arrow keys or standard controls
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        dy = -1
        break
      case 'KeyS':
      case 'ArrowDown':
        dy = 1
        break
      case 'KeyA':
      case 'ArrowLeft':
        dx = -1
        break
      case 'KeyD':
      case 'ArrowRight':
        dx = 1
        break
      case 'KeyE':
        e.preventDefault()
        this.onInteract()
        return
      default:
        // Also check fallback e.key if e.code isn't set or standard arrow keys
        if (e.key === 'ArrowUp') dy = -1
        else if (e.key === 'ArrowDown') dy = 1
        else if (e.key === 'ArrowLeft') dx = -1
        else if (e.key === 'ArrowRight') dx = 1
        break
    }

    if (dx !== 0 || dy !== 0) {
      e.preventDefault()
      this.onMove(dx, dy)
    }
  }
}

/** Helper function to check physical key event code for QWERTY movement */
export function getPhysicalMoveDelta(e) {
  switch (e.code) {
    case 'KeyW': return { dx: 0, dy: -1 }
    case 'KeyS': return { dx: 0, dy: 1 }
    case 'KeyA': return { dx: -1, dy: 0 }
    case 'KeyD': return { dx: 1, dy: 0 }
    default:
      if (e.key === 'ArrowUp') return { dx: 0, dy: -1 }
      if (e.key === 'ArrowDown') return { dx: 0, dy: 1 }
      if (e.key === 'ArrowLeft') return { dx: -1, dy: 0 }
      if (e.key === 'ArrowRight') return { dx: 1, dy: 0 }
      return null
  }
}
