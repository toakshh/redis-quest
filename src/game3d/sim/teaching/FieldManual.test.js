import { describe, it, expect } from 'vitest'
import { createFieldManual } from './FieldManual.js'

describe('FieldManual', () => {
  const d1 = {
    realWorldName: 'Store',
    whatYouDid: 'Saved',
    actualCommand: 'SET',
    whenToUse: 'Now',
    ifWrong: 'Bad'
  }

  const d2 = {
    realWorldName: 'Get',
    whatYouDid: 'Read',
    actualCommand: 'GET',
    whenToUse: 'Later',
    ifWrong: 'Worse'
  }

  it('1. Adds pages and maintains order', () => {
    const fm = createFieldManual()
    fm.addPage(d1)
    fm.addPage(d2)

    expect(fm.pages).toHaveLength(2)
    expect(fm.pages[0]).toBe(d1)
    expect(fm.pages[1]).toBe(d2)
  })

  it('2. Deduplicates identical pages (by command or id)', () => {
    const fm = createFieldManual()
    fm.addPage(d1)
    fm.addPage(d1) // duplicate by actualCommand implicit
    expect(fm.pages).toHaveLength(1)

    fm.addPage(d2, 'id2')
    fm.addPage(d2, 'id2') // duplicate by id
    expect(fm.pages).toHaveLength(2)
  })

  it('3. exportMarkdown produces readable markdown containing the fields', () => {
    const fm = createFieldManual()
    fm.addPage(d1)

    const md = fm.exportMarkdown()
    expect(md).toContain('# Field Manual - Runbook')
    expect(md).toContain('## 1. Store')
    expect(md).toContain('```\nSET\n```')
    expect(md).toContain('When to use it\nNow')
  })
})
