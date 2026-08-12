// Camera system with pan/zoom, player follow, world bounds, and screen shake.
//
// Coordinate spaces:
//   - World: game world coordinates (meters, matching region dimensions)
//   - Viewport: canvas pixel coordinates (top-left origin, CSS pixels)
//   - Screen: normalized [-1,1] or [0,1] space for shaders/UI
//
// The camera maintains a view matrix: viewport = (world - position) * zoom
// Rendering code should apply: ctx.translate(-position.x * zoom, -position.y * zoom); ctx.scale(zoom, zoom)

export class Camera {
  /**
   * @param {object} [opts]
   * @param {number} [opts.viewportWidth=800] canvas width in CSS pixels
   * @param {number} [opts.viewportHeight=600] canvas height in CSS pixels
   * @param {number} [opts.minZoom=0.25] minimum zoom level
   * @param {number} [opts.maxZoom=4] maximum zoom level
   * @param {number} [opts.smoothFactor=0.1] follow smoothing (0 = instant, 1 = never catches up)
   * @param {{width: number, height: number}} [opts.worldBounds] optional world bounds {x, y, width, height}
   */
  constructor({
    viewportWidth = 800,
    viewportHeight = 600,
    minZoom = 0.25,
    maxZoom = 4,
    smoothFactor = 0.1,
    worldBounds = null,
  } = {}) {
    this.viewportWidth = viewportWidth
    this.viewportHeight = viewportHeight
    this.minZoom = minZoom
    this.maxZoom = maxZoom
    this.smoothFactor = smoothFactor
    this.worldBounds = worldBounds

    // World-space position of the camera center
    this.position = { x: 0, y: 0 }
    // Target position for smooth following
    this.targetPosition = { x: 0, y: 0 }
    // Current zoom level
    this.zoom = 1
    // Target zoom for smooth transitions
    this.targetZoom = 1

    // Screen shake state
    this.shakeIntensity = 0
    this.shakeDuration = 0
    this.shakeTimer = 0
    this.shakeOffset = { x: 0, y: 0 }

    // Viewport resize handler reference for cleanup
    this._resizeHandler = null
  }

  /** Set the viewport size (call on canvas resize). */
  setViewportSize(width, height) {
    this.viewportWidth = width
    this.viewportHeight = height
    this._clampToBounds()
  }

  /** Set world bounds for clamping. */
  setWorldBounds(bounds) {
    this.worldBounds = bounds
    this._clampToBounds()
  }

  /** Instantly move camera to world position. */
  moveTo(x, y) {
    this.position.x = x
    this.position.y = y
    this.targetPosition.x = x
    this.targetPosition.y = y
    this._clampToBounds()
  }

  /** Smoothly follow a target (entity with x,y). */
  follow(target) {
    if (!target) return
    this.targetPosition.x = target.x
    this.targetPosition.y = target.y
  }

  /** Stop following - camera stays at current position. */
  unfollow() {
    this.targetPosition.x = this.position.x
    this.targetPosition.y = this.position.y
  }

