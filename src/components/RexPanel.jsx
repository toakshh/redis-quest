import { useEffect, useState, useRef } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { eventBus, EVENTS } from '../engine/EventBus.js'

const REX_PERSONALITIES = {
  encouraging: {
    name: 'Encouraging',
    emoji: '🤖',
    color: '#22d3ee',
    responses: {
      greeting: [
        'Hello there! Ready to learn some Redis?',
        'Welcome back! The database awaits.',
        'REX online. How can I help?',
      ],
      error: [
        'Don\'t worry, errors are how we learn!',
        'Every expert was once a beginner. Try again!',
        'That\'s okay — Redis is picky about syntax.',
        'Let\'s figure this out together.',
      ],
      success: [
        'Excellent! That command executed perfectly.',
        'Great job! You\'re getting the hang of it.',
        'Nicely done! On to the next challenge.',
      ],
      hint: [
        'Here\'s a tip: ',
        'Pro tip: ',
        'Remember: ',
      ],
      levelup: [
        'LEVEL UP! Your Redis powers grow!',
        'Congratulations on reaching the next level!',
        'New skills unlocked. The journey continues.',
      ],
      achievement: [
        'Achievement unlocked! Your dedication shows.',
        'Another trophy for the collection!',
        'Well earned! Keep pushing forward.',
      ],
      idle: [
        'Type a command to get started...',
        'The keyspace is quiet. Too quiet.',
        'Waiting for input... *whirs*',
        'Did you know? Redis stands for REmote DIctionary Server.',
      ],
    },
  },
  technical: {
    name: 'Technical',
    emoji: '🔧',
    color: '#a78bfa',
    responses: {
      greeting: [
        'System initialized. Awaiting commands.',
        'REX v4.0 ready. Connection established.',
        'Terminal active. Input accepted.',
      ],
      error: [
        'ERROR: Command syntax invalid. Refer to documentation.',
        'EXECUTION FAILED: Check argument types and count.',
        'INVALID OPERATION: Key type mismatch detected.',
      ],
      success: [
        'OK: Command executed successfully.',
        'COMPLETED: Operation returned expected result.',
        'SUCCESS: State mutation confirmed.',
      ],
      hint: [
        'DOCUMENTATION: ',
        'SYNTAX: ',
        'REFERENCE: ',
      ],
      levelup: [
        'LEVEL INCREMENTED: New permissions granted.',
        'EXPERIENCE THRESHOLD REACHED: Skill tree expanded.',
        'RANK ADVANCED: Additional commands available.',
      ],
      achievement: [
        'ACHIEVEMENT RECORDED: Criteria satisfied.',
        'MILESTONE LOGGED: Progress tracked.',
        'BADGE AWARDED: Conditions met.',
      ],
      idle: [
        'IDLE: No commands in queue.',
        'STANDBY: Monitoring keyspace...',
        'PROCESSING: Background tasks nominal.',
      ],
    },
  },
  minimal: {
    name: 'Minimal',
    emoji: '📦',
    color: '#64748b',
    responses: {
      greeting: ['Ready.', 'Online.', 'Standing by.'],
      error: ['Error.', 'Failed.', 'Invalid.'],
      success: ['OK.', 'Done.', 'Success.'],
      hint: ['Hint: ', 'Note: ', 'Tip: '],
      levelup: ['Level up.', 'Advanced.', 'Progress.'],
      achievement: ['Unlocked.', 'Achieved.', 'Recorded.'],
      idle: ['Waiting...', 'Idle.', 'No input.'],
    },
  },
}

