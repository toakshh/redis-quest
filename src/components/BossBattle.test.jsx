// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import React from 'react'
import BossBattle from './BossBattle.jsx'
import { useGameStore } from '../store/gameStore.js'
import { createEngine } from '../engine/engine.js'

describe('BossBattle Component & Immunity System', () => {
  let container
  let root
  let engine

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    engine = createEngine()
    useGameStore.getState().resetGame()
    useGameStore.getState().bindEngine(engine)
  })

  afterEach(() => {
    if (root) {
      act(() => root.unmount())
    }
    document.body.innerHTML = ''
  })

  it('renders deploy button when battle is not engaged', () => {
    act(() => {
      root.render(<BossBattle />)
    })
    expect(container.textContent).toContain('NEON SERPENT')
    expect(container.textContent).toContain('DEPLOY BATTLE')
  })

  it('displays active boss and objective when battle starts', () => {
    act(() => {
      useGameStore.getState().startBattle('neon-serpent')
    })
    act(() => {
      root.render(<BossBattle />)
    })
    expect(container.textContent).toContain('NEON SERPENT')
    expect(container.textContent).toContain('CURRENT OBJECTIVE')
    expect(container.textContent).toContain('quest:start')
  })

  it('displays strategic immunity overlay when an incorrect command strategy is executed', () => {
    act(() => {
      useGameStore.getState().startBattle('neon-serpent')
    })
    act(() => {
      root.render(<BossBattle />)
    })

    // Execute wrong command
    act(() => {
      useGameStore.getState().runCommand('GET wrong:key')
    })

    expect(container.textContent).toContain('SHIELD IMMUNITY DETECTED')
    expect(container.textContent).toContain('Immune to GET!')
    expect(container.textContent).toContain('WHY ATTACK FAILED')
    expect(container.textContent).toContain('REQUIRED STRATEGY / CONCEPT')
    expect(container.textContent).toContain('String Storage (SET)')
  })

  it('allows dismissing the immunity overlay', () => {
    act(() => {
      useGameStore.getState().startBattle('neon-serpent')
      useGameStore.getState().runCommand('GET wrong:key')
    })
    act(() => {
      root.render(<BossBattle />)
    })

    expect(container.textContent).toContain('SHIELD IMMUNITY DETECTED')

    const dismissBtn = container.querySelector('button[title="Dismiss immunity overlay"]')
    expect(dismissBtn).not.toBeNull()

    act(() => {
      dismissBtn.click()
    })

    expect(container.textContent).not.toContain('SHIELD IMMUNITY DETECTED')
  })

  it('clears immunity overlay and triggers phase progression on correct command strategy', () => {
    act(() => {
      useGameStore.getState().startBattle('neon-serpent')
      useGameStore.getState().runCommand('GET wrong:key')
    })
    act(() => {
      root.render(<BossBattle />)
    })

    expect(container.textContent).toContain('SHIELD IMMUNITY DETECTED')

    // Execute correct strategy command
    act(() => {
      useGameStore.getState().runCommand('SET quest:start begun')
    })

    expect(container.textContent).not.toContain('SHIELD IMMUNITY DETECTED')
    expect(container.textContent).toContain('SHIELD BREACHED')
    expect(container.textContent).toContain('OBJECTIVE 2/')
  })
})
