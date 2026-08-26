// Bundle-split guard (Law L5's sibling: the 3D chunk must never load for a
// 2D-only player). Complements the actual build output check (T-011 proved
// game3d lands in its own chunk); this test guards the SOURCE so the split
// cannot silently regress — only the `lazy(() => import(...))` form is
// permitted to reference game3d from outside it.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC_ROOT = path.resolve(__dirname, '..', '..')

// Matches a static `import ... from '(./|../)game3d...'` but not the
// dynamic `import(...)` call form used by React.lazy.
const STATIC_GAME3D_IMPORT = /^\s*import\s+[^(].*from\s+['"]\.{1,2}\/game3d/m

function walk(dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      out.push(...walk(full))
    } else if (/\.(js|jsx)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

describe('game3d stays behind a lazy boundary', () => {
  it('no file outside game3d/ statically imports from game3d/', () => {
    const files = [
      ...walk(path.join(SRC_ROOT, 'components')),
      ...walk(path.join(SRC_ROOT, 'systems')),
      ...walk(path.join(SRC_ROOT, 'game')),
      path.join(SRC_ROOT, 'App.jsx'),
    ]
    const violations = []
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      if (STATIC_GAME3D_IMPORT.test(text)) {
        violations.push(path.relative(SRC_ROOT, file))
      }
    }
    expect(violations).toEqual([])
  })

  it("App.jsx lazy-loads game3d via the exact lazy(() => import('./game3d/index.js')) form", () => {
    const appText = fs.readFileSync(path.join(SRC_ROOT, 'App.jsx'), 'utf8')
    expect(appText).toContain("lazy(() => import('./game3d/index.js'))")
  })

  it('no file under components/, systems/, or game/ imports three.js', () => {
    const files = [
      ...walk(path.join(SRC_ROOT, 'components')),
      ...walk(path.join(SRC_ROOT, 'systems')),
      ...walk(path.join(SRC_ROOT, 'game')),
    ]
    const violations = []
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      if (/from\s+['"]three['"]/.test(text)) {
        violations.push(path.relative(SRC_ROOT, file))
      }
    }
    expect(violations).toEqual([])
  })
})
