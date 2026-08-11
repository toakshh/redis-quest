// Convert a Redis glob pattern to a RegExp. Supports *, ?, [..], [^..],
// [a-z] ranges, and backslash escaping of the next char, matching redis
// stringmatchlen semantics for the common cases.

export function globToRegExp(pattern) {
  let re = '^'
  let i = 0
  const n = pattern.length
  while (i < n) {
    const c = pattern[i]
    if (c === '\\' && i + 1 < n) {
      re += escapeRe(pattern[i + 1])
      i += 2
    } else if (c === '*') {
      re += '.*'
      i++
    } else if (c === '?') {
      re += '.'
      i++
    } else if (c === '[') {
      // parse bracket expression: find closing ']' (first one not escaped)
      let j = i + 1
      let negate = false
      if (pattern[j] === '^' || pattern[j] === '!') {
        negate = true
        j++
      }
      let inner = ''
      let closed = false
      while (j < n) {
        const cc = pattern[j]
        if (cc === '\\' && j + 1 < n) {
          inner += escapeRe(pattern[j + 1])
          j += 2
          continue
        }
        if (cc === ']' && inner.length > 0) {
          closed = true
          break
        }
        if (cc === '-' && j > i + 1 && j + 1 < n) {
          inner += '-'
          j++
          continue
        }
        // preserve the literal, escaping regex specials but keeping ranges
        inner += cc
        j++
      }
      if (!closed) {
        // no closing bracket: '[' is literal
        re += '\\['
        i++
        continue
      }
      re += (negate ? '[^' : '[') + inner + ']'
      i = j + 1
    } else {
      re += escapeRe(c)
      i++
    }
  }
  re += '$'
  return new RegExp(re)
}

function escapeRe(ch) {
  return /[.*+?^${}()|[\]\\]/.test(ch) ? '\\' + ch : ch
}

// Build a matcher function for a pattern.
export function makeGlobMatcher(pattern) {
  const re = globToRegExp(pattern)
  return (s) => re.test(s)
}
