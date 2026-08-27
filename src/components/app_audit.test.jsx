// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../App.jsx'

describe('Comprehensive Component Console & Crash Audit', () => {
  let container
  let root
  let consoleErrors = []
  let consoleWarns = []
  const originalError = console.error
  const originalWarn = console.warn

  beforeEach(() => {
    consoleErrors = []
    consoleWarns = []
    console.error = (...args) => {
      const msg = args.map(a => String(a?.stack || a)).join(' ')
      // Ignore jsdom canvas notice
      if (!msg.includes("HTMLCanvasElement's getContext() method")) {
        consoleErrors.push(msg)
      }
      originalError(...args)
    }
    console.warn = (...args) => {
      const msg = args.map(a => String(a?.stack || a)).join(' ')
      consoleWarns.push(msg)
      originalWarn(...args)
    }
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    console.error = originalError
    console.warn = originalWarn
    if (root) {
      act(() => root.unmount())
    }
    document.body.innerHTML = ''
  })

  it('renders all side tabs without console errors/warnings', () => {
    act(() => {
      root.render(<App />)
    })

    const buttons = [...container.querySelectorAll('button')]
    const tabButtons = buttons.filter(b => ['MEM', 'BOSS', 'AWARDS', 'SKILLS', 'LOOK', 'CONF'].some(t => b.textContent.includes(t)))

    for (const btn of tabButtons) {
      act(() => {
        btn.click()
      })
    }

    expect(consoleErrors).toEqual([])
    expect(consoleWarns).toEqual([])
  })

  it('toggles REX panel and types commands without console errors/warnings', () => {
    act(() => {
      root.render(<App />)
    })

    // Toggle REX
    const rexToggle = [...container.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.includes('REX'))
    if (rexToggle) {
      act(() => {
        rexToggle.click()
      })
    }

    // Find terminal input
    const input = container.querySelector('input[type="text"]') || container.querySelector('input')
    if (input) {
      const form = input.closest('form')
      act(() => {
        input.value = 'SET foo bar'
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      if (form) {
        act(() => {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        })
      }
    }

    expect(consoleErrors).toEqual([])
    expect(consoleWarns).toEqual([])
  })
})
