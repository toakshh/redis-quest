// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import React from 'react'
import OnboardingModal, { hasCompletedOnboarding, setOnboardingCompleted } from './OnboardingModal.jsx'

describe('OnboardingModal component', () => {
  let container
  let root

  beforeEach(() => {
    localStorage.clear()
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

  it('manages localStorage completion status', () => {
    expect(hasCompletedOnboarding()).toBe(false)
    setOnboardingCompleted(true)
    expect(hasCompletedOnboarding()).toBe(true)
  })

  it('renders correctly when open and allows step navigation and completion', () => {
    const onClose = vi.fn()
    act(() => {
      root.render(<OnboardingModal isOpen={true} onClose={onClose} />)
    })

    expect(container.textContent).toContain('REDIS QUEST ONBOARDING')
    expect(container.textContent).toContain('Step 1 of 3')
    expect(container.textContent).toContain('Welcome to Cyberpunk Redis Lab!')

    // Find NEXT button
    const nextBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('NEXT')
    )
    expect(nextBtn).toBeDefined()

    // Step 2
    act(() => {
      nextBtn.click()
    })
    expect(container.textContent).toContain('Step 2 of 3')
    expect(container.textContent).toContain('QWERTY Physical Controls & Movement')

    // Step 3
    const nextBtn2 = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('NEXT')
    )
    act(() => {
      nextBtn2.click()
    })
    expect(container.textContent).toContain('Step 3 of 3')
    expect(container.textContent).toContain('Command Gems & Magic Scroll CLI')

    // Finish
    const finishBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('START QUEST')
    )
    act(() => {
      finishBtn.click()
    })

    expect(onClose).toHaveBeenCalled()
    expect(hasCompletedOnboarding()).toBe(true)
  })
})
