import { describe, it, expect } from 'vitest'
import { createDebriefQueue } from './DebriefQueue.js'

describe('DebriefQueue', () => {
  it('1. Enqueues strings', () => {
    const q = createDebriefQueue()
    q.enqueue('incident-1')
    q.enqueue('incident-2')
    expect(q.queue).toEqual(['incident-1', 'incident-2'])
  })

  it('2. Returns null on tryDequeue if scareDirectorActive is true', () => {
    const q = createDebriefQueue()
    q.enqueue('incident-1')
    const result = q.tryDequeue(true)
    expect(result).toBeNull()
    expect(q.queue).toHaveLength(1)
  })

  it('3. Dequeues and removes item otherwise', () => {
    const q = createDebriefQueue()
    q.enqueue('incident-1')
    q.enqueue('incident-2')

    const result = q.tryDequeue(false)
    expect(result).toBe('incident-1')
    expect(q.queue).toEqual(['incident-2'])
  })
})
