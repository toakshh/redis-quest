// src/components/VictoryModal.jsx
import { useEffect } from 'react'
import { soundEngine } from '../audio/SoundEngine.js'

export default function VictoryModal({ isOpen, onProceed }) {
  useEffect(() => {
    if (isOpen) {
        soundEngine.playSFX('victory')
    }
  }, [isOpen])

  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-900/50 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-950 border-4 border-emerald-500 rounded-2xl p-8 w-full max-w-lg text-center shadow-[0_0_50px_rgba(16,185,129,0.3)]">
        <div className="text-6xl mb-6">🏆</div>
        <h2 className="text-4xl font-black text-emerald-400 tracking-widest mb-4">REGION CLEARED</h2>
        <p className="text-slate-300 mb-8 text-lg">Fantastic work, Hero! The Redis node is secure.</p>
        <button 
            onClick={() => {soundEngine.playSFX('nav'); onProceed()}}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl text-xl transition-all shadow-lg hover:scale-105"
        >
            PROCEED TO NEXT REGION
        </button>
      </div>
    </div>
  )
}
