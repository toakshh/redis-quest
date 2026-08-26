import React, { useEffect, useState } from 'react'
import { useCombatStore } from '../../store/combatStore'
import { useGameStore } from '../../store/gameStore'
import { ConsequenceEngine } from '../../systems/consequences/ConsequenceEngine'

export default function HUD({ engine }) {
  const hp = useCombatStore(state => state.playerHealth)
  const [shieldActive, setShieldActive] = useState(false)
  const [shieldPower, setShieldPower] = useState(0)
  const [cooldownVal, setCooldownVal] = useState(500)
  const [radarActive, setRadarActive] = useState(false)
  const enemies = useCombatStore(state => state.enemies)

  useEffect(() => {
    if (!engine) return
    const ce = new ConsequenceEngine({ engine })

    const updateCooldown = () => {
       if (engine.store.has('weapon:cooldown')) {
          setCooldownVal(Number(engine.store.get('weapon:cooldown').value) || 500)
       } else {
          setCooldownVal(500)
       }

       // check pubsub radar
       if (engine.pubsub) {
          const channels = engine.pubsub.subscriptions
          setRadarActive(channels.has('radar') || channels.has('radar:events'))
       }
    }
    updateCooldown()

    const unsubEngine = engine.on('change', () => {
       updateCooldown()
    })

    const unsub = ce.onConsequence((payload) => {
      if (payload.entity === 'shield') {
        setShieldActive(payload.state === 'activated')
        if (payload.state === 'activated' && payload.shield) {
          setShieldPower(payload.shield.power || 100)
        } else {
          setShieldPower(0)
        }
      }
    })

    return () => {
      unsub()
      unsubEngine()
      ce.detachEngine()
    }
  }, [engine])

  return (
    <>
    <div className="absolute bottom-10 left-10 pointer-events-none select-none font-mono text-cyan-400">
      <div className="flex flex-col gap-2">
        <div className="bg-black/50 p-4 border border-cyan-400/30 rounded">
          <div className="text-sm opacity-70">INTEGRITY</div>
          <div className="text-2xl font-black text-rose-500 glitch">{Math.max(0, hp || 100)}%</div>
          <div className="w-48 h-2 bg-gray-900 mt-2 rounded overflow-hidden">
            <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${Math.max(0, hp || 100)}%` }} />
          </div>
        </div>

        <div className={`p-4 border rounded transition-all duration-300 ${shieldActive ? 'bg-cyan-900/50 border-cyan-400' : 'bg-black/50 border-gray-800'}`}>
          <div className="text-sm opacity-70">CACHE SHIELD (TTL)</div>
          <div className={`text-2xl font-black ${shieldActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-gray-600'}`}>
            {shieldActive ? `${shieldPower} ACTIVE` : 'OFFLINE'}
          </div>
          <div className="w-48 h-2 bg-gray-900 mt-2 rounded overflow-hidden">
            <div className={`h-full transition-all duration-300 ${shieldActive ? 'bg-cyan-400' : 'bg-gray-600'}`} style={{ width: shieldActive ? '100%' : '0%' }} />
          </div>
        </div>

        <div className="bg-black/50 p-4 border border-cyan-400/30 rounded mt-4">
          <div className="text-sm opacity-70">WEAPON RATE LIMITING (weapon:cooldown)</div>
          <div className="text-xl font-black text-cyan-400">{cooldownVal}ms</div>
          <div className="text-xs opacity-50 mt-1">LOWER = FASTER (SET weapon:cooldown 100)</div>
        </div>
      </div>
    </div>

    {/* RADAR UI in top right */}
    <div className="absolute top-10 right-10 pointer-events-none select-none font-mono">
      <div className={`p-4 border rounded transition-all duration-300 w-48 ${radarActive ? 'bg-black/80 border-cyan-400' : 'bg-black/80 border-gray-800'}`}>
         <div className="text-sm opacity-70 mb-2">PUB/SUB: RADAR</div>
         {!radarActive ? (
            <div className="text-gray-500 text-xs">OFFLINE<br/>SUBSCRIBE radar</div>
         ) : (
            <div className="text-cyan-400">
               <div className="mb-2">ACTIVE THREATS: {enemies.length}</div>
               <div className="relative w-full h-32 bg-gray-900 rounded-full border border-cyan-400/50 overflow-hidden flex items-center justify-center">
                  <div className="absolute w-full h-full border-2 border-cyan-400/20 rounded-full animate-ping"></div>
                  {/* Radar line scanner */}
                  <div className="absolute w-1/2 h-0.5 bg-cyan-400 left-1/2 origin-left animate-spin" style={{ animationDuration: '2s', animationTimingFunction: 'linear' }}></div>

                  {/* Blips */}
                  {enemies.map((e, idx) => (
                    <div key={idx} className="absolute w-2 h-2 bg-rose-500 rounded-full animate-pulse"
                         style={{
                            // simplistic mapping
                            left: `${50 + (e.position[0]/50)*50}%`,
                            top: `${50 + (e.position[2]/50)*50}%`
                         }}
                    />
                  ))}
               </div>
            </div>
         )}
      </div>
    </div>
    </>
  )
}

