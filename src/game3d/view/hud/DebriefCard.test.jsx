// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import DebriefCard from './DebriefCard.jsx'

const mockWorld = { timeScale: 1 }

describe('DebriefCard', () => {
  const mockData = {
    whatHappened: 'A',
    whatYouDid: 'B',
    realWorldName: 'C',
    actualCommand: 'D',
    whenToUse: 'E',
    ifWrong: 'F'
  }

  it('1. Renders all six fields', () => {
    const { getByTestId } = render(<DebriefCard world={mockWorld} debriefData={mockData} onDismiss={() => {}} />)
    expect(getByTestId('f1').textContent).toBe('A')
    expect(getByTestId('f2').textContent).toBe('B')
    expect(getByTestId('f3').textContent).toBe('C')
    expect(getByTestId('f4').textContent).toBe('D')
    expect(getByTestId('f5').textContent).toBe('E')
    expect(getByTestId('f6').textContent).toBe('F')
  })

  it('2. Sets timeScale to 0 on mount', () => {
    mockWorld.timeScale = 1
    render(<DebriefCard world={mockWorld} debriefData={mockData} onDismiss={() => {}} />)
    expect(mockWorld.timeScale).toBe(0)
  })

  it('3. Restores timeScale and calls onDismiss when dismissed', () => {
    mockWorld.timeScale = 1
    const onDismiss = vi.fn()
    const { getByTestId, unmount } = render(<DebriefCard world={mockWorld} debriefData={mockData} onDismiss={onDismiss} />)

    fireEvent.click(getByTestId('btn-dismiss'))
    expect(onDismiss).toHaveBeenCalled()

    unmount()
    expect(mockWorld.timeScale).toBe(1)
  })
})
