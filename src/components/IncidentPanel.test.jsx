// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import React from 'react'
import IncidentPanel, { calculateIncidentScore, getRankFromScore } from './IncidentPanel.jsx'
import PressureMeter from './PressureMeter.jsx'
import SystemHealth from './SystemHealth.jsx'
import RexPanel from './RexPanel.jsx'
import hintEngine, { HintEngine } from '../systems/HintEngine.js'

describe('IncidentPanel & Cyberpunk Incident System', () => {
  let container
  let root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    hintEngine.resetTracking()
  })

  afterEach(() => {
    if (root) {
      act(() => root.unmount())
    }
    document.body.innerHTML = ''
  })

  it('renders standby state when no active incident is provided', () => {
    act(() => {
      root.render(<IncidentPanel />)
    })
    expect(container.textContent).toContain('No Active Incident')
    expect(container.textContent).toContain('System running in nominal standby mode')
  })

  it('renders active incident title, description, pressure meter, and system health', () => {
    const mockIncident = {
      id: 'INC-101',
      title: 'Cache Invalidation Storm',
      description: 'High traffic volume causes simultaneous cache key expirations.',
      pressure: 75,
      systemHealth: 45,
      objectives: [
        { id: 'obj1', name: 'Stabilize cache jitter', completed: true },
        { id: 'obj2', name: 'Evict stale keys', completed: false },
      ],
    }

    act(() => {
      root.render(<IncidentPanel incident={mockIncident} />)
    })

    expect(container.textContent).toContain('INCIDENT ACTIVE')
    expect(container.textContent).toContain('Cache Invalidation Storm')
    expect(container.textContent).toContain('High traffic volume causes simultaneous cache key expirations.')
    expect(container.textContent).toContain('INCIDENT PRESSURE')
    expect(container.textContent).toContain('75%')
    expect(container.textContent).toContain('SYSTEM HEALTH')
    expect(container.textContent).toContain('45%')
  })

  it('displays objective pass and fail checkmarks correctly', () => {
    const mockIncident = {
      id: 'INC-102',
      title: 'Memory Leak Alert',
      pressure: 30,
      systemHealth: 80,
      objectives: [
        { id: 'obj-pass', name: 'Configure EXPIRE policy', completed: true },
        { id: 'obj-fail', name: 'Run MEMORY PURGE', completed: false },
      ],
    }

    act(() => {
      root.render(<IncidentPanel incident={mockIncident} />)
    })

    expect(container.textContent).toContain('Configure EXPIRE policy')
    expect(container.textContent).toContain('Run MEMORY PURGE')

    const passBadges = container.querySelectorAll('.text-emerald-300, .bg-emerald-500\\/20')
    const failBadges = container.querySelectorAll('.text-red-400')

    expect(passBadges.length).toBeGreaterThan(0)
    expect(failBadges.length).toBeGreaterThan(0)
    expect(container.textContent).toContain('PASS')
    expect(container.textContent).toContain('FAIL')
    expect(container.textContent).toContain('1 / 2 DONE')
  })

  it('renders completion score summary card (score 0-1000, rank S/A/B/C) on resolution', () => {
    const resolvedIncident = {
      id: 'INC-103',
      title: 'Job Queue Backlog',
      description: 'Resolved job queue starvation.',
      pressure: 20,
      systemHealth: 95,
      resolved: true,
      score: 950,
      rank: 'S',
      objectives: [
        { id: 'obj1', name: 'Flush dead letter queue', completed: true },
        { id: 'obj2', name: 'Scale consumer workers', completed: true },
      ],
    }

    act(() => {
      root.render(<IncidentPanel incident={resolvedIncident} />)
    })

    expect(container.textContent).toContain('INCIDENT RESOLVED SUMMARY')
    expect(container.textContent).toContain('RANK S')
    expect(container.textContent).toContain('950')
    expect(container.textContent).toContain('/ 1000 PTS')
  })

  it('calculates score and assigns rank correctly when not pre-specified', () => {
    const scoreRankS = calculateIncidentScore({
      score: 920,
    })
    expect(scoreRankS.rank).toBe('S')

    const scoreRankA = getRankFromScore(800)
    expect(scoreRankA).toBe('A')

    const scoreRankB = getRankFromScore(650)
    expect(scoreRankB).toBe('B')

    const scoreRankC = getRankFromScore(500)
    expect(scoreRankC).toBe('C')

    const derivedScore = calculateIncidentScore({
      pressure: 10,
      systemHealth: 90,
      objectives: [
        { completed: true },
        { completed: true },
      ],
    })

    expect(derivedScore.score).toBeGreaterThanOrEqual(800)
    expect(derivedScore.score).toBeLessThanOrEqual(1000)
  })
})

