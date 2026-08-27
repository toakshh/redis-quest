// Readability — Flesch-Kincaid grade/reading-ease for the CI check that keeps
// every user-facing string (REX dialogue, encyclopedia, docs, tutorials) at a
// 7th-grade reading level. The syllable counter is a vowel-group heuristic with
// common silent-e / y / le rules — plenty for grading short game copy.

// Count English syllables in a word. Kept simple on purpose: perfect counts are
// unnecessary for a CI gate; consistency across edits is what matters.
export function countSyllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, '')
  if (w.length === 0) return 0
  // Every vowel group is one syllable by default.
  let count = (w.match(/[aeiouy]+/g) || []).length
  // Drop a trailing silent 'e' that is not the only vowel ('made', 'name').
  if (/(?:^|[^aeiou])e$/.test(w) && !/^[aeiou]+e$/.test(w)) count = Math.max(1, count - 1)
  // 'le' at the end usually adds a syllable ('table' = 2).
  if (/(?:[^aeiou])(?:l)e$/.test(w) && w.length > 3) count += 1
  return Math.max(1, count)
}

// Split prose into sentences on terminal punctuation (periods, !, ?).
function splitSentences(text) {
  const cleaned = String(text).replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function words(text) {
  return String(text).match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []
}

export function textStats(text) {
  const sentences = splitSentences(text)
  const allWords = words(text)
  const syllableCount = allWords.reduce((sum, w) => sum + countSyllables(w), 0)
  return {
    words: allWords.length,
    sentences: sentences.length,
    syllables: syllableCount,
  }
}

// Flesch Reading Ease: 100 = very easy, 0 = very hard. 7th grade ≈ 60-70.
export function fleschReadingEase(text) {
  const { words: w, sentences: s, syllables: syl } = textStats(text)
  if (w === 0) return 100
  return 206.835 - 1.015 * (w / Math.max(1, s)) - 84.6 * (syl / w)
}

// Flesch-Kincaid Grade Level: US school grade needed to read the text.
// Target: <= 7 (seventh grade).
export function fleschKincaidGrade(text) {
  const { words: w, sentences: s, syllables: syl } = textStats(text)
  if (w === 0) return 0
  return 0.39 * (w / Math.max(1, s)) + 11.8 * (syl / w) - 15.59
}

// Convenience predicate used by the CI test and the text-data authoring pass.
export const SEVENTH_GRADE_MAX = 7.5
export function isSeventhGrade(text, max = SEVENTH_GRADE_MAX) {
  return fleschKincaidGrade(text) <= max
}
