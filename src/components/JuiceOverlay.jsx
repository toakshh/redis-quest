import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { juiceSystem } from '../systems/JuiceSystem.js'

export default function JuiceOverlay({ className = '' }) {
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(null)
  const lastTimeRef = useRef(0)
  const { getJuiceSystem } = useGameStore()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set up canvas size
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.scale(dpr, dpr)
    }

    resize()
    window.addEventListener('resize', resize)

    // Animation loop
    const animate = (timestamp) => {
      const deltaMs = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      // Update juice system
      const shouldSkipUpdate = juiceSystem.update(deltaMs)

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))

      // Save context for shake
      ctx.save()

      // Render juice effects
      const displayWidth = canvas.width / (window.devicePixelRatio || 1)
      const displayHeight = canvas.height / (window.devicePixelRatio || 1)
      juiceSystem.render(ctx, displayWidth, displayHeight)

      ctx.restore()

      // Apply color grading via CSS filter on the canvas
      const filter = juiceSystem.getColorGradeFilter()
      if (filter !== 'saturate(1) contrast(1) brightness(1) hue-rotate(0deg)') {
        canvas.style.filter = filter
      } else {
        canvas.style.filter = 'none'
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Also listen for theme changes to re-apply CSS variables
  useEffect(() => {
    // Apply theme CSS variables from cosmetic system
    const applyTheme = () => {
      const juice = getJuiceSystem ? getJuiceSystem() : null
      if (juice) {
        // The cosmetic system already applies theme to document.documentElement
        // This overlay just needs to render particles and effects
      }
    }
    applyTheme()
  }, [getJuiceSystem])

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-40 ${className}`}
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  )
}