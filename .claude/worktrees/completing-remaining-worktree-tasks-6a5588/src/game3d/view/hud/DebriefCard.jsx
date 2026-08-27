import React, { useEffect } from 'react'
import { useSim } from '../SimProvider.jsx'

export default function DebriefCard({ debriefData, onDismiss }) {
  const { world } = useSim()

  useEffect(() => {
    let originalTimeScale = 1
    if (world) {
      originalTimeScale = world.timeScale
      world.timeScale = 0
    }
    return () => {
      if (world) world.timeScale = originalTimeScale > 0 ? originalTimeScale : 1
    }
  }, [world])

  if (!debriefData) return null

  return (
    <div
      data-testid="debrief-card"
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(2px)' // visual comfort
      }}
    >
      <div
        style={{
          width: '600px',
          backgroundColor: '#111',
          border: '1px solid #333',
          padding: '30px',
          color: '#eee',
          fontFamily: 'monospace',
          lineHeight: '1.4'
        }}
      >
        <h3 style={{color: '#888', marginTop: 0}}>WHAT JUST HAPPENED</h3>
        <p data-testid="f1">{debriefData.whatHappened}</p>

        <h3 style={{color: '#888'}}>WHAT YOU DID</h3>
        <p data-testid="f2">{debriefData.whatYouDid}</p>

        <h3 style={{color: '#888'}}>IN THE REAL WORLD THIS IS CALLED</h3>
        <p data-testid="f3">{debriefData.realWorldName}</p>

        <h3 style={{color: '#888'}}>THE ACTUAL COMMAND</h3>
        <pre data-testid="f4" style={{color: 'lime', background: '#000', padding: '10px'}}>{debriefData.actualCommand}</pre>

        <h3 style={{color: '#888'}}>WHEN YOU WOULD USE IT AT WORK</h3>
        <p data-testid="f5">{debriefData.whenToUse}</p>

        <h3 style={{color: '#888'}}>IF YOU GET IT WRONG</h3>
        <p data-testid="f6">{debriefData.ifWrong}</p>

        <button
          data-testid="btn-dismiss"
          onClick={onDismiss}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            background: '#ccc',
            color: '#000',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  )
}
