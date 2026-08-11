// redis-cli-compatible line tokenizer. Honors double and single quotes and
// backslash escapes, matching how the redis-cli interactive shell splits a
// command line. Returns { ok, tokens } or { ok:false, error }.
//
// Rules (matching redis-cli's sdssplitargs):
//   - whitespace separates tokens
//   - "..." and '...' group, the other quote is literal inside them
//   - \ escapes the next char (inside quotes \", \\, \n, \t are real;
//     outside quotes any escaped char is taken literally)
//   - an unterminated quote or trailing backslash is an error

export function splitArgs(line) {
  const tokens = []
  let cur = ''
  let i = 0
  const n = line.length

  const flush = () => {
    if (cur.length > 0) {
      tokens.push(cur)
      cur = ''
    }
  }

  while (i < n) {
    const c = line[i]

    if (c === ' ') {
      flush()
      i++
      continue
    }

    if (c === '"' || c === "'") {
      // quoted section
      const quote = c
      i++
      let closed = false
      while (i < n) {
        const qc = line[i]
        if (qc === '\\') {
          if (i + 1 >= n) return { ok: false, error: 'Unbalanced quotes in request' }
          const next = line[i + 1]
          if (next === 'n') cur += '\n'
          else if (next === 't') cur += '\t'
          else if (next === 'r') cur += '\r'
          else cur += next
          i += 2
        } else if (qc === quote) {
          closed = true
          i++
          break
        } else {
          cur += qc
          i++
        }
      }
      if (!closed) return { ok: false, error: 'Unbalanced quotes in request' }
      continue
    }

    if (c === '\\') {
      if (i + 1 >= n) return { ok: false, error: 'Unbalanced quotes in request' }
      cur += line[i + 1]
      i += 2
      continue
    }

    cur += c
    i++
  }

  flush()
  return { ok: true, tokens }
}