function RexAvatar({ personality, speaking, variant }) {
  const colors = {
    cube: '#22d3ee',
    sphere: '#34d399',
    pyramid: '#fbbf24',
    octahedron: '#a78bfa',
    dodecahedron: '#fb7185',
    icosahedron: '#fff',
    tesseract: '#22d3ee',
  }

  const geometry = variant?.geometry || 'cube'
  const color = variant?.color || colors[geometry] || '#22d3ee'

  return (
    <div className="relative w-20 h-20 flex items-center justify-center mx-auto">
      {/* Outer glow when speaking */}
      {speaking && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
            transform: 'scale(1.5)',
          }}
        />
      )}

      {/* Geometry */}
      <div
        className={`relative transition-all duration-300 ${speaking ? 'animate-bounce-subtle' : ''}`}
        style={{
          width: '64px',
          height: '64px',
          transformStyle: 'preserve-3d',
          animation: 'rex-rotate 20s linear infinite',
        }}
      >
        {geometry === 'cube' && (
          <div className="w-full h-full" style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(-15deg) rotateY(20deg)',
          }}>
            <div className="absolute w-full h-full bg-opacity-30 border-2" style={{
              backgroundColor: color, borderColor: color,
              transform: 'translateZ(16px)',
            }} />
            <div className="absolute w-full h-full bg-opacity-30 border-2" style={{
              backgroundColor: color, borderColor: color,
              transform: 'translateZ(-16px) rotateY(180deg)',
            }} />
            <div className="absolute w-full h-8 bg-opacity-30 border-2" style={{
              backgroundColor: color, borderColor: color,
              transform: 'rotateY(90deg) translateZ(16px)',
            }} />
            <div className="absolute w-full h-8 bg-opacity-30 border-2" style={{
              backgroundColor: color, borderColor: color,
              transform: 'rotateY(-90deg) translateZ(16px)',
            }} />
            <div className="absolute w-8 h-full bg-opacity-30 border-2" style={{
              backgroundColor: color, borderColor: color,
              transform: 'rotateX(90deg) translateZ(16px)',
            }} />
            <div className="absolute w-8 h-full bg-opacity-30 border-2" style={{
              backgroundColor: color, borderColor: color,
              transform: 'rotateX(-90deg) translateZ(16px)',
            }} />
          </div>
        )}
        {geometry === 'sphere' && (
          <div className="w-full h-full rounded-full bg-opacity-30 border-4 flex items-center justify-center" style={{
            backgroundColor: color, borderColor: color,
            boxShadow: `inset 0 0 20px ${color}80, 0 0 30px ${color}40`,
          }}>
            <div className="w-1/2 h-1/2 rounded-full bg-opacity-50" style={{ backgroundColor: color }} />
          </div>
        )}
        {geometry === 'pyramid' && (
          <div className="w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-20deg) rotateY(20deg)' }}>
            <div className="absolute" style={{
              width: 0, height: 0,
              borderLeft: '32px solid transparent',
              borderRight: '32px solid transparent',
              borderBottom: '45px solid',
              borderBottomColor: color + '60',
              borderBottomStyle: 'solid',
              filter: 'drop-shadow(0 0 10px ' + color + ')',
            }} />
          </div>
        )}
        {geometry === 'octahedron' && (
          <div className="w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-20deg) rotateY(20deg)' }}>
            <div className="absolute w-0 h-0" style={{
              borderLeft: '32px solid transparent',
              borderRight: '32px solid transparent',
              borderBottom: '45px solid',
              borderBottomColor: color + '60',
              filter: 'drop-shadow(0 0 10px ' + color + ')',
            }} />
            <div className="absolute w-0 h-0" style={{
              top: 'auto', bottom: 0,
              borderLeft: '32px solid transparent',
              borderRight: '32px solid transparent',
              borderTop: '45px solid',
              borderTopColor: color + '60',
              filter: 'drop-shadow(0 0 10px ' + color + ')',
            }} />
          </div>
        )}
        {['dodecahedron', 'icosahedron'].includes(geometry) && (
          <div className="w-full h-full rounded-[30%] flex items-center justify-center" style={{
            background: `radial-gradient(circle at 30% 30%, ${color}60, ${color}20)`,
            border: `2px solid ${color}`,
            boxShadow: `0 0 20px ${color}40`,
          }}>
            <div className="text-3xl">{geometry === 'dodecahedron' ? '🔮' : '🎲'}</div>
          </div>
        )}
        {geometry === 'tesseract' && (
          <div className="w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-15deg) rotateY(20deg)' }}>
            {/* Inner cube */}
            <div className="absolute w-1/2 h-1/2" style={{
              top: '25%', left: '25%',
              border: `2px solid ${color}80`,
              boxShadow: `0 0 15px ${color}40`,
            }} />
            {/* Outer cube edges */}
            <div className="absolute w-full h-full border-2" style={{
              borderColor: color + '60',
              boxShadow: `0 0 20px ${color}30`,
            }} />
            {/* Connecting lines */}
            <div className="absolute inset-0" style={{
              background: `linear-gradient(45deg, transparent 48%, ${color}30 50%, transparent 52%)`,
              maskImage: `conic-gradient(from 45deg, transparent 0deg, transparent 90deg, ${color}30 90deg, ${color}30 180deg, transparent 180deg, transparent 270deg, ${color}30 270deg, ${color}30 360deg)`,
            }} />
          </div>
        )}
      </div>

      {/* Personality indicator */}
      <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs" style={{ borderColor: color, backgroundColor: 'var(--panel)' }}>
        {REX_PERSONALITIES[personality]?.emoji || '🤖'}
      </div>
    </div>
  )
}

