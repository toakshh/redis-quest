import { useEffect, useRef, useState } from 'react'
import { registry } from '../engine/registry.js'

// ---------------------------------------------------------------------------
// Terminal — an interactive cyberpunk-styled redis-cli terminal.
//
// Props:
//   engine    MockRedisEngine (required). execute(line) is called on submit
//            unless `onSubmit` is provided.
//   onSubmit  optional callback: onSubmit(line) → reply. When provided it
//            REPLACES engine.execute for the submitted line (the game store's
//            runCommand is the canonical execution path — it runs the engine
//            itself and returns the reply, so the terminal never double-runs).
//   onExecute optional callback: onExecute(line, reply) — fired for every
//            non-empty command that is executed, so the game store can record
//            commands for missions/XP. `line` is the trimmed raw input,
//            `reply` is the engine's RedisReply object.
//
// Replies are rendered redis-cli style from the RESP-shaped RedisReply objects
// produced by src/engine/reply.js (see formatReply below).
// ---------------------------------------------------------------------------

// Plain-string formatter — byte-for-byte equivalent of the one in App.jsx so
// both the terminal and any external tooling render replies identically.
export function formatReply(reply) {
  if (!reply) return ''
  switch (reply.type) {
    case 'simple':
      return reply.value
    case 'error':
      return `(error) ${reply.value}`
    case 'integer':
      return `(integer) ${reply.value}`
    case 'bulk':
      return `"${reply.value}"`
    case 'nil':
      return '(nil)'
    case 'status':
      return reply.value
    case 'array':
      if (reply.value.length === 0) return '(empty array)'
      return reply.value.map((item, i) => `${i + 1}) ${formatReply(item)}`).join('\n')
    default:
      return String(reply.value ?? '')
  }
}

// Colored renderer for the scrollback. Mirrors formatReply's structure but
// colors each reply kind for the cyberpunk theme.
function ReplyView({ reply }) {
  if (!reply) return null
  switch (reply.type) {
    case 'simple':
    case 'status':
      return <span className="text-cyan">{reply.value}</span>
    case 'error':
      return <span className="text-red">(error) {reply.value}</span>
    case 'integer':
      return (
        <span>
          (integer) <span className="text-amber">{reply.value}</span>
        </span>
      )
    case 'bulk':
      return (
        <span className="text-green">
          &quot;{reply.value}&quot;
        </span>
      )
    case 'nil':
      return <span className="text-dim">(nil)</span>
    case 'array':
      if (reply.value.length === 0) {
        return <span className="text-dim">(empty array)</span>
      }
      return (
        <>
          {reply.value.map((item, i) => (
            <div key={i} className="whitespace-pre-wrap">
              <span className="text-dim">{i + 1})</span> <ReplyView reply={item} />
            </div>
          ))}
        </>
      )
    default:
      return <>{String(reply.value ?? '')}</>
  }
}

// Lightweight tokenizer for syntax highlighting. Keeps the raw text so the
// overlay stays pixel-aligned with the transparent text input.
function highlightTokens(line) {
  const tokens = []
  let i = 0
  const n = line.length
  while (i < n) {
    const c = line[i]
    if (c === ' ') {
      let j = i
      while (j < n && line[j] === ' ') j++
      tokens.push({ type: 'space', text: line.slice(i, j) })
      i = j
    } else if (c === '"' || c === "'") {
      const quote = c
      let j = i + 1
      while (j < n) {
        if (line[j] === '\\' && j + 1 < n) {
          j += 2
          continue
        }
        if (line[j] === quote) {
          j++
          break
        }
        j++
      }
      tokens.push({ type: 'string', text: line.slice(i, j) })
      i = j
    } else {
      let j = i
      while (j < n && line[j] !== ' ' && line[j] !== '"' && line[j] !== "'") j++
      const word = line.slice(i, j)
      tokens.push({
        type: /^-?\d+(\.\d+)?$/.test(word) ? 'number' : 'word',
        text: word,
      })
      i = j
    }
  }
  return tokens
}

