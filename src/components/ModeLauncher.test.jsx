// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModeLauncher from './ModeLauncher.jsx'

describe('ModeLauncher', () => {
  it('renders both product panels', () => {
    render(<ModeLauncher onSelect={() => {}} />)
    expect(screen.getByText('REDIS QUEST')).toBeTruthy()
    expect(screen.getByText('PROTOCOL ZERO')).toBeTruthy()
  })

  it('calls onSelect("3d") when ENTER NODE-7 is clicked', () => {
    const onSelect = vi.fn()
    render(<ModeLauncher onSelect={onSelect} />)
    fireEvent.click(screen.getByText('ENTER NODE-7'))
    expect(onSelect).toHaveBeenCalledWith('3d')
  })

  it('calls onSelect("2d") when PLAY 2D is clicked', () => {
    const onSelect = vi.fn()
    render(<ModeLauncher onSelect={onSelect} />)
    fireEvent.click(screen.getByText('PLAY 2D'))
    expect(onSelect).toHaveBeenCalledWith('2d')
  })
})
