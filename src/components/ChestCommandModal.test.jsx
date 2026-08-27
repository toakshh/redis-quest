// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import React from 'react'
import ChestCommandModal from './ChestCommandModal.jsx'
import { getChestCommandData, CHEST_COMMAND_DATA } from '../data/chestCommands.js'

describe('ChestCommandModal & chestCommands', () => {
  let container
  let root

  beforeEach(() => {
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

  it('provides command metadata for all game chest commands', () => {
    const requiredCommands = ['SET', 'GET', 'DEL', 'HSET', 'HGET', 'HDEL', 'LPUSH', 'RPOP', 'ZADD', 'PUBLISH', 'SUBSCRIBE', 'CLUSTER']
    for (const cmd of requiredCommands) {
      const data = getChestCommandData(cmd)
      expect(data).toBeDefined()
      expect(data.command).toBe(cmd)
      expect(data.syntax).toBeDefined()
      expect(data.parameters.length).toBeGreaterThan(0)
      expect(data.useCase).toBeDefined()
      expect(data.realWorld).toBeDefined()
    }
  })

  it('returns fallback data for unknown command', () => {
    const data = getChestCommandData('UNKNOWN_CMD')
    expect(data.command).toBe('SET')
  })

  it('renders modal content when open with command details', () => {
    const onClose = vi.fn()
    act(() => {
      root.render(<ChestCommandModal isOpen={true} onClose={onClose} commandGem="HSET" />)
    })

    expect(container.textContent).toContain('COMMAND GEM UNLOCKED')
    expect(container.textContent).toContain('HSET')
    expect(container.textContent).toContain('Syntax')
    expect(container.textContent).toContain('HSET key field value')
    expect(container.textContent).toContain('Parameter Breakdown')
    expect(container.textContent).toContain('Practical Real-World Use-Case')
    expect(container.textContent).toContain('user profiles')

    // Find GOT IT button and click
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('GOT IT')
    )
    expect(btn).toBeDefined()
    act(() => {
      btn.click()
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when isOpen is false', () => {
    act(() => {
      root.render(<ChestCommandModal isOpen={false} onClose={() => {}} commandGem="SET" />)
    })
    expect(container.textContent).toBe('')
  })
})