import React, { useEffect, useState } from 'react'

export default function FieldManualPanel({ world, isOpen, onClose }) {
  const [markdown, setMarkdown] = useState('')

  useEffect(() => {
    let originalTimeScale = 1
    if (isOpen && world) {
      originalTimeScale = world.timeScale
      world.timeScale = 0
      
      // Attempt to export markdown if present
      if (world.teachingLayer && world.teachingLayer.fieldManual) {
        setMarkdown(world.teachingLayer.fieldManual.exportMarkdown())
      } else {
        setMarkdown('# Field Manual\n\nNo records retrieved.')
      }
    }
    return () => {
      if (world && isOpen) {
        world.timeScale = originalTimeScale > 0 ? originalTimeScale : 1
      }
    }
  }, [isOpen, world])

  if (!isOpen) return null

  return (
    <div
      data-testid="field-manual-panel"
      className="absolute inset-0 bg-black/90 z-40 flex items-center justify-center font-mono"
    >
      <div className="bg-[#111] border border-[#333] p-8 max-w-3xl w-full h-[80vh] flex flex-col relative text-white">
        <h2 className="text-[#888] tracking-widest text-lg mb-4 flex justify-between">
          <span>FIELD MANUAL</span>
          <button 
            data-testid="btn-close-manual"
            onClick={onClose} 
            className="text-white bg-[#333] px-3 py-1 hover:bg-[#555]"
          >
            CLOSE
          </button>
        </h2>
        
        <div className="flex-1 overflow-y-auto whitespace-pre-wrap leading-relaxed pr-4 text-sm">
          {markdown}
        </div>
      </div>
    </div>
  )
}
