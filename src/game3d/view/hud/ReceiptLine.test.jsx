// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { act } from 'react'
import ReceiptLine from './ReceiptLine.jsx'

describe('ReceiptLine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('1. Renders two columns with correct text', () => {
    const { getByTestId } = render(<ReceiptLine physicalText="Nail Gun" realText="SET" />)
    expect(getByTestId('col-physical').textContent).toBe('Nail Gun')
    expect(getByTestId('col-real').textContent).toBe('SET')
  })

  it('2. Sets pointer-events to none', () => {
    const { getByTestId } = render(<ReceiptLine physicalText="a" realText="b" />)
    const el = getByTestId('receipt-line')
    expect(el.style.pointerEvents).toBe('none')
  })

  it('3. Fades out after visibleMs', () => {
    const visibleMs = 500
    const { getByTestId } = render(<ReceiptLine physicalText="a" realText="b" visibleMs={visibleMs} />)
    const el = getByTestId('receipt-line')

    // Initially fully opaque
    expect(el.style.opacity).toBe('1')

    // Advance to fade start (visibleMs - 150)
    act(() => {
      vi.advanceTimersByTime(350)
    })
    expect(el.style.opacity).toBe('0')
  })
})