function MessageBubble({ message, type, personality }) {
  const personalityData = REX_PERSONALITIES[personality]
  const color = personalityData?.color || '#22d3ee'

  const typeStyles = {
    error: { bg: 'rgba(251, 113, 133, 0.15)', border: 'rgba(251, 113, 133, 0.4)', icon: '⚠️', titleColor: '#fb7185' },
    success: { bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.4)', icon: '✅', titleColor: '#34d399' },
    hint: { bg: 'rgba(34, 211, 238, 0.15)', border: 'rgba(34, 211, 238, 0.4)', icon: '💡', titleColor: '#22d3ee' },
    achievement: { bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.4)', icon: '🏆', titleColor: '#a78bfa' },
    levelup: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.4)', icon: '⭐', titleColor: '#fbbf24' },
    region: { bg: 'rgba(34, 211, 238, 0.15)', border: 'rgba(34, 211, 238, 0.4)', icon: '🌟', titleColor: '#22d3ee' },
    skill: { bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.4)', icon: '⭐', titleColor: '#a78bfa' },
    default: { bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.4)', icon: '🤖', titleColor: '#64748b' },
  }

  const style = typeStyles[type] || typeStyles.default

  return (
    <div className="animate-slideUp flex flex-col gap-1" style={{ borderLeft: `3px solid ${style.border}` }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{style.icon}</span>
        <span className="font-bold text-sm" style={{ color: style.titleColor }}>
          {message.title || 'REX'}
        </span>
        {message.xp && (
          <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold text-amber bg-amber/10 border border-amber/30">
            +{message.xp} XP
          </span>
        )}
        {message.rarity && (
          <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold text-dim" style={{ color: style.titleColor }}>
            {message.rarity.toUpperCase()}
          </span>
        )}
      </div>
      <div className="ml-6 text-sm text-fg leading-relaxed">
        {message.message}
      </div>
      {message.hint && (
        <div className="ml-6 text-[10px] italic" style={{ color: style.titleColor }}>
          {message.hint}
        </div>
      )}
      {message.command && (
        <div className="ml-6 mt-1 px-2 py-1 rounded bg-panel border border-edge font-mono text-[10px] text-dim">
          {message.command} {message.args?.join(' ') || ''}
        </div>
      )}
    </div>
  )
}

