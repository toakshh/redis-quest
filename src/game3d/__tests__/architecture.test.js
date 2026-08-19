// Architecture guard rail (Laws L1, L2, L18, L19) — the simulation layer
// (src/game3d/sim/) must stay headless: no three.js, no React, no DOM
// globals, no non-deterministic randomness or wall-clock reads. This is the
// single rule whose absence killed the previous 3D attempt (see
// claude-plan-pro.md section 4). Enforced here, not by convention, so it
// survives contact with future edits under time pressure.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SIM_ROOT = path.resolve(__dirname, '..', 'sim')

const SIM_FORBIDDEN = [
  { pattern: /from\s+['"]three['"]/, law: 'L1', hint: 'sim must not import three.js' },
  { pattern: /from\s+['"]@react-three\//, law: 'L1', hint: 'sim must not import R3F' },
  { pattern: /from\s+['"]react['"]/, law: 'L1', hint: 'sim must not import react' },
  { pattern: /\bwindow\./, law: 'L2', hint: 'sim must not touch window' },
  { pattern: /\bdocument\./, law: 'L2', hint: 'sim must not touch document' },
  { pattern: /\blocalStorage\b/, law: 'L2', hint: 'sim must not touch localStorage' },
  { pattern: /\bnavigator\./, law: 'L2', hint: 'sim must not touch navigator' },
  { pattern: /Math\.random\s*\(/, law: 'L18', hint: 'use the injected rng' },
  { pattern: /Date\.now\s*\(/, law: 'L19', hint: 'use the injected clock' },
  { pattern: /performance\.now\s*\(/, law: 'L19', hint: 'use the injected clock' },
]

function walk(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      out.push(...walk(full))
    } else if (/\.js$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

function findViolations() {
  const files = walk(SIM_ROOT)
  const violations = []
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const rule of SIM_FORBIDDEN) {
        if (rule.pattern.test(lines[i])) {
          violations.push({
            file: path.relative(SIM_ROOT, file),
            law: rule.law,
            hint: rule.hint,
            line: i + 1,
            text: lines[i].trim(),
          })
        }
      }
    }
  }
  return violations
}

describe('game3d/sim stays headless (Laws L1, L2, L18, L19)', () => {
  it('has no file importing three.js, R3F, or react', () => {
    const violations = findViolations().filter((v) => v.law === 'L1')
    if (violations.length > 0) {
      const message = violations
        .map((v) => `sim/${v.file}:${v.line} [${v.law}] ${v.hint} — ${v.text}`)
        .join('\n')
      throw new Error(`Architecture violation(s) found:\n${message}`)
    }
    expect(violations).toEqual([])
  })

  it('has no file touching window, document, localStorage or navigator', () => {
    const violations = findViolations().filter((v) => v.law === 'L2')
    if (violations.length > 0) {
      const message = violations
        .map((v) => `sim/${v.file}:${v.line} [${v.law}] ${v.hint} — ${v.text}`)
        .join('\n')
      throw new Error(`Architecture violation(s) found:\n${message}`)
    }
    expect(violations).toEqual([])
  })

  it('has no file using Math.random(), Date.now(), or performance.now() directly', () => {
    const violations = findViolations().filter((v) => v.law === 'L18' || v.law === 'L19')
    if (violations.length > 0) {
      const message = violations
        .map((v) => `sim/${v.file}:${v.line} [${v.law}] ${v.hint} — ${v.text}`)
        .join('\n')
      throw new Error(`Architecture violation(s) found:\n${message}`)
    }
    expect(violations).toEqual([])
  })
})
