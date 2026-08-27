import { useEffect, useRef, useState } from 'react'
import { registry } from '../engine/registry.js'
import { useGameStore } from '../store/gameStore.js'

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

// Rich Error Renderer displaying category badges & diagnostic hints for incident response.
export function ErrorReplyView({ message }) {
  const msg = String(message ?? '')
  const msgUpper = msg.toUpperCase()

  let category = 'ERROR'
  let badgeColor = 'bg-red-500/25 text-red-300 border-red-500/40'
  let hint = null

  if (msgUpper.includes('WRONGTYPE')) {
    category = 'WRONGTYPE'
    badgeColor = 'bg-rose-500/30 text-rose-300 border-rose-500/60 font-bold'
    hint = 'The operation is not supported for this key\'s data type. Use TYPE <key> to inspect, or DEL <key> before re-creating.'
  } else if (
    msgUpper.includes('SYNTAX') ||
    msgUpper.includes('WRONG NUMBER OF ARGUMENTS') ||
    msgUpper.includes('INVALID INT') ||
    msgUpper.includes('INVALID FLOAT')
  ) {
    category = 'SYNTAX ERROR'
    badgeColor = 'bg-amber-500/30 text-amber-300 border-amber-500/60 font-bold'
    hint = 'Command arguments or flags are invalid. Refer to inline syntax hints or use HELP <command>.'
  } else if (
    msgUpper.includes('NO SUCH KEY') ||
    msgUpper.includes('KEY NOT FOUND') ||
    msgUpper.includes('KEY MISSING')
  ) {
    category = 'MISSING KEY'
    badgeColor = 'bg-purple-500/30 text-purple-300 border-purple-500/60 font-bold'
    hint = 'Target key does not exist. Use KEYS * or EXISTS <key> to inspect active keys in the database.'
  }

  return (
    <div className="my-1.5 p-2 rounded-md border border-red-500/30 bg-red-950/30 text-red-300 font-mono text-xs shadow-inner" data-testid="error-formatting">
      <div className="flex items-center gap-2 font-semibold">
        <span className={`px-1.5 py-0.5 text-[10px] rounded border uppercase tracking-wider ${badgeColor}`}>
          {category}
        </span>
        <span className="text-red-400 font-mono">(error) {msg}</span>
      </div>
      {hint && (
        <div className="mt-1.5 pt-1 border-t border-red-500/20 text-[11px] text-amber-200/90 flex items-start gap-1">
          <span className="shrink-0 text-amber-400 font-semibold">💡 Diagnostic Hint:</span>
          <span>{hint}</span>
        </div>
      )}
    </div>
  )
}

