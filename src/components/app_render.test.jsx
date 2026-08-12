// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../App.jsx'

describe('App Component Audit', () => {
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
      consoleErrors.push(args.map(a => String(a?.stack || a)).join(' '))
      originalError(...args)
    }
    console.warn = (...args) => {
      consoleWarns.push(args.map(a => String(a?.stack || a)).join(' '))
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

  it('renders App cleanly without console errors or warnings', () => {
    act(() => {
      root.render(<App />)
    })

    expect(consoleErrors).toEqual([])
    expect(consoleWarns).toEqual([])
  })
})