// Renders a command line with the command keyword (if recognized), quoted
// strings and numbers colored. Used both in the scrollback and as the
// highlight layer behind the live input.
function HighlightedLine({ line }) {
  const tokens = highlightTokens(line)
  let firstWord = -1
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'word') {
      firstWord = i
      break
    }
  }
  return (
    <>
      {tokens.map((t, i) => {
        let className = 'text-fg'
        if (t.type === 'number') className = 'text-amber'
        else if (t.type === 'string') className = 'text-green'
        else if (t.type === 'word' && i === firstWord && registry.has(t.text.toUpperCase())) {
          className = 'text-cyan font-bold'
        }
        return (
          <span key={i} className={className}>
            {t.text}
          </span>
        )
      })}
    </>
  )
}

export default function Terminal({ engine, onSubmit, onExecute }) {
  const [output, setOutput] = useState([]) // { line, reply }
  const [input, setInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState([]) // raw executed lines
  const [cmdIndex, setCmdIndex] = useState(-1) // -1 = editing a fresh line
  const [draft, setDraft] = useState('') // saved input while browsing history

  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [output])

  const runCommand = (event) => {
    event.preventDefault()
    const line = input.trim()
    if (!line) return
    const reply = onSubmit ? onSubmit(line) : engine.execute(line)
    setOutput((prev) => [...prev, { line, reply }])
    // Skip consecutive duplicates, like redis-cli's history dedupe.
    setCmdHistory((prev) => (prev[prev.length - 1] === line ? prev : [...prev, line]))
    setCmdIndex(-1)
    setDraft('')
    setInput('')
    onExecute?.(line, reply)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (cmdHistory.length === 0) return
      if (cmdIndex === -1) setDraft(input)
      const idx = cmdIndex === -1 ? cmdHistory.length - 1 : Math.max(0, cmdIndex - 1)
      setCmdIndex(idx)
      setInput(cmdHistory[idx])
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (cmdIndex === -1) return
      const next = cmdIndex + 1
      if (next >= cmdHistory.length) {
        setCmdIndex(-1)
        setInput(draft)
      } else {
        setCmdIndex(next)
        setInput(cmdHistory[next])
      }
    } else if (event.ctrlKey && event.key === 'l') {
      // redis-cli style clear screen
      event.preventDefault()
      setOutput([])
    }
  }

  const handleChange = (event) => {
    setInput(event.target.value)
    // Typing cancels history browsing.
    if (cmdIndex !== -1) setCmdIndex(-1)
  }

  return (
    <div className="panel scanlines relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-edge px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber" />
        <span className="h-2.5 w-2.5 rounded-full bg-green" />
        <span className="ml-2 text-xs tracking-widest text-dim">redis-cli · redis-quest</span>
      </div>

      <div className="terminal-output min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {output.length === 0 && (
          <p className="text-dim">
            Welcome to Redis Quest. Try{' '}
            <span className="text-cyan">SET name "Ada"</span> then{' '}
            <span className="text-cyan">GET name</span>. Press{' '}
            <span className="text-amber">↑/↓</span> to recall commands.
          </p>
        )}
        {output.map(({ line, reply }, index) => (
          <div key={index} className="mb-3">
            <div className="whitespace-pre-wrap break-words">
              <span className="select-none text-green">&gt;</span> <HighlightedLine line={line} />
            </div>
            <div className="whitespace-pre-wrap break-words pl-4">
              <ReplyView reply={reply} />
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={runCommand}
        className="relative flex items-center gap-2 border-t border-edge px-4 py-3"
      >
        <span className="select-none text-green">&gt;</span>
        <div className="relative flex-1">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre text-fg"
          >
            <HighlightedLine line={input} />
          </div>
          <input
            ref={inputRef}
            className="terminal-input relative w-full text-transparent placeholder:text-dim selection:bg-cyan/25 selection:text-transparent"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="type a Redis command…"
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Redis command input"
          />
        </div>
      </form>
    </div>
  )
}
