import React, { useState, useEffect, useRef } from 'react'
import { FEEL } from '../../config/feel.js'

export default function CardComposer({ world, onFire }) {
  const [isOpen, setIsOpen] = useState(false)
  const [commandTokens, setCommandTokens] = useState(['SET', 'key', 'value']) // Dummy default for testing interaction

  const onFireRef = useRef(onFire)
  onFireRef.current = onFire
  const commandTokensRef = useRef(commandTokens)
  commandTokensRef.current = commandTokens

  useEffect(() => {
    if (world) {
      if (isOpen) {
        world.timeScale = FEEL.ui.cardComposerSlowFactor
      } else {
        world.timeScale = 1
      }
    }
    return () => {
      if (world) {
        world.timeScale = 1
      }
    }
  }, [world, isOpen])

  useEffect(() => {
    function handleMouseDown(e) {
      if (e.button === 2) { // RMB
        setIsOpen(true)
      }
    }

    function handleMouseUp(e) {
      if (e.button === 2) { // RMB
        if (isOpen) {
          if (onFireRef.current) {
            onFireRef.current(commandTokensRef.current.join(' '))
          }
        }
        setIsOpen(false)
      }
    }

    // Prevents context menu from interrupting RMB hold
    function handleContextMenu(e) {
      e.preventDefault()
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('contextmenu', handleContextMenu)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Radial menu logic would go here. For now, we fulfill the contract of displaying assembled string.
  return (
    <div
      data-testid="card-composer"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '50%',
          width: '300px',
          height: '300px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}
      >
        <span data-testid="assembled-string">{commandTokens.join(' ')}</span>
      </div>
    </div>
  )
}
