// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MODE_KEY, getSavedGameMode, saveGameMode } from './ModeSelector.jsx'

describe('ModeSelector Component & Mode Persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to 3d mode if no preference saved', () => {
    expect(getSavedGameMode()).toBe('3d')
  })

  it('persists selected game mode in localStorage', () => {
    saveGameMode('2d')
    expect(localStorage.getItem(MODE_KEY)).toBe('2d')
    expect(getSavedGameMode()).toBe('2d')

    saveGameMode('3d')
    expect(localStorage.getItem(MODE_KEY)).toBe('3d')
    expect(getSavedGameMode()).toBe('3d')
  })
})
