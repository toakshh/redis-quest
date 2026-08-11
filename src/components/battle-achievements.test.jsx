// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createEngine } from '../engine/engine.js'
import { useGameStore } from '../store/gameStore.js'
import BossBattle from './BossBattle.jsx'
import Achievements from './Achievements.jsx'

// React 18.3 requires this flag for act() to be recognised outside react-dom/test-utils.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let engine

function render(node) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(node)
  })
  return { container, root, text: () => container.textContent }
}

function battle() {
  return render(<BossBattle />)
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  engine = createEngine()
  useGameStore.getState().bindEngine(engine)
})

afterEach(() => {
  useGameStore.getState().resetGame()
  document.body.innerHTML = ''
})

describe('BossBattle', () => {
  it('offers a deploy screen before the battle starts', () => {
    const view = battle()
    expect(view.text()).toContain('BOSS BATTLE')
    expect(view.text()).toContain('NEON SERPENT')
    expect(view.text()).toContain('DEPLOY BATTLE')
  })

  it('starts a fight and shows the first objective', () => {
    const view = battle()
    const deploy = [...view.container.querySelectorAll('button')].find(
      (b) => b.textContent === 'DEPLOY BATTLE',
    )
    act(() => deploy.click())

    const text = view.text()
    expect(text).toContain('CURRENT OBJECTIVE')
    expect(text).toContain('quest:start')
    expect(text).toContain('SET quest:start begun')
  })

  it('deals damage and reports SHIELD BREACHED when an objective is solved', () => {
    const view = battle()
    const deploy = [...view.container.querySelectorAll('button')].find(
      (b) => b.textContent === 'DEPLOY BATTLE',
    )
    act(() => deploy.click())

    act(() => {
      useGameStore.getState().runCommand('SET quest:start begun')
    })
    expect(view.text()).toContain('SHIELD BREACHED −18 HP')
    expect(view.text()).toContain('OBJECTIVE 2/6')
  })

  it('shows a victory screen when the serpent is dismantled', () => {
    const view = battle()
    const deploy = [...view.container.querySelectorAll('button')].find(
      (b) => b.textContent === 'DEPLOY BATTLE',
    )
    act(() => deploy.click())

    act(() => {
      const run = useGameStore.getState().runCommand
      run('SET quest:start begun')
      run('HSET quest:map a 1 b 2 c 3')
      run('RPUSH quest:trail x y')
      run('SADD quest:tokens r g b')
      run('ZADD quest:ranks 1 a 2 b')
      run('SET quest:beacon on')
      run('EXPIRE quest:beacon 60')
    })
    expect(view.text()).toContain('DATA SECURED')
    expect(view.text()).toContain('REBATTLE')
  })
})

describe('Achievements', () => {
  it('shows the badge grid with locked state', () => {
    const view = render(<Achievements />)
    const text = view.text()
    expect(text).toContain('ACHIEVEMENTS')
    expect(text).toContain('0/10')
    expect(text).toContain('First Blood')
    expect(text).toContain('Serpent Slayer')
  })

  it('flips badges to unlocked and pops a toast after a command', () => {
    const view = render(<Achievements />)
    act(() => {
      useGameStore.getState().runCommand('SET name Ada')
    })

    // SET unlocks First Blood and String Slinger together
    expect(view.text()).toContain('2/10')
    expect(view.text()).toContain('UNLOCKED')
    expect(view.text()).toContain('ACHIEVEMENT UNLOCKED')
    expect(view.text()).toContain('First Blood')
    expect(view.text()).toContain('+10 XP')
  })
})
