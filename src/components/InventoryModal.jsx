// src/components/InventoryModal.jsx
import { useEffect } from 'react'
import { soundEngine } from '../audio/SoundEngine.js'

export default function InventoryModal({ isOpen, onClose }) {
  useEffect(() => {
    if (isOpen) {
        soundEngine.playSFX('shuffle')
    }
  }, [isOpen])

  if (!isOpen) return null
  
  // mock gems
  const gems = [
    { name: 'SET', desc: 'Sets a key-value pair.', cost: 10, category: 'string' },
    { name: 'GET', desc: 'Gets a value.', cost: 5, category: 'string' },
    { name: 'DEL', desc: 'Deletes a key.', cost: 15, category: 'core' },
    { name: 'EXPIRE', desc: 'Sets TTL on a key.', cost: 20, category: 'core' },
  ]
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border-2 border-cyan/50 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto shadow-[0_0_20px_rgba(34,211,238,0.2)]">
        <div className="flex justify-between items-center mb-6 border-b border-cyan/30 pb-4">
            <h2 className="text-3xl font-bold text-cyan tracking-widest">🎒 INVENTORY DECK</h2>
            <button onClick={onClose} className="text-cyan hover:text-white text-xl">✕</button>
        </div>
        <div className="grid grid-cols-4 gap-6">
           {gems.map((gem, i) => (
             <div key={i} className="p-4 bg-slate-800 border border-slate-600 rounded flex flex-col gap-2 hover:border-cyan transition-colors">
                <div className="font-bold text-amber-500 text-lg">{gem.name}</div>
                <div className="text-xs text-slate-300 flex-1">{gem.desc}</div>
                <div className="flex justify-between items-center text-[10px] text-cyan">
                    <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">{gem.category}</span>
                    <span>Cost: {gem.cost}</span>
                </div>
                <button className="bg-cyan/20 text-cyan text-xs py-1 rounded hover:bg-cyan/40 mt-2">Equip</button>
             </div>
           ))}
        </div>
      </div>
    </div>
  )
}