  /** Set zoom instantly. */
  setZoom(zoom) {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom))
    this.targetZoom = this.zoom
    this._clampToBounds()
  }

  /** Smoothly zoom to a level. */
  zoomTo(zoom) {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom))
  }

  /** Zoom relative to current (e.g., wheel delta). */
  zoomBy(delta) {
    this.zoomTo(this.zoom * Math.exp(delta * 0.1))
  }

  /** Pan by world-space delta. */
  panBy(dx, dy) {
    this.targetPosition.x += dx
    this.targetPosition.y += dy
    this._clampTargetToBounds()
  }

  /** Trigger a screen shake. */
  shake(intensity, durationMs = 300) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity)
    this.shakeDuration = Math.max(this.shakeDuration, durationMs)
    this.shakeTimer = this.shakeDuration
  }

  /** Update camera - call once per frame with dt in seconds. */
  update(dt) {
    // Smooth follow position
    if (this.smoothFactor > 0 && this.smoothFactor < 1) {
      const inv = 1 - this.smoothFactor
      this.position.x = this.position.x * inv + this.targetPosition.x * this.smoothFactor
      this.position.y = this.position.y * inv + this.targetPosition.y * this.smoothFactor
    } else {
      this.position.x = this.targetPosition.x
      this.position.y = this.targetPosition.y
    }

    // Smooth zoom
    if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
      this.zoom += (this.targetZoom - this.zoom) * 0.15
    } else {
      this.zoom = this.targetZoom
    }

    // Screen shake decay
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt * 1000
      const progress = 1 - this.shakeTimer / this.shakeDuration
      const currentIntensity = this.shakeIntensity * (1 - progress * progress) // ease out
      const angle = Math.random() * Math.PI * 2
      this.shakeOffset.x = Math.cos(angle) * currentIntensity
      this.shakeOffset.y = Math.sin(angle) * currentIntensity
      if (this.shakeTimer <= 0) {
        this.shakeOffset.x = 0
        this.shakeOffset.y = 0
        this.shakeIntensity = 0
        this.shakeDuration = 0
      }
    }

    this._clampToBounds()
  }

  /** Convert world coordinates to viewport (canvas) coordinates. */
  worldToViewport(worldX, worldY) {
    return {
      x: (worldX - this.position.x + this.shakeOffset.x) * this.zoom + this.viewportWidth / 2,
      y: (worldY - this.position.y + this.shakeOffset.y) * this.zoom + this.viewportHeight / 2,
    }
  }

  /** Convert viewport (canvas) coordinates to world coordinates. */
  viewportToWorld(viewportX, viewportY) {
    return {
      x: (viewportX - this.viewportWidth / 2) / this.zoom + this.position.x - this.shakeOffset.x,
      y: (viewportY - this.viewportHeight / 2) / this.zoom + this.position.y - this.shakeOffset.y,
    }
  }

  /** Get the world-space rectangle currently visible in the viewport. */
  getVisibleWorldRect() {
    const halfW = this.viewportWidth / 2 / this.zoom
    const halfH = this.viewportHeight / 2 / this.zoom
    return {
      x: this.position.x - halfW,
      y: this.position.y - halfH,
      width: halfW * 2,
      height: halfH * 2,
    }
  }

  /** Check if a world-space rectangle is (partially) visible. */
  isVisible(worldX, worldY, width, height) {
    const view = this.getVisibleWorldRect()
    return !(
      worldX + width < view.x ||
      worldX > view.x + view.width ||
      worldY + height < view.y ||
      worldY > view.y + view.height
    )
  }

  /** Apply camera transform to a CanvasRenderingContext2D. */
  applyToContext(ctx) {
    ctx.save()
    ctx.translate(this.viewportWidth / 2, this.viewportHeight / 2)
    ctx.scale(this.zoom, this.zoom)
    ctx.translate(-this.position.x + this.shakeOffset.x, -this.position.y + this.shakeOffset.y)
  }

  /** Restore context after applyToContext. */
  restoreContext(ctx) {
    ctx.restore()
  }

  /** Get the view matrix as [a, b, c, d, e, f] for ctx.setTransform. */
  getViewMatrix() {
    // [zoom, 0, 0, zoom, -position.x*zoom + vpW/2, -position.y*zoom + vpH/2]
    return [
      this.zoom,
      0,
      0,
      this.zoom,
      -this.position.x * this.zoom + this.viewportWidth / 2 + this.shakeOffset.x * this.zoom,
      -this.position.y * this.zoom + this.viewportHeight / 2 + this.shakeOffset.y * this.zoom,
    ]
  }

  // ---- private ----

  _clampTargetToBounds() {
    if (!this.worldBounds) return
    const halfW = this.viewportWidth / 2 / this.zoom
    const halfH = this.viewportHeight / 2 / this.zoom

    // If the viewport is wider/taller than world bounds, center the camera on world bounds
    if (this.worldBounds.width <= halfW * 2) {
      this.targetPosition.x = this.worldBounds.x + this.worldBounds.width / 2
    } else {
      const minX = this.worldBounds.x + halfW
      const maxX = this.worldBounds.x + this.worldBounds.width - halfW
      this.targetPosition.x = Math.max(minX, Math.min(maxX, this.targetPosition.x))
    }

    if (this.worldBounds.height <= halfH * 2) {
      this.targetPosition.y = this.worldBounds.y + this.worldBounds.height / 2
    } else {
      const minY = this.worldBounds.y + halfH
      const maxY = this.worldBounds.y + this.worldBounds.height - halfH
      this.targetPosition.y = Math.max(minY, Math.min(maxY, this.targetPosition.y))
    }
  }

  _clampToBounds() {
    if (!this.worldBounds) return
    const halfW = this.viewportWidth / 2 / this.zoom
    const halfH = this.viewportHeight / 2 / this.zoom

    if (this.worldBounds.width <= halfW * 2) {
      this.position.x = this.worldBounds.x + this.worldBounds.width / 2
    } else {
      const minX = this.worldBounds.x + halfW
      const maxX = this.worldBounds.x + this.worldBounds.width - halfW
      this.position.x = Math.max(minX, Math.min(maxX, this.position.x))
    }

    if (this.worldBounds.height <= halfH * 2) {
      this.position.y = this.worldBounds.y + this.worldBounds.height / 2
    } else {
      const minY = this.worldBounds.y + halfH
      const maxY = this.worldBounds.y + this.worldBounds.height - halfH
      this.position.y = Math.max(minY, Math.min(maxY, this.position.y))
    }
  }
}

export function createCamera(opts) {
  return new Camera(opts)
}