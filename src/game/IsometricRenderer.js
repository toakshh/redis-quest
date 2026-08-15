// Isometric projection & rendering math utility functions

export const TILE_WIDTH = 64
export const TILE_HEIGHT = 32

/** Convert 2D Grid / World space (gridX, gridY) or (x, y) to Isometric Screen space (isoX, isoY) */
export function gridToIso(gx, gy) {
  const isoX = (gx - gy) * (TILE_WIDTH / 2)
  const isoY = (gx + gy) * (TILE_HEIGHT / 2)
  return { x: isoX, y: isoY }
}

/** Convert Isometric Screen space back to 2D Grid space (gx, gy) */
export function isoToGrid(isoX, isoY) {
  const gx = (isoX / (TILE_WIDTH / 2) + isoY / (TILE_HEIGHT / 2)) / 2
  const gy = (isoY / (TILE_HEIGHT / 2) - isoX / (TILE_WIDTH / 2)) / 2
  return { x: gx, y: gy }
}

/** Draw an isometric diamond tile on Canvas 2D context */
export function drawIsoTile(ctx, x, y, width = TILE_WIDTH, height = TILE_HEIGHT, fillColor = '#334155', strokeColor = '#475569') {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x, y - height / 2)
  ctx.lineTo(x + width / 2, y)
  ctx.lineTo(x, y + height / 2)
  ctx.lineTo(x - width / 2, y)
  ctx.closePath()

  if (fillColor) {
    ctx.fillStyle = fillColor
    ctx.fill()
  }

  if (strokeColor) {
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.restore()
}

/** Draw an isometric 3D block with top, left, and right faces */
export function drawIsoBlock(ctx, x, y, width = TILE_WIDTH, height = TILE_HEIGHT, depth = 20, topColor = '#38bdf8', leftColor = '#0284c7', rightColor = '#0369a1') {
  ctx.save()

  // Top face
  ctx.beginPath()
  ctx.moveTo(x, y - height / 2 - depth)
  ctx.lineTo(x + width / 2, y - depth)
  ctx.lineTo(x, y + height / 2 - depth)
  ctx.lineTo(x - width / 2, y - depth)
  ctx.closePath()
  ctx.fillStyle = topColor
  ctx.fill()
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // Left face
  ctx.beginPath()
  ctx.moveTo(x - width / 2, y - depth)
  ctx.lineTo(x, y + height / 2 - depth)
  ctx.lineTo(x, y + height / 2)
  ctx.lineTo(x - width / 2, y)
  ctx.closePath()
  ctx.fillStyle = leftColor
  ctx.fill()
  ctx.stroke()

  // Right face
  ctx.beginPath()
  ctx.moveTo(x, y + height / 2 - depth)
  ctx.lineTo(x + width / 2, y - depth)
  ctx.lineTo(x + width / 2, y)
  ctx.lineTo(x, y + height / 2)
  ctx.closePath()
  ctx.fillStyle = rightColor
  ctx.fill()
  ctx.stroke()

  ctx.restore()
}

/** Draw dynamic API Gate: flickering unstable gate when corrupted, solid locked barrier when locked */
export function drawApiGate(ctx, x, y, state = 'corrupted', timeMs = Date.now()) {
  ctx.save()

  const pillarHeight = 44
  const pillarWidth = 16
  const barrierSpan = 60

  if (state === 'locked') {
    // Solid locked barrier (SET api:gate:mode locked)
    // Left Pillar
    drawIsoBlock(ctx, x - barrierSpan / 2, y, pillarWidth, 10, pillarHeight, '#ef4444', '#b91c1c', '#7f1d1d')
    // Right Pillar
    drawIsoBlock(ctx, x + barrierSpan / 2, y, pillarWidth, 10, pillarHeight, '#ef4444', '#b91c1c', '#7f1d1d')

    // Solid Force Field Laser Wall
    ctx.fillStyle = 'rgba(239, 68, 68, 0.65)'
    ctx.strokeStyle = '#f87171'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.rect(x - barrierSpan / 2, y - pillarHeight - 6, barrierSpan, pillarHeight)
    ctx.fill()
    ctx.stroke()

    // Laser Beam Grid Lines
    ctx.strokeStyle = 'rgba(254, 202, 202, 0.8)'
    ctx.lineWidth = 1.5
    for (let lx = x - barrierSpan / 2 + 10; lx < x + barrierSpan / 2; lx += 12) {
      ctx.beginPath()
      ctx.moveTo(lx, y - 6)
      ctx.lineTo(lx, y - pillarHeight - 6)
      ctx.stroke()
    }

    // Lock Badge
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.rect(x - 45, y - pillarHeight - 22, 90, 16)
    ctx.fill()
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#fca5a5'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('⛔ GATE LOCKED', x, y - pillarHeight - 10)
  } else if (state === 'corrupted') {
    // Flickering unstable gate when corrupted
    const flicker = Math.sin(timeMs / 40) * 0.3 + 0.7 + (Math.random() - 0.5) * 0.2
    const alpha = Math.max(0.3, Math.min(1.0, flicker))

    // Left Pillar
    drawIsoBlock(ctx, x - barrierSpan / 2, y, pillarWidth, 10, pillarHeight, '#8b5cf6', '#6d28d9', '#4c1d95')
    // Right Pillar
    drawIsoBlock(ctx, x + barrierSpan / 2, y, pillarWidth, 10, pillarHeight, '#8b5cf6', '#6d28d9', '#4c1d95')

    // Unstable Flickering Energy Barrier
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = '#c084fc'
    ctx.lineWidth = 2 + Math.random() * 2
    ctx.beginPath()
    ctx.moveTo(x - barrierSpan / 2, y - 10)
    for (let i = -barrierSpan / 2; i <= barrierSpan / 2; i += 10) {
      const jitter = (Math.random() - 0.5) * 12
      ctx.lineTo(x + i, y - pillarHeight / 2 + jitter)
    }
    ctx.lineTo(x + barrierSpan / 2, y - 10)
    ctx.stroke()

    // Glitch Fill
    ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.5})`
    ctx.fillRect(x - barrierSpan / 2 + 2, y - pillarHeight - 4, barrierSpan - 4, pillarHeight)

    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.rect(x - 55, y - pillarHeight - 22, 110, 16)
    ctx.fill()
    ctx.strokeStyle = '#c084fc'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#e9d5ff'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('⚡ CORRUPTED GATE', x, y - pillarHeight - 10)
    ctx.restore()
  } else {
    // Open Gate (Access Granted)
    drawIsoBlock(ctx, x - barrierSpan / 2, y, pillarWidth, 10, pillarHeight, '#10b981', '#047857', '#065f46')
    drawIsoBlock(ctx, x + barrierSpan / 2, y, pillarWidth, 10, pillarHeight, '#10b981', '#047857', '#065f46')

    // Open Access Energy Field (Low Opacity Green Light)
    ctx.fillStyle = 'rgba(52, 211, 153, 0.2)'
    ctx.fillRect(x - barrierSpan / 2 + 4, y - pillarHeight, barrierSpan - 8, pillarHeight)

    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.rect(x - 45, y - pillarHeight - 22, 90, 16)
    ctx.fill()
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#6ee7b7'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('✅ GATE OPEN', x, y - pillarHeight - 10)
  }

  ctx.restore()
}

/** Draw visual corruption aura over affected area/NPC; dissolves upon DEL or SET cache invalidation */
export function drawCacheCorruptionAura(ctx, x, y, radius = 30, timeMs = Date.now()) {
  ctx.save()

  const pulse = Math.sin(timeMs / 150) * 0.2 + 0.8
  const currentRadius = radius * pulse

  // Outer Corrupted Purple Halo
  const gradient = ctx.createRadialGradient(x, y, 5, x, y, currentRadius)
  gradient.addColorStop(0, 'rgba(168, 85, 247, 0.6)')
  gradient.addColorStop(0.6, 'rgba(147, 51, 234, 0.3)')
  gradient.addColorStop(1, 'rgba(88, 28, 135, 0)')

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, currentRadius, 0, Math.PI * 2)
  ctx.fill()

  // Glitch Tendrils
  ctx.strokeStyle = '#c084fc'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 4; i++) {
    const angle = (timeMs / 500) + (i * Math.PI / 2)
    const tx = x + Math.cos(angle) * (currentRadius * 0.8)
    const ty = y + Math.sin(angle) * (currentRadius * 0.8)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(tx + (Math.random() - 0.5) * 6, ty + (Math.random() - 0.5) * 6)
    ctx.stroke()
  }

  // Corruption Label
  ctx.fillStyle = '#e9d5ff'
  ctx.font = 'bold 9px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('👾 CACHE CORRUPTED', x, y - radius - 8)

  ctx.restore()
}

/** Draw countdown timer overlay on shield field when EXPIRE is set */
export function drawShieldExpiryOverlay(ctx, x, y, radius = 32, remainingSeconds = 5, timeMs = Date.now()) {
  ctx.save()

  const pulse = Math.sin(timeMs / 200) * 0.15 + 0.85

  // Shield Field Ring
  ctx.strokeStyle = remainingSeconds <= 3 ? 'rgba(239, 68, 68, 0.9)' : 'rgba(56, 189, 248, 0.8)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, radius * pulse, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = remainingSeconds <= 3 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)'
  ctx.fill()

  // Countdown Timer Overlay Text Badge
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(x - 22, y - radius - 20, 44, 16, 4) : ctx.rect(x - 22, y - radius - 20, 44, 16)
  ctx.fill()

  ctx.strokeStyle = remainingSeconds <= 3 ? '#ef4444' : '#38bdf8'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.fillStyle = remainingSeconds <= 3 ? '#fca5a5' : '#7dd3fc'
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`⏱️ ${remainingSeconds}s`, x, y - radius - 8)

  ctx.restore()
}

/** Draw cargo conveyor belt showing items in list queues (LPUSH/RPUSH) and worker animations on RPOP */
export function drawQueueConveyor(ctx, x, y, queueItems = [], workerState = { active: false }, timeMs = Date.now()) {
  ctx.save()

  const beltWidth = 140
  const beltHeight = 24

  // Conveyor Belt Surface
  drawIsoBlock(ctx, x, y, beltWidth, beltHeight, 10, '#334155', '#1e293b', '#0f172a')

  // Belt Moving Texture Lines
  const scrollOffset = (timeMs / 20) % 20
  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 2
  for (let i = -60; i <= 60; i += 20) {
    const lx = x + i + (scrollOffset - 10)
    ctx.beginPath()
    ctx.moveTo(lx - 5, y - 5)
    ctx.lineTo(lx + 5, y + 5)
    ctx.stroke()
  }

  // Queue Items Cargo Boxes on Belt
  const maxItems = Math.min(5, queueItems.length)
  for (let i = 0; i < maxItems; i++) {
    const itemX = x - 40 + i * 20
    const itemY = y - 4
    drawIsoBlock(ctx, itemX, itemY, 14, 8, 12, '#f59e0b', '#d97706', '#b45309')
    
    // Label item index
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${i + 1}`, itemX, itemY - 14)
  }

  // Worker Animation on RPOP (Mechanical Worker / Robot Arm at end of conveyor)
  const workerX = x + 55
  const workerY = y - 6

  // Worker Base
  drawIsoBlock(ctx, workerX, workerY, 18, 10, 16, '#0284c7', '#0369a1', '#075985')

  if (workerState.active) {
    // Active worker animation picking cargo (RPOP event reaction)
    const armAngle = Math.sin(timeMs / 100) * 0.5
    ctx.save()
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(workerX, workerY - 16)
    ctx.lineTo(workerX - 15 + Math.cos(armAngle) * 10, workerY - 26 + Math.sin(armAngle) * 5)
    ctx.stroke()

    // Spark / Action Sparkle
    ctx.fillStyle = '#fef08a'
    ctx.beginPath()
    ctx.arc(workerX - 15, workerY - 26, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#38bdf8'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('🤖 RPOP WORKER', workerX, workerY - 32)
    ctx.restore()
  } else {
    // Idle Worker
    ctx.fillStyle = '#94a3b8'
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('WORKER IDLE', workerX, workerY - 20)
  }

  // Queue Title Banner
  ctx.fillStyle = '#38bdf8'
  ctx.font = 'bold 9px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`📦 LIST QUEUE (${queueItems.length} ITEMS)`, x, y - 22)

  ctx.restore()
}
