// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../App.jsx'

describe('Refactored Layout & UI Tour Integration Tests', () => {
  let container
  let root

  beforeEach(() => {
    localStorage.setItem('redis_quest_onboarding_completed', 'true')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    if (root) {
      act(() => root.unmount())
    }
    document.body.innerHTML = ''
  })

  // App now opens on the mode launcher (see src/components/ModeLauncher.jsx);
  // these tests exercise the 2D game shell, so every render is followed by
  // selecting "PLAY 2D" before the existing assertions run.
  function renderAndEnter2D() {
    act(() => {
      root.render(<App />)
    })
    const play2dBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent.includes('PLAY 2D')
    )
    act(() => {
      play2dBtn.click()
    })
  }

  it('defaults to world tab and centers GameCanvas as primary view', () => {
    renderAndEnter2D()

    // Check header exists
    const header = container.querySelector('header')
    expect(header).not.toBeNull()

    // Check WORLD tab button is pressed
    const sideButtons = [...container.querySelectorAll('nav button')]
    const worldBtn = sideButtons.find((b) => b.textContent.includes('WORLD'))
    expect(worldBtn).not.toBeUndefined()
    expect(worldBtn.getAttribute('aria-pressed')).toBe('true')

    // Check GameCanvas is in main viewport
    const canvas = container.querySelector('main canvas')
    expect(canvas).not.toBeNull()
  })

  it('opens and navigates the UI Tour modal from the header button', () => {
    renderAndEnter2D()

    // Find and click "START UI TOUR" button in header
    const tourBtn = [...container.querySelectorAll('header button')].find((b) =>
      b.textContent.includes('START UI TOUR')
    )
    expect(tourBtn).not.toBeUndefined()

    act(() => {
      tourBtn.click()
    })

    // Tour modal should be open
    expect(container.textContent).toContain('WELCOME TO THE UI TOUR')

    // Find the NEXT button specifically inside the UI Tour modal
    const tourModal = [...container.querySelectorAll('div')].find((d) => d.textContent.includes('WELCOME TO THE UI TOUR'))
    const tourNextBtn = [...tourModal.querySelectorAll('button')].find((b) =>
      b.textContent.includes('NEXT')
    )
    expect(tourNextBtn).not.toBeUndefined()

    act(() => {
      tourNextBtn.click()
    })

    expect(container.textContent).toContain('HEADER STATS & GAUGES')
    expect(container.textContent).toContain('MEM GAUGE vs MEM INSPECTOR')

    // Click READY TO PLAY / Close button
    const closeBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent.includes('✕')
    )
    act(() => {
      closeBtn.click()
    })

    expect(container.textContent).not.toContain('WELCOME TO THE UI TOUR')
  })

  it('toggles terminal drawer via ~ key and toggle button', () => {
    renderAndEnter2D()

    // Find floating terminal drawer toggle button
    const terminalToggleBtn = [...container.querySelectorAll('button')].find((b) =>
      b.getAttribute('aria-label')?.includes('Terminal Drawer')
    )
    expect(terminalToggleBtn).not.toBeUndefined()

    // Open drawer
    act(() => {
      terminalToggleBtn.click()
    })

    expect(container.querySelector('.terminal-input')).not.toBeNull()

    // Close drawer via ~ shortcut key
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
    })

    expect(container.querySelector('.terminal-input')).toBeNull()
  })

  it('toggles fullscreen mode hiding sidebars and header', () => {
    renderAndEnter2D()

    const fullscreenBtn = [...container.querySelectorAll('header button')].find((b) =>
      b.textContent.includes('FULLSCREEN')
    )
    expect(fullscreenBtn).not.toBeUndefined()

    // Enter fullscreen
    act(() => {
      fullscreenBtn.click()
    })

    // Header should be hidden in fullscreen
    expect(container.querySelector('header')).toBeNull()

    // Exit fullscreen button should be visible
    const exitBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent.includes('EXIT FULLSCREEN')
    )
    expect(exitBtn).not.toBeUndefined()

    // Exit fullscreen
    act(() => {
      exitBtn.click()
    })

    expect(container.querySelector('header')).not.toBeNull()
  })
})
