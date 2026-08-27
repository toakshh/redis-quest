import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { createGameWorld } from '../sim/createGameWorld.js'
import { FEEL } from '../config/feel.js'
import Scene from './Scene.jsx'
import Hud from './hud/Hud.jsx'
import CommandConsole from './hud/CommandConsole.jsx'

// The 3D mode's root. Owns the game instance, the pointer-lock state machine,
// and the DOM-side overlays; everything inside the GL canvas lives in Scene.

function formatReply(reply) {
  if (!reply) return { ok: false, text: 'no reply' }
  if (reply.type === 'error') return { ok: false, text: String(reply.value ?? 'error') }
  if (reply.value === null || reply.value === undefined) return { ok: true, text: '(nil)' }
  if (Array.isArray(reply.value)) return { ok: true, text: `(${reply.value.length} items)` }
  return { ok: true, text: String(reply.value) }
}

export default function Game3DRoot({ seed, onExit }) {
  const gameRef = useRef(null)
  if (!gameRef.current) {
    gameRef.current = createGameWorld({ seed })
  }
  const game = gameRef.current

  // `entered` is the player's intent to play; `locked` is whether the browser
  // actually granted pointer lock. Gating the game on `entered` alone means a
  // refused pointer lock degrades to drag-look instead of an unplayable veil.
  const [entered, setEntered] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockRequested, setLockRequested] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [nearTerminal, setNearTerminal] = useState(null)
  const [history, setHistory] = useState([])
  const [lastResult, setLastResult] = useState(null)
  const [outcome, setOutcome] = useState(null) // null | 'dead' | 'won'

  // Dispose exactly once, on real unmount.
  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.dispose()
        gameRef.current = null
      }
    }
  }, [])

  // Command results drive the receipt line and the console log.
  useEffect(() => {
    const off = game.runtime.bus.on('sim:commandResult', ({ intent, reply }) => {
      const formatted = { line: intent.line, ...formatReply(reply) }
      setLastResult(formatted)
      setHistory((h) => [...h.slice(-40), formatted])
    })
    return typeof off === 'function' ? off : undefined
  }, [game])

  // Fade the receipt out so it does not sit on screen forever.
  useEffect(() => {
    if (!lastResult) return
    const t = setTimeout(() => setLastResult(null), 2600)
    return () => clearTimeout(t)
  }, [lastResult])

  // Watch for the run ending. Polled rather than event-driven because the win
  // condition is an objective sweep that has no single triggering moment.
  useEffect(() => {
    const t = setInterval(() => {
      if (outcome) return
      if (game.world.objectivesComplete) setOutcome('won')
      else if (game.world.playerHealth01 <= 0) setOutcome('dead')
    }, 250)
    return () => clearInterval(t)
  }, [game, outcome])

  // Time dilates while the console is open — the player is reading, and this
  // is where the teaching happens, so the room should not kill them for it.
  useEffect(() => {
    const slowed = consoleOpen && outcome === null
    game.world.timeScale = slowed ? FEEL.ui.terminalSlowFactor : 1
  }, [game, consoleOpen, outcome])

  // The console must own the pointer while it is open.
  useEffect(() => {
    setLockRequested(entered && !consoleOpen && outcome === null)
  }, [entered, consoleOpen, outcome])

  const openConsole = useCallback(() => {
    setConsoleOpen(true)
  }, [])

  const closeConsole = useCallback(() => {
    setConsoleOpen(false)
  }, [])

  // Global hotkeys. Bound at the window so they work whether the pointer is
  // locked to the canvas or free over the HUD.
  useEffect(() => {
    function onKeyDown(e) {
      if (outcome) return
      if (e.code === 'KeyE' || e.code === 'KeyT' || e.code === 'Slash') {
        if (!consoleOpen) { e.preventDefault(); openConsole() }
      } else if (e.code === 'Escape') {
        if (consoleOpen) setConsoleOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [consoleOpen, openConsole, outcome])

  const submitCommand = useCallback((line) => {
    game.submitCommand(line)
  }, [game])

  const startPlaying = useCallback(() => {
    if (consoleOpen || outcome) return
    setEntered(true)
  }, [consoleOpen, outcome])

  const restart = useCallback(() => {
    if (gameRef.current) gameRef.current.dispose()
    gameRef.current = createGameWorld({})
    setOutcome(null)
    setHistory([])
    setLastResult(null)
    setConsoleOpen(false)
    setEntered(true)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" onClick={startPlaying}>
      <Canvas
        dpr={[0.6, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ fov: FEEL.camera.fovDefault, near: 0.1, far: 120 }}
        shadows={false}
      >
        <AdaptiveDpr pixelated />
        <Scene
          runtime={game.runtime}
          world={game.world}
          level={game.level}
          active={entered && !consoleOpen && outcome === null}
          locked={locked}
          lockRequested={lockRequested}
          onLockChange={setLocked}
          onNearestTerminal={setNearTerminal}
        />
      </Canvas>

      <Hud
        world={game.world}
        level={game.level}
        nearTerminal={nearTerminal}
        consoleOpen={consoleOpen}
        lastResult={lastResult}
        pointerLocked={locked}
        entered={entered}
      />

      <CommandConsole
        open={consoleOpen && outcome === null}
        onClose={closeConsole}
        onSubmit={submitCommand}
        terminal={nearTerminal}
        history={history}
      />

      {/* Click-to-play veil. Pointer lock cannot be requested without a user
          gesture, so this is a requirement of the platform, not decoration. */}
      {!entered && outcome === null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 font-mono text-center">
          <div className="text-3xl tracking-[0.4em] text-[#4fd8ff]">PROTOCOL ZERO</div>
          <div className="mt-3 max-w-md text-xs leading-relaxed text-white/55">
            Facility NODE-7. Your session key has 90 seconds on it. When it
            expires, so do you. Find a terminal and buy yourself more time.
          </div>
          <div className="mt-6 animate-pulse text-sm tracking-widest text-white/80">
            CLICK TO ENTER
          </div>
          <div className="mt-2 text-[10px] tracking-wider text-white/30">
            headphones recommended · frequent jumpscares
          </div>
        </div>
      )}

      {outcome && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 font-mono text-center">
          <div
            className="text-4xl tracking-[0.35em]"
            style={{ color: outcome === 'won' ? '#6effc0' : '#ff4d4d' }}
          >
            {outcome === 'won' ? 'CONTAINED' : 'SESSION EXPIRED'}
          </div>
          <div className="mt-4 max-w-lg text-xs leading-relaxed text-white/60">
            {outcome === 'won'
              ? 'You cached what was being re-read, and you put a lifetime on a key that had none. That is the whole job.'
              : 'Your key reached its TTL and Redis removed it. Nothing attacked you at the end — you simply stopped existing. Set an expiry you can actually refresh.'}
          </div>
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={restart}
              className="border border-[#4fd8ff]/50 px-5 py-2 text-xs tracking-widest text-[#4fd8ff] transition-colors hover:bg-[#4fd8ff]/10"
            >
              RUN AGAIN
            </button>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="border border-white/25 px-5 py-2 text-xs tracking-widest text-white/60 transition-colors hover:bg-white/10"
              >
                EXIT
              </button>
            )}
          </div>
        </div>
      )}

      {onExit && !outcome && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onExit() }}
          className="absolute bottom-4 right-1/2 translate-x-1/2 border border-white/15 px-3 py-1 text-[10px] tracking-widest text-white/40 transition-colors hover:bg-white/10"
        >
          EXIT
        </button>
      )}
    </div>
  )
}
