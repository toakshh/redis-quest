// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import React from 'react'
import Terminal, { getInlineSyntaxHint, ErrorReplyView } from './Terminal.jsx'
import { createEngine } from '../engine/engine.js'
import { useGameStore } from '../store/gameStore.js'

function changeInput(inputEl, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set
  nativeInputValueSetter.call(inputEl, value)
  inputEl.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Terminal Component', () => {
  let engine
  let container
  let root

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

  it('renders command prompt and placeholder', () => {
    act(() => {
      root.render(<Terminal engine={engine} />)
    })
    expect(container.textContent).toContain('redis-cli · redis-quest')
    const input = container.querySelector('input')
    expect(input).not.toBeNull()
    expect(input.placeholder).toContain('type a Redis command')
  })

  it('handles command history navigation with ArrowUp and ArrowDown keys', () => {
    act(() => {
      root.render(<Terminal engine={engine} />)
    })
    const input = container.querySelector('input')
    const form = container.querySelector('form')

    // Execute first command
    act(() => {
      changeInput(input, 'SET key1 val1')
    })
    act(() => {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    })

    // Execute second command
    act(() => {
      changeInput(input, 'GET key1')
    })
    act(() => {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    })

    // Press ArrowUp to retrieve last command (GET key1)
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    })
    expect(input.value).toBe('GET key1')

    // Press ArrowUp again to retrieve earlier command (SET key1 val1)
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    })
    expect(input.value).toBe('SET key1 val1')

    // Press ArrowDown to return to GET key1
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(input.value).toBe('GET key1')

    // Press ArrowDown again to return to empty draft
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(input.value).toBe('')
  })

  it('provides inline syntax hints helper for recognized commands', () => {
    expect(getInlineSyntaxHint('SET')).toContain('key value')
    expect(getInlineSyntaxHint('HSET')).toContain('key field value')
    expect(getInlineSyntaxHint('EXPIRE')).toContain('key seconds')
    expect(getInlineSyntaxHint('INVALIDCMD')).toBe('')
  })

  it('formats WRONGTYPE, syntax errors, and missing keys with diagnostic hints', () => {
    // Seed a string key
    engine.rawExecute('SET', 'strkey', 'hello')

    act(() => {
      root.render(<Terminal engine={engine} />)
    })
    const input = container.querySelector('input')
    const form = container.querySelector('form')

    // Trigger WRONGTYPE error by calling HGET on a string key
    act(() => {
      changeInput(input, 'HGET strkey field1')
    })
    act(() => {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    })

    expect(container.textContent).toContain('WRONGTYPE')
    expect(container.textContent).toContain('Diagnostic Hint:')

    // Trigger Syntax Error by missing parameters
    act(() => {
      changeInput(input, 'EXPIRE')
    })
    act(() => {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    })

    expect(container.textContent).toContain('SYNTAX ERROR')

    // Trigger Missing Key Error
    act(() => {
      root.render(<ErrorReplyView message="ERR no such key" />)
    })
    expect(container.textContent).toContain('MISSING KEY')
    expect(container.textContent).toContain('Target key does not exist')
  })

  it('renders autocomplete suggestions and handles tab completion', () => {
    act(() => {
      root.render(<Terminal engine={engine} />)
    })
    const input = container.querySelector('input')

    act(() => {
      changeInput(input, 'HS')
    })

    const popup = container.querySelector('[data-testid="autocomplete-popup"]')
    expect(popup).not.toBeNull()
    expect(popup.textContent).toContain('HSET')

    // Tab key selects top suggestion
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    })
    expect(input.value).toBe('HSET ')
  })

  it('displays immediate feedback when executing commands affecting active incident state', () => {
    act(() => {
      useGameStore.getState().setActiveIncident({
        id: 'inc-01',
        title: 'Cache Invalidation Incident',
        targetKey: 'user:session:100',
        status: 'active',
      })
    })

    act(() => {
      root.render(<Terminal engine={engine} />)
    })
    const input = container.querySelector('input')
    const form = container.querySelector('form')

    act(() => {
      changeInput(input, 'DEL user:session:100')
    })
    act(() => {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    })

    expect(container.textContent).toContain('INCIDENT FEEDBACK')
    expect(container.textContent).toContain('user:session:100')
    expect(container.textContent).toContain('TARGET MUTATED')
  })
})