export default function RexPanel({ className = '' }) {
  const [messages, setMessages] = useState([])
  const [personality, setPersonality] = useState('encouraging')
  const [speaking, setSpeaking] = useState(false)
  const [variant, setVariant] = useState({ geometry: 'cube', color: '#22d3ee' })
  const messagesEndRef = useRef(null)
  const { equippedCosmetic } = useGameStore()

  // Get REX variant from cosmetic system
  useEffect(() => {
    const rexCosmetic = equippedCosmetic?.rexVariant
    if (rexCosmetic) {
      // We'd need to import cosmeticSystem here or get from store
      // For now use a default
    }
  }, [equippedCosmetic])

  // Listen for REX feedback events
  useEffect(() => {
    const handleFeedback = (data) => {
      const personalityData = REX_PERSONALITIES[personality]

      let newMessage = { ...data, timestamp: Date.now() }

      // Add personality-specific flavor
      if (data.type === 'error' && data.consecutiveErrors > 2) {
        const frustrated = personalityData.responses.error[Math.floor(Math.random() * personalityData.responses.error.length)]
        newMessage = {
          ...newMessage,
          message: `${frustrated} ${data.message}`,
        }
      }

      setMessages(prev => [...prev.slice(-9), newMessage]) // Keep last 10
      setSpeaking(true)
      setTimeout(() => setSpeaking(false), 3000)
    }

    eventBus.on('rex:feedback', handleFeedback)

    // Initial greeting
    const personalityData = REX_PERSONALITIES[personality]
    const greeting = personalityData.responses.greeting[0]
    setMessages([{ type: 'default', title: 'REX', message: greeting, timestamp: Date.now() }])

    return () => {
      eventBus.off('rex:feedback', handleFeedback)
    }
  }, [personality])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages])

  const handlePersonalityChange = (newPersonality) => {
    setPersonality(newPersonality)
    const personalityData = REX_PERSONALITIES[newPersonality]
    const greeting = personalityData.responses.greeting[0]
    setMessages(prev => [...prev, { type: 'default', title: 'REX', message: greeting, timestamp: Date.now() }])
  }

  const clearMessages = () => {
    setMessages([])
  }

  return (
    <div className={`panel flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="border-b border-edge p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <h2 className="text-sm font-bold tracking-widest text-fg">REX COMPANION</h2>
            <p className="text-[9px] tracking-[0.2em] text-dim">Your Redis learning assistant</p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearMessages}
          className="px-2 py-1 rounded text-[10px] text-dim hover:text-fg hover:bg-panel2 transition-colors"
          title="Clear messages"
        >
          🗑️
        </button>
      </div>

      {/* REX Avatar */}
      <div className="p-4 flex-shrink-0">
        <RexAvatar personality={personality} speaking={speaking} variant={variant} />
        <div className="mt-3 text-center">
          <select
            value={personality}
            onChange={e => handlePersonalityChange(e.target.value)}
            className="px-3 py-1.5 rounded bg-panel border border-edge text-fg text-[10px] focus:border-cyan focus:outline-none mx-auto"
          >
            {Object.entries(REX_PERSONALITIES).map(([key, data]) => (
              <option key={key} value={key}>
                {data.emoji} {data.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dim">
            <span className="text-3xl mb-2">💬</span>
            <p className="text-sm text-center">No messages yet. Execute a command!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <MessageBubble key={index} message={msg} type={msg.type} personality={personality} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="border-t border-edge p-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const personalityData = REX_PERSONALITIES[personality]
            const hint = personalityData.responses.hint[0] + 'Try HELP for available commands.'
            setMessages(prev => [...prev, { type: 'hint', title: 'REX', message: hint, hint: 'Type HELP or HELP <command>', timestamp: Date.now() }])
            setSpeaking(true)
            setTimeout(() => setSpeaking(false), 2000)
          }}
          className="flex-1 min-w-[120px] px-3 py-2 rounded bg-cyan/10 border border-cyan/30 text-cyan text-[10px] font-medium hover:bg-cyan/20 transition-colors"
        >
          💡 Get Hint
        </button>
        <button
          type="button"
          onClick={() => {
            const personalityData = REX_PERSONALITIES[personality]
            const msg = personalityData.responses.idle[Math.floor(Math.random() * personalityData.responses.idle.length)]
            setMessages(prev => [...prev, { type: 'default', title: 'REX', message: msg, timestamp: Date.now() }])
            setSpeaking(true)
            setTimeout(() => setSpeaking(false), 1500)
          }}
          className="flex-1 min-w-[120px] px-3 py-2 rounded bg-panel border border-edge text-fg text-[10px] font-medium hover:border-cyan/50 transition-colors"
        >
          💬 Chat
        </button>
      </div>
    </div>
  )
}