// Isolation guard rail (Law L3, L4, L5) — the 3D mode must never reach into
// the 2D game's runtime state. It may import shared CLASSES (EventBus,
// IncidentEngine, MockRedisEngine) but never an exported SINGLETON instance,
// and never the 2D store or 2D audio engine directly. This test walks every
// file under src/game3d/ (excluding this directory) and fails the build on
// any violation, so the rule survives contact with future edits.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const GAME3D_ROOT = path.resolve(__dirname, '..')

const FORBIDDEN = [
  { pattern: /from\s+['"].*store\/gameStore(\.js)?['"]/, law: 'L3' },
  { pattern: /from\s+['"].*audio\/SoundEngine(\.js)?['"]/, law: 'L4' },
  { pattern: /\bimport\s*\{[^}]*\beventBus\b[^}]*\}/, law: 'L5' },
  { pattern: /\bimport\s*\{[^}]*\bincidentEngine\b[^}]*\}/, law: 'L5' },
  { pattern: /\bimport\s*\{[^}]*\bsoundEngine\b[^}]*\}/, law: 'L5' },
  { pattern: /\bimport\s*\{[^}]*\bdefaultMasteryEngine\b[^}]*\}/, law: 'L5' },
  { pattern: /\bimport\s*\{[^}]*\bworldStateResolver\b[^}]*\}/, law: 'L5' },
  { pattern: /\bimport\s*\{[^}]*\bconsequenceEngine\b[^}]*\}/, law: 'L5' },
]

function walk(dir, exclude) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (full === exclude) continue
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      out.push(...walk(full, exclude))
    } else if (/\.(js|jsx)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

function findViolations() {
  const testsDir = path.join(GAME3D_ROOT, '__tests__')
  const files = walk(GAME3D_ROOT, testsDir)
  const violations = []
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const rule of FORBIDDEN) {
        if (rule.pattern.test(lines[i])) {
          violations.push({
            file: path.relative(GAME3D_ROOT, file),
            law: rule.law,
            line: i + 1,
            text: lines[i].trim(),
          })
        }
      }
    }
  }
  return violations
}

describe('game3d isolation from the 2D game (Laws L3, L4, L5)', () => {
  it('has no file importing the 2D store, the 2D audio engine, or an exported singleton', () => {
    const violations = findViolations()
    if (violations.length > 0) {
      const message = violations
        .map((v) => `${v.file}:${v.line} [${v.law}] ${v.text}`)
        .join('\n')
      throw new Error(`Isolation violation(s) found:\n${message}`)
    }
    expect(violations).toEqual([])
  })
})
