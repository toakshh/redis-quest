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
