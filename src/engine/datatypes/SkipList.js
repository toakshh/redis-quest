// SkipList — the real structure behind Redis sorted sets, so the Memory
// Inspector can render the multi-level forward pointers, spans and the
// backward chain. Scores are numbers; members are unique strings.
//
// A node carries:
//   member, score
//   levels: Array<{ next, span }>   (index 0 = bottom level, chain of nodes)
//   back:   node at level 0 (previous in sorted order)
//
// The companion `index` is a Map member -> score giving O(1) ZSCORE.

const MAX_LEVEL = 32
const P = 0.25 // probability of growing one level (matches Redis ZSKIPLIST_P)

let zsetNodeSeq = 0

export class SkipListNode {
  constructor(member, score, height) {
    this.id = zsetNodeSeq++
    this.member = member
    this.score = score
    this.levels = []
    for (let i = 0; i < height; i++) {
      this.levels.push({ next: null, span: 0 })
    }
    this.back = null
  }

  get height() {
    return this.levels.length
  }
}

function randomLevel() {
  let level = 1
  while (Math.random() < P && level < MAX_LEVEL) level++
  return level
}

export class SkipList {
  constructor() {
    // header is a sentinel node; height tracks the current max height
    this.header = new SkipListNode('__HEADER__', 0, MAX_LEVEL)
    this.tail = null
    this.len = 0
    this.level = 1
    this.index = new Map() // member -> score (for O(1) ZSCORE)
  }

  get length() {
    return this.len
  }

  // O(log n) lookup of the node holding member, or null.
  find(member) {
    const score = this.index.get(member)
    if (score === undefined) return null
    // walk down from the top to the node
    let x = this.header
    for (let i = this.level - 1; i >= 0; i--) {
      while (
        x.levels[i].next &&
        (x.levels[i].next.score < score ||
          (x.levels[i].next.score === score && x.levels[i].next.member < member))
      ) {
        x = x.levels[i].next
      }
    }
    x = x.levels[0].next
    if (x && x.member === member) return x
    return null
  }

  scoreOf(member) {
    const s = this.index.get(member)
    return s === undefined ? null : s
  }

  insert(member, score) {
    const update = new Array(MAX_LEVEL)
    const span = new Array(MAX_LEVEL)
    let x = this.header

    for (let i = this.level - 1; i >= 0; i--) {
      let s = 0
      while (
        x.levels[i].next &&
        (x.levels[i].next.score < score ||
          (x.levels[i].next.score === score && x.levels[i].next.member < member))
      ) {
        s += x.levels[i].span
        x = x.levels[i].next
      }
      update[i] = x
      span[i] = s
    }

    const newLevel = randomLevel()
    if (newLevel > this.level) {
      for (let i = this.level; i < newLevel; i++) {
        update[i] = this.header
        span[i] = 0
        this.header.levels[i].span = this.len
      }
      this.level = newLevel
    }

    const node = new SkipListNode(member, score, newLevel)
    for (let i = 0; i < newLevel; i++) {
      node.levels[i].next = update[i].levels[i].next
      update[i].levels[i].next = node
      node.levels[i].span = update[i].levels[i].span - span[i]
      update[i].levels[i].span = span[i] + 1
    }
    // levels above the new node height get their span bumped
    for (let i = newLevel; i < this.level; i++) {
      update[i].levels[i].span++
    }

    node.back = update[0] === this.header ? null : update[0]
    if (node.levels[0].next) node.levels[0].next.back = node
    else this.tail = node

    this.len++
    this.index.set(member, score)
    return node
  }

  // Returns the removed node or null.
  remove(member) {
    const score = this.index.get(member)
    if (score === undefined) return null
    const update = new Array(MAX_LEVEL)
    let x = this.header
    for (let i = this.level - 1; i >= 0; i--) {
      while (
        x.levels[i].next &&
        (x.levels[i].next.score < score ||
          (x.levels[i].next.score === score && x.levels[i].next.member < member))
      ) {
        x = x.levels[i].next
      }
      update[i] = x
    }
    x = x.levels[0].next
    if (!x || x.member !== member) return null

    for (let i = 0; i < this.level; i++) {
      if (update[i].levels[i].next === x) {
        update[i].levels[i].next = x.levels[i].next
        update[i].levels[i].span += x.levels[i].span - 1
      } else {
        update[i].levels[i].span--
      }
    }
    if (x.levels[0].next) x.levels[0].next.back = x.back
    else this.tail = x.back

    while (this.level > 1 && !this.header.levels[this.level - 1].next) {
      this.level--
    }
    this.len--
    this.index.delete(member)
    return x
  }

