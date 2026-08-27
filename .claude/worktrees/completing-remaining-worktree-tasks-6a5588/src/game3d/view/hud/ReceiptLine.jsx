import React, { useState, useEffect } from 'react'

const DEFAULT_VISIBLE_MS = 500 // Fallback if FEEL isn't loaded

export default function ReceiptLine({ physicalText, realText, visibleMs = DEFAULT_VISIBLE_MS }) {
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    setOpacity(1) // reset on text change

    // Start fading out slightly before visibility ends
    const fadeTimer = setTimeout(() => {
      setOpacity(0)
    }, visibleMs - 150)

    return () => clearTimeout(fadeTimer)
  }, [physicalText, realText, visibleMs])

  return (
    <div
      data-testid="receipt-line"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '400px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        pointerEvents: 'none',
        opacity: opacity,
        transition: 'opacity 150ms ease-out'
      }}
    >
      <span data-testid="col-physical">{physicalText}</span>
      <span data-testid="col-real" style={{ color: 'lime' }}>{realText}</span>
    </div>
  )
}
