// Doubly-linked list — the real structure behind Redis lists, so the
// Memory Inspector can render head/tail and the bidirectional arrows.
// Lists in real Redis store byte strings; here values are strings.

let nodeSeq = 0

export class ListNode {
  constructor(value) {
    this.id = nodeSeq++
    this.value = value
    this.prev = null
    this.next = null
  }
}

export class LinkedList {
  constructor() {
    this.head = null
    this.tail = null
    this.len = 0
  }

  get length() {
    return this.len
  }

  pushFront(value) {
    const n = new ListNode(value)
    if (this.len === 0) {
      this.head = this.tail = n
    } else {
      n.next = this.head
      this.head.prev = n
      this.head = n
    }
    this.len++
    return this.len
  }

  pushBack(value) {
    const n = new ListNode(value)
    if (this.len === 0) {
      this.head = this.tail = n
    } else {
      n.prev = this.tail
      this.tail.next = n
      this.tail = n
    }
    this.len++
    return this.len
  }

  // Returns the removed node's value, or null.
  popFront() {
    if (this.len === 0) return null
    const n = this.head
    this.head = n.next
    if (this.head) this.head.prev = null
    else this.tail = null
    n.prev = n.next = null
    this.len--
    return n.value
  }

  popBack() {
    if (this.len === 0) return null
    const n = this.tail
    this.tail = n.prev
    if (this.tail) this.tail.next = null
    else this.head = null
    n.prev = n.next = null
    this.len--
    return n.value
  }

  nodeAt(index) {
    // positive or negative index (like LINDEX semantics)
    let i = index < 0 ? this.len + index : index
    if (i < 0 || i >= this.len) return null
    let n = this.head
    if (i <= this.len / 2) {
      for (let k = 0; k < i; k++) n = n.next
    } else {
      n = this.tail
      for (let k = this.len - 1; k > i; k--) n = n.prev
    }
    return n
  }

  valueAt(index) {
    const n = this.nodeAt(index)
    return n ? n.value : null
  }

  insertAfter(node, value) {
    const n = new ListNode(value)
    n.prev = node
    n.next = node.next
    if (node.next) node.next.prev = n
    else this.tail = n
    node.next = n
    this.len++
    return n
  }

  insertBefore(node, value) {
    const n = new ListNode(value)
    n.next = node
    n.prev = node.prev
    if (node.prev) node.prev.next = n
    else this.head = n
    node.prev = n
    this.len++
    return n
  }

  remove(node) {
    if (node.prev) node.prev.next = node.next
    else this.head = node.next
    if (node.next) node.next.prev = node.prev
    else this.tail = node.prev
    node.prev = node.next = null
    this.len--
    return node.value
  }

  // Values as an array (front to back). Used by LRANGE and the inspector.
  toArray() {
    const out = []
    let n = this.head
    while (n) {
      out.push(n.value)
      n = n.next
    }
    return out
  }

  forEach(fn) {
    let n = this.head
    while (n) {
      fn(n)
      n = n.next
    }
  }
}