// Colored renderer for the scrollback.
function ReplyView({ reply }) {
  if (!reply) return null
  switch (reply.type) {
    case 'simple':
    case 'status':
      return <span className="text-cyan">{reply.value}</span>
    case 'error':
      return <ErrorReplyView message={reply.value} />
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

// Helper to calculate inline syntax hint remaining ghost text
export function getInlineSyntaxHint(input) {
  if (!input) return ''
  const trimmed = input.trimStart()
  if (!trimmed) return ''
  const match = trimmed.match(/^([a-zA-Z0-9_-]+)/)
  if (!match) return ''
  const cmdName = match[1].toUpperCase()
  const cmdFn = registry.get(cmdName)
  if (!cmdFn || !cmdFn.syntax) return ''

  const syntax = cmdFn.syntax
  if (syntax.toUpperCase().startsWith(trimmed.toUpperCase())) {
    return syntax.slice(trimmed.length)
  }

  // Parameter ghost hint matching token positions
  const inputTokens = trimmed.split(/\s+/)
  const syntaxTokens = syntax.split(/\s+/)
  if (inputTokens.length > 1 && inputTokens[0].toUpperCase() === syntaxTokens[0].toUpperCase()) {
    const isEndingWithSpace = trimmed.endsWith(' ')
    const activeIndex = inputTokens.length - (isEndingWithSpace ? 0 : 1)
    if (activeIndex < syntaxTokens.length) {
      const remaining = syntaxTokens.slice(activeIndex).join(' ')
      return (isEndingWithSpace ? '' : ' ') + remaining
    }
  }

  return ''
}

// Lightweight tokenizer for syntax highlighting.
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

export default function Terminal({ engine, onSubmit, onExecute, onCloseDrawer }) {
  const [output, setOutput] = useState([]) // { line, reply, incidentFeedback }
  const [input, setInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState([]) // raw executed lines
  const [cmdIndex, setCmdIndex] = useState(-1) // -1 = editing a fresh line
  const [draft, setDraft] = useState('') // saved input while browsing history

  const terminalAutocomplete = useGameStore((s) => s.terminalAutocomplete !== false)
  const activeIncident = useGameStore((s) => s.activeIncident)

  const endRef = useRef(null)
  const inputRef = useRef(null)

  const inlineHint = getInlineSyntaxHint(input)

  // Dynamic autocomplete matching input prefix against registry commands or fallback list
  const availableCommands = registry.size > 0 ? [...registry.keys()] : [
    'SET', 'GET', 'DEL', 'EXPIRE', 'HSET', 'HGET', 'HDEL', 'LPUSH', 'RPOP', 'ZADD', 'PUBLISH', 'SUBSCRIBE', 'CLUSTER', 'KEYS', 'FLUSHALL'
  ]

  const firstInputWord = input.trim().split(' ')[0].toUpperCase()
  const suggestions = (terminalAutocomplete && input.trim().length > 0)
    ? availableCommands
        .filter((cmd) => cmd.startsWith(firstInputWord))
        .slice(0, 8)
        .map((cmd) => {
          const cmdFn = registry.get(cmd)
          return cmdFn?.syntax || cmd
        })
    : []

  const handleSelectSuggestion = (s) => {
    const cmdOnly = s.split(' ')[0]
    setInput(cmdOnly + ' ')
    inputRef.current?.focus()
  }

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [output])

  const runCommand = (event) => {
    event.preventDefault()
    const line = input.trim()
    if (!line) return

    const reply = onSubmit ? onSubmit(line) : engine.execute(line)

    // Check for active incident impact to provide immediate feedback
    let incidentFeedback = null
    if (activeIncident && activeIncident.status !== 'resolved') {
      const lineUpper = line.toUpperCase()
      const targetKeyUpper = activeIncident.targetKey ? activeIncident.targetKey.toUpperCase() : ''
      const isTargetAffected = targetKeyUpper ? lineUpper.includes(targetKeyUpper) : true

      incidentFeedback = {
        title: activeIncident.title || 'ACTIVE INCIDENT',
        targetKey: activeIncident.targetKey,
        affected: isTargetAffected,
        message: isTargetAffected
          ? `Command targeted incident key "${activeIncident.targetKey || 'active'}". Active incident state updated!`
          : `Incident "${activeIncident.title || 'Incident Response'}" active. Execution state recorded.`,
      }
    }

    setOutput((prev) => [...prev, { line, reply, incidentFeedback }])
    // Skip consecutive duplicates
    setCmdHistory((prev) => (prev[prev.length - 1] === line ? prev : [...prev, line]))
    setCmdIndex(-1)
    setDraft('')
    setInput('')
    onExecute?.(line, reply)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Tab' && suggestions.length > 0) {
      event.preventDefault()
      handleSelectSuggestion(suggestions[0])
      return
    }
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
      event.preventDefault()
      setOutput([])
    }
  }

  const handleChange = (event) => {
    setInput(event.target.value)
    if (cmdIndex !== -1) setCmdIndex(-1)
  }

  return (
    <div className="panel scanlines relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-edge px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber" />
          <span className="h-2.5 w-2.5 rounded-full bg-green" />
          <span className="ml-2 text-xs tracking-widest text-dim">redis-cli · redis-quest</span>
        </div>
        {onCloseDrawer && (
          <button
            type="button"
            onClick={onCloseDrawer}
            aria-label="Close terminal drawer"
            className="text-xs text-dim hover:text-fg px-1 py-0.5 rounded hover:bg-panel2 transition-colors font-mono"
          >
            ✕ HIDE (~)
          </button>
        )}
      </div>

      <div className="terminal-output min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {output.length === 0 && (
          <p className="text-dim">
            Welcome to Redis Quest. Try{' '}
            <span className="text-cyan">SET name &quot;Ada&quot;</span> then{' '}
            <span className="text-cyan">GET name</span>. Press{' '}
            <span className="text-amber">↑/↓</span> to recall commands.
          </p>
        )}
        {output.map(({ line, reply, incidentFeedback }, index) => (
          <div key={index} className="mb-3">
            <div className="whitespace-pre-wrap break-words">
              <span className="select-none text-green">&gt;</span> <HighlightedLine line={line} />
            </div>
            <div className="whitespace-pre-wrap break-words pl-4">
              <ReplyView reply={reply} />
            </div>
            {incidentFeedback && (
              <div
                className="mt-1.5 p-2 rounded border border-amber-500/40 bg-amber-950/30 text-amber-300 font-mono text-xs flex items-center justify-between shadow-glow animate-pulse ml-4"
                data-testid="incident-feedback"
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wider">
                    INCIDENT FEEDBACK
                  </span>
                  <span>{incidentFeedback.message}</span>
                </div>
                <span className="text-[10px] text-amber-400/80 font-bold uppercase">
                  {incidentFeedback.affected ? '⚡ TARGET MUTATED' : 'STATE RECORDED'}
                </span>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Autocomplete Suggestions Popup */}
      {suggestions.length > 0 && input.trim().length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-1 p-2 bg-slate-900 border border-cyan/40 rounded-lg shadow-xl z-30 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto" data-testid="autocomplete-popup">
          <div className="w-full text-[9px] font-bold text-cyan uppercase tracking-wider mb-1">
            Auto-Completion Suggestions:
          </div>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSuggestion(s)}
              className="px-2 py-1 bg-slate-800 hover:bg-cyan/20 border border-slate-700 hover:border-cyan/50 text-cyan text-xs font-mono rounded transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

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
            {inlineHint && (
              <span className="text-dim/40 font-mono select-none" data-testid="inline-syntax-hint">
                {inlineHint}
              </span>
            )}
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