  // Zero-based rank of member, or null. (rank 0 = smallest score)
  rankOf(member) {
    const score = this.index.get(member)
    if (score === undefined) return null
    let x = this.header
    let rank = 0
    for (let i = this.level - 1; i >= 0; i--) {
      while (
        x.levels[i].next &&
        (x.levels[i].next.score < score ||
          (x.levels[i].next.score === score && x.levels[i].next.member < member))
      ) {
        rank += x.levels[i].span
        x = x.levels[i].next
      }
      if (x.levels[i].next && x.levels[i].next.member === member) {
        return rank + x.levels[i].span - 1
      }
    }
    return null
  }

  // Node at zero-based rank (largest first when reverse).
  nodeAtRank(rank, reverse = false) {
    if (rank < 0 || rank >= this.len) return null
    if (!reverse) {
      let x = this.header
      let r = 0
      for (let i = this.level - 1; i >= 0; i--) {
        while (x.levels[i].next && r + x.levels[i].span <= rank) {
          r += x.levels[i].span
          x = x.levels[i].next
        }
      }
      return x === this.header ? null : x
    }
    let x = this.tail
    for (let k = 0; k < rank; k++) x = x.back
    return x
  }

  // Ordered members+score from start..end inclusive by rank (0-based).
  rangeByRank(start, end, reverse = false) {
    const out = []
    if (this.len === 0) return out
    if (start < 0) start = this.len + start
    if (end < 0) end = this.len + end
    if (start < 0) start = 0
    if (end >= this.len) end = this.len - 1
    if (start > end) return out
    let node = this.nodeAtRank(reverse ? this.len - 1 - end : start, false)
    const count = end - start + 1
    for (let k = 0; k < count; k++) {
      if (!node) break
      out.push({ member: node.member, score: node.score, node })
      node = reverse ? node.back : node.levels[0].next
    }
    return out
  }

  // Ordered members+score within [minScore, maxScore] (both inclusive),
  // optionally reversed. min/max may be null for unbounded.
  rangeByScore(minScore, maxScore, reverse = false) {
    const out = []
    if (this.len === 0) return out
    if (!reverse) {
      // advance to the first node with score >= minScore
      let x = this.header
      for (let i = this.level - 1; i >= 0; i--) {
        while (
          x.levels[i].next &&
          (minScore === null || x.levels[i].next.score < minScore)
        ) {
          x = x.levels[i].next
        }
      }
      let node = x.levels[0].next
      while (node && (maxScore === null || node.score <= maxScore)) {
        out.push({ member: node.member, score: node.score, node })
        node = node.levels[0].next
      }
      return out
    }
    // reverse: start at the highest node with score <= maxScore
    let x = this.header
    for (let i = this.level - 1; i >= 0; i--) {
      while (
        x.levels[i].next &&
        (maxScore === null || x.levels[i].next.score <= maxScore)
      ) {
        x = x.levels[i].next
      }
    }
    let node = x === this.header ? null : x
    while (node && (minScore === null || node.score >= minScore)) {
      out.push({ member: node.member, score: node.score, node })
      node = node.back
    }
    return out
  }

  // Count of members within [min, max].
  countByScore(minScore, maxScore) {
    if (minScore !== null && maxScore !== null && minScore > maxScore) return 0
    return this.rangeByScore(minScore, maxScore, false).length
  }

  // Ordered list of nodes (level 0 chain), smallest score first.
  toArray() {
    const out = []
    let n = this.header.levels[0].next
    while (n) {
      out.push(n)
      n = n.levels[0].next
    }
    return out
  }

  clear() {
    this.header = new SkipListNode('__HEADER__', 0, MAX_LEVEL)
    this.tail = null
    this.len = 0
    this.level = 1
    this.index = new Map()
  }
}
