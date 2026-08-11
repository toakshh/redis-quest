// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// React 18's act() requires this global when no RTL/setup enables it.
globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createEngine } from '../engine/engine.js'
import MemoryInspector from './MemoryInspector.jsx'

function render(engine) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<MemoryInspector engine={engine} />)
  })
  return { container, root, text: () => container.textContent }
}

function seed(engine) {
  engine.rawExecute('SET', 'greeting', 'hello')
  engine.rawExecute('EXPIRE', 'greeting', '100')
  engine.rawExecute('HSET', 'user', 'name', 'Ada', 'age', '30')
  engine.rawExecute('LPUSH', 'queue', 'c', 'b', 'a')
  engine.rawExecute('SADD', 'tags', 'redis', 'quest')
  engine.rawExecute('ZADD', 'scores', '10', 'ada')
}

describe('MemoryInspector', () => {
  let engine
  let cleanup

  beforeEach(() => {
    engine = createEngine()
  })

  afterEach(() => {
    cleanup?.()
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('lists every key in the active db with its type and TTL state', () => {
    seed(engine)
    const view = render(engine)
    cleanup = () => view.root.unmount()
    const text = view.text()

    for (const name of ['greeting', 'user', 'queue', 'tags', 'scores']) {
      expect(text).toContain(name)
    }
    // one row per type label
    expect(text).toContain('string')
    expect(text).toContain('hash')
    expect(text).toContain('list')
    expect(text).toContain('set')
    expect(text).toContain('zset')
    // greeting has a TTL; the others do not
    expect(text).toContain('⏳')
    expect(text).toContain('∞ ttl')
  })

  it('renders the db header, key count and used_memory bar', () => {
    seed(engine)
    const view = render(engine)
    cleanup = () => view.root.unmount()
    const text = view.text()
    expect(text).toContain('MEM INSPECTOR')
    expect(text).toContain('db0')
    expect(text).toContain('5 keys')
    expect(text).toContain('used_memory')
    expect(text).toContain('10.00 MB') // default maxmemory
  })

  it('live-updates when the engine emits a change', () => {
    seed(engine)
    const view = render(engine)
    cleanup = () => view.root.unmount()
    // 48-byte key entry + 1 byte value -> "49 B"
    expect(view.text()).toContain('49 B')

    act(() => {
      engine.rawExecute('SET', 'greeting', 'a'.repeat(1000))
    })
    // 48 + 1000 bytes -> "1.0 KB"
    expect(view.text()).toContain('1.0 KB')
  })

  it('drops keys once their TTL lapses (sweep + change event)', () => {
    vi.useFakeTimers()
    engine = createEngine()
    engine.startSweeping()
    engine.rawExecute('SET', 'temp', 'x')
    engine.rawExecute('EXPIRE', 'temp', '1')
    engine.rawExecute('SET', 'keep', 'y')

    const view = render(engine)
    cleanup = () => view.root.unmount()
    expect(view.text()).toContain('temp')

    act(() => {
      vi.advanceTimersByTime(1200)
    })
    expect(view.text()).not.toContain('temp')
    expect(view.text()).toContain('keep')
    expect(view.text()).toContain('1 key')
  })

  it('never shows logically-expired keys even before a sweep', () => {
    vi.useFakeTimers()
    engine = createEngine()
    engine.rawExecute('SET', 'gone', 'x')
    engine.rawExecute('EXPIRE', 'gone', '1')
    const view = render(engine)
    cleanup = () => view.root.unmount()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    // snapshot is rebuilt on each tick and filters expired entries
    expect(view.text()).not.toContain('gone')
    expect(view.text()).toContain('no keys in db0')
  })

  it('switches sort order when a sort control is clicked', () => {
    seed(engine)
    const view = render(engine)
    cleanup = () => view.root.unmount()

    const buttons = [...document.querySelectorAll('button')]
    const nameSort = buttons.find((b) => b.textContent === 'NAME')
    act(() => nameSort.click())

    const rows = [...document.querySelectorAll('li')].map((li) => li.textContent)
    expect(rows[0]).toContain('greeting') // alphabetical, 'greeting' < 'queue' < ...
    expect(nameSort.getAttribute('aria-pressed')).toBe('true')
  })
})