describe('PressureMeter & SystemHealth Visual Components', () => {
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

  it('renders PressureMeter with progressbar ARIA and warning colors', () => {
    act(() => {
      root.render(<PressureMeter pressure={85} label="HIGH PRESSURE" />)
    })

    const progressbar = container.querySelector('[role="progressbar"]')
    expect(progressbar).not.toBeNull()
    expect(progressbar.getAttribute('aria-valuenow')).toBe('85')
    expect(container.textContent).toContain('HIGH PRESSURE')
    expect(container.textContent).toContain('85%')
    expect(container.textContent).toContain('CRITICAL')
  })

  it('renders SystemHealth with health states (nominal vs degraded vs critical)', () => {
    act(() => {
      root.render(<SystemHealth health={25} label="CORE HEALTH" />)
    })

    const progressbar = container.querySelector('[role="progressbar"]')
    expect(progressbar).not.toBeNull()
    expect(progressbar.getAttribute('aria-valuenow')).toBe('25')
    expect(container.textContent).toContain('CORE HEALTH')
    expect(container.textContent).toContain('25%')
    expect(container.textContent).toContain('CRITICAL')
  })
})

describe('RexPanel & HintEngine Integration', () => {
  let container
  let root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    hintEngine.resetTracking()
  })

  afterEach(() => {
    if (root) {
      act(() => root.unmount())
    }
    document.body.innerHTML = ''
  })

  it('HintEngine returns progressive 3-tier hints correctly', () => {
    const customEngine = new HintEngine()
    customEngine.registerHint('test:context', {
      tier1: 'Symptom: High memory allocation.',
      tier2: 'Concept: Keys without TTL cause memory leaks.',
      tier3: 'Command Shape: EXPIRE key seconds',
    })

    const h1 = customEngine.requestHint('test:context')
    expect(h1.tier).toBe(1)
    expect(h1.tierLabel).toBe('Tier 1: Symptom')
    expect(h1.text).toBe('Symptom: High memory allocation.')

    const h2 = customEngine.requestHint('test:context')
    expect(h2.tier).toBe(2)
    expect(h2.tierLabel).toBe('Tier 2: Concept')
    expect(h2.text).toBe('Concept: Keys without TTL cause memory leaks.')

    const h3 = customEngine.requestHint('test:context')
    expect(h3.tier).toBe(3)
    expect(h3.tierLabel).toBe('Tier 3: Command Shape')
    expect(h3.text).toBe('Command Shape: EXPIRE key seconds')
  })

  it('RexPanel integrates HintEngine with Request Hint button', () => {
    const handleHintSpy = vi.fn()

    act(() => {
      root.render(<RexPanel contextId="memory-leak" onRequestHint={handleHintSpy} />)
    })

    const requestBtn = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent.includes('Request Hint')
    )

    expect(requestBtn).not.toBeUndefined()

    // Click 1: Tier 1 Symptom
    act(() => {
      requestBtn.click()
    })

    expect(handleHintSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 1,
        tierLabel: 'Tier 1: Symptom',
      })
    )
    expect(container.textContent).toContain('Tier 1: Symptom')

    // Click 2: Tier 2 Concept
    act(() => {
      requestBtn.click()
    })

    expect(handleHintSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 2,
        tierLabel: 'Tier 2: Concept',
      })
    )
    expect(container.textContent).toContain('Tier 2: Concept')

    // Click 3: Tier 3 Command Shape
    act(() => {
      requestBtn.click()
    })

    expect(handleHintSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 3,
        tierLabel: 'Tier 3: Command Shape',
      })
    )
    expect(container.textContent).toContain('Tier 3: Command Shape')
  })
})
