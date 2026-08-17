import * as THREE from 'three'

export class Engine3D {
  constructor(container) {
    this.container = container
    this.width = container.clientWidth || 800
    this.height = container.clientHeight || 600

    // Core Three.js components
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x030712) // Slate 950
    this.scene.fog = new THREE.FogExp2(0x030712, 0.02)

    // Camera setup - top-down 3/4 isometric perspective
    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 1000)
    this.camera.position.set(0, 18, 16)
    this.camera.lookAt(0, 0, 1)

    // WebGL Renderer with fallback for environments without WebGL context (e.g., jsdom)
    try {
      const origConsoleError = console.error
      console.error = () => {}
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      console.error = origConsoleError
      this.renderer.setSize(this.width, this.height)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      this.renderer.shadowMap.enabled = true
      this.container.appendChild(this.renderer.domElement)
    } catch (e) {
      const mockCanvas = (typeof document !== 'undefined' ? document.createElement('canvas') : {})
      this.renderer = {
        domElement: mockCanvas,
        setSize: () => {},
        setPixelRatio: () => {},
        shadowMap: {},
        render: () => {},
        dispose: () => {},
      }
      if (this.container && this.container.appendChild && mockCanvas.nodeType) {
        this.container.appendChild(mockCanvas)
      }
    }

    // Arena dimensions
    this.arenaSize = 24

    // State collections
    this.player = null
    this.playerPos = new THREE.Vector3(0, 0.6, 4)
    this.playerVel = new THREE.Vector3(0, 0, 0)
    this.aimPoint = new THREE.Vector3(0, 0, 0)

    this.bossMesh = null
    this.bossShieldMesh = null
    this.bossHp = 100
    this.bossMaxHp = 100
    this.bossShieldActive = true
    this.bossShieldKey = 'goblin:shield'
    this.bossType = 'memory-goblin' // memory-goblin, entropy-spectre, noise-jammer, queue-overlord

    this.imps = []
    this.projectiles = []
    this.impProjectiles = []
    this.particles = []
    this.crates = []

    this.apiGateShield = null
    this.apiGateActive = false
    this.apiGateTimer = 0

    this.keysDown = {}
    this.mousePos = { x: 0, y: 0 }
    this.raycaster = new THREE.Raycaster()
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

    // Gameplay Stats
    this.playerHp = 100
    this.maxPlayerHp = 100
    this.systemHealth = 100
    this.maxSystemHealth = 100
    this.systemPressure = 20
    this.impSpawnTimer = 0
    this.score = 0

    // Callbacks
    this.onStateChange = null

    // Initialize world objects
    this.initLights()
    this.initArena()
    this.initPlayer()
    this.initBoss('memory-goblin')
    this.initConveyorBelt()

    // Bind event listeners
    this.boundResize = this.onWindowResize.bind(this)
    window.addEventListener('resize', this.boundResize)

    this.animationFrameId = null
    this.lastTime = performance.now()
  }

  initLights() {
    const ambient = new THREE.AmbientLight(0x38bdf8, 1.2)
    this.scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.0)
    dirLight.position.set(10, 25, 15)
    dirLight.castShadow = true
    this.scene.add(dirLight)

    const purpleLight = new THREE.PointLight(0xa855f7, 3.0, 30)
    purpleLight.position.set(-10, 5, -10)
    this.scene.add(purpleLight)

    const cyanLight = new THREE.PointLight(0x06b6d4, 3.0, 30)
    cyanLight.position.set(10, 5, 10)
    this.scene.add(cyanLight)
  }

  initArena() {
    // Cyber Grid Floor
    const gridHelper = new THREE.GridHelper(this.arenaSize * 2, 32, 0x22d3ee, 0x1e293b)
    gridHelper.position.y = 0.01
    this.scene.add(gridHelper)

    // Floor Mesh underneath
    const floorGeo = new THREE.PlaneGeometry(this.arenaSize * 2, this.arenaSize * 2)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.4,
      metalness: 0.8,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    // Glowing Cyber Wall Boundaries
    const wallHeight = 2.5
    const wallGeo = new THREE.BoxGeometry(this.arenaSize * 2, wallHeight, 0.2)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.5,
      wireframe: false,
    })

    // North, South, East, West Walls
    const northWall = new THREE.Mesh(wallGeo, wallMat)
    northWall.position.set(0, wallHeight / 2, -this.arenaSize)
    this.scene.add(northWall)

    const southWall = new THREE.Mesh(wallGeo, wallMat)
    southWall.position.set(0, wallHeight / 2, this.arenaSize)
    this.scene.add(southWall)

    const sideWallGeo = new THREE.BoxGeometry(0.2, wallHeight, this.arenaSize * 2)
    const westWall = new THREE.Mesh(sideWallGeo, wallMat)
    westWall.position.set(-this.arenaSize, wallHeight / 2, 0)
    this.scene.add(westWall)

    const eastWall = new THREE.Mesh(sideWallGeo, wallMat)
    eastWall.position.set(this.arenaSize, wallHeight / 2, 0)
    this.scene.add(eastWall)

    // Glowing Spawn Portals at 4 corners
    const portalPositions = [
      [-this.arenaSize + 3, -this.arenaSize + 3],
      [this.arenaSize - 3, -this.arenaSize + 3],
      [-this.arenaSize + 3, this.arenaSize - 3],
      [this.arenaSize - 3, this.arenaSize - 3],
    ]

    portalPositions.forEach(([x, z]) => {
      const ringGeo = new THREE.TorusGeometry(1.5, 0.2, 16, 32)
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = Math.PI / 2
      ring.position.set(x, 0.1, z)
      this.scene.add(ring)

      const portalLight = new THREE.PointLight(0xef4444, 2, 8)
      portalLight.position.set(x, 1, z)
      this.scene.add(portalLight)
    })

    // Deployable API Gate Shield Dome
    const gateGeo = new THREE.CylinderGeometry(4, 4, 3, 32, 1, true)
    const gateMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      wireframe: true,
    })
    this.apiGateShield = new THREE.Mesh(gateGeo, gateMat)
    this.apiGateShield.position.set(0, 1.5, 0)
    this.apiGateShield.visible = false
    this.scene.add(this.apiGateShield)
  }

  initPlayer() {
    this.playerGroup = new THREE.Group()

    // Cyber Hero Body
    const bodyGeo = new THREE.CapsuleGeometry(0.5, 1, 8, 16)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0e7490,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.2,
    })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0.8
    body.castShadow = true
    this.playerGroup.add(body)

    // Glowing Visor / Head
    const headGeo = new THREE.SphereGeometry(0.35, 16, 16)
    const headMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.set(0, 1.4, 0.1)
    this.playerGroup.add(head)

    // Blaster Weapon Barrel
    const weaponGeo = new THREE.BoxGeometry(0.2, 0.2, 0.8)
    const weaponMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 })
    const weapon = new THREE.Mesh(weaponGeo, weaponMat)
    weapon.position.set(0.4, 0.9, 0.4)
    this.playerGroup.add(weapon)

    // Hover Thruster Base Light
    const thrusterLight = new THREE.PointLight(0x06b6d4, 2, 4)
    thrusterLight.position.set(0, 0.2, 0)
    this.playerGroup.add(thrusterLight)

    this.playerGroup.position.copy(this.playerPos)
    this.scene.add(this.playerGroup)
    this.player = this.playerGroup
  }

  initBoss(bossType = 'memory-goblin') {
    if (this.bossGroup) {
      this.scene.remove(this.bossGroup)
    }

    this.bossType = bossType
    this.bossGroup = new THREE.Group()
    this.bossGroup.position.set(0, 0, -8)

    let bossColor = 0x10b981 // Green for Memory Goblin
    let bossName = 'Memory Goblin'
    this.bossShieldKey = 'goblin:shield'

    if (bossType === 'entropy-spectre') {
      bossColor = 0x8b5cf6
      bossName = 'Entropy Spectre'
      this.bossShieldKey = 'spectre:barrier'
    } else if (bossType === 'noise-jammer') {
      bossColor = 0x06b6d4
      bossName = 'Noise Jammer'
      this.bossShieldKey = 'jammer:signal'
    } else if (bossType === 'queue-overlord') {
      bossColor = 0xef4444
      bossName = 'Queue Overlord'
      this.bossShieldKey = 'overlord:queue'
    }

    // Core Boss Mesh
    const coreGeo = new THREE.IcosahedronGeometry(1.6, 2)
    const coreMat = new THREE.MeshStandardMaterial({
      color: bossColor,
      emissive: bossColor,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
      wireframe: false,
    })
    this.bossMesh = new THREE.Mesh(coreGeo, coreMat)
    this.bossMesh.position.y = 2
    this.bossGroup.add(this.bossMesh)

    // Outer Shield Bubble (`goblin:shield` / `spectre:barrier` / etc)
    const shieldGeo = new THREE.SphereGeometry(2.4, 32, 32)
    const shieldMat = new THREE.MeshBasicMaterial({
      color: bossColor,
      transparent: true,
      opacity: 0.45,
      wireframe: true,
    })
    this.bossShieldMesh = new THREE.Mesh(shieldGeo, shieldMat)
    this.bossShieldMesh.position.y = 2
    this.bossGroup.add(this.bossShieldMesh)
    this.bossShieldActive = true

    // Boss Light
    const bossLight = new THREE.PointLight(bossColor, 3, 10)
    bossLight.position.set(0, 2, 0)
    this.bossGroup.add(bossLight)

    this.scene.add(this.bossGroup)
  }

  initConveyorBelt() {
    // Physical Conveyor Belt in the arena floor for Queue operations (LPUSH/RPUSH/LPOP/RPOP)
    this.conveyorGroup = new THREE.Group()
    this.conveyorGroup.position.set(-6, 0.05, 0)

    const beltGeo = new THREE.BoxGeometry(2, 0.1, 12)
    const beltMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    })
    const belt = new THREE.Mesh(beltGeo, beltMat)
    this.conveyorGroup.add(belt)

    // Conveyor Side Rails
    const railGeo = new THREE.BoxGeometry(0.2, 0.4, 12)
    const railMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b })

    const railLeft = new THREE.Mesh(railGeo, railMat)
    railLeft.position.set(-1.1, 0.2, 0)
    this.conveyorGroup.add(railLeft)

    const railRight = new THREE.Mesh(railGeo, railMat)
    railRight.position.set(1.1, 0.2, 0)
    this.conveyorGroup.add(railRight)

    this.scene.add(this.conveyorGroup)
  }

  // --- Actions & Commands FX ---

  castSetCommand(targetPos) {
    // Primary laser shot (SET command)
    const targetVec = targetPos && targetPos.isVector3 ? targetPos : new THREE.Vector3(targetPos?.x || 0, targetPos?.y || 0, targetPos?.z || 0)
    const origin = this.playerGroup.position.clone().add(new THREE.Vector3(0, 1, 0))
    const dir = targetVec.clone().sub(origin).normalize()

    const laserGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2)
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    const laser = new THREE.Mesh(laserGeo, laserMat)

    laser.position.copy(origin)
    laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)

    this.projectiles.push({
      mesh: laser,
      dir,
      speed: 24,
      type: 'SET',
      life: 2.0,
    })
    this.scene.add(laser)

    this.createParticles(origin, 0x22d3ee, 5)
  }

  castGetCommand(targetPos) {
    // Target Recon Painter Beam (GET command)
    const targetVec = targetPos && targetPos.isVector3 ? targetPos : new THREE.Vector3(targetPos?.x || 0, targetPos?.y || 0, targetPos?.z || 0)
    const origin = this.playerGroup.position.clone().add(new THREE.Vector3(0, 1, 0))
    const dir = targetVec.clone().sub(origin).normalize()

    const beamGeo = new THREE.CylinderGeometry(0.02, 0.4, 10, 16)
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.6,
    })
    const beam = new THREE.Mesh(beamGeo, beamMat)
    beam.position.copy(origin.clone().add(dir.clone().multiplyScalar(5)))
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)

    this.scene.add(beam)
    setTimeout(() => {
      this.scene.remove(beam)
      beam.geometry?.dispose()
      beam.material?.dispose()
    }, 400)

    this.createParticles(targetPos, 0xf59e0b, 10)
  }

  castDelCommand(targetPos) {
    // Green Purge Shot (DEL command - strips Memory Goblin's shield)
    const targetVec = targetPos && targetPos.isVector3 ? targetPos : new THREE.Vector3(targetPos?.x || 0, targetPos?.y || 0, targetPos?.z || 0)
    const origin = this.playerGroup.position.clone().add(new THREE.Vector3(0, 1, 0))
    const dir = targetVec.clone().sub(origin).normalize()

    const orbGeo = new THREE.SphereGeometry(0.4, 16, 16)
    const orbMat = new THREE.MeshBasicMaterial({ color: 0x10b981 })
    const orb = new THREE.Mesh(orbGeo, orbMat)

    orb.position.copy(origin)

    this.projectiles.push({
      mesh: orb,
      dir,
      speed: 18,
      type: 'DEL',
      life: 2.0,
    })
    this.scene.add(orb)

    this.createParticles(origin, 0x10b981, 8)
  }

  castExpireCommand() {
    // Deployable API Gate Shield Barrier (EXPIRE command)
    this.apiGateActive = true
    this.apiGateTimer = 8.0 // 8 seconds duration
    if (this.apiGateShield) {
      this.apiGateShield.visible = true
      this.apiGateShield.position.copy(this.playerGroup.position)
      this.apiGateShield.position.y = 1.5
    }
    this.createParticles(this.playerGroup.position, 0x38bdf8, 20)
  }

  castQueueCommand(type = 'LPUSH') {
    // Queue Crate handling (LPUSH/RPUSH/LPOP/RPOP)
    if (type === 'LPUSH' || type === 'RPUSH') {
      const crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8)
      const crateMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.5,
      })
      const crate = new THREE.Mesh(crateGeo, crateMat)
      const zOffset = (this.crates.length - 2) * 1.2
      crate.position.set(-6, 0.5, zOffset)
      this.crates.push(crate)
      this.scene.add(crate)
      this.createParticles(crate.position, 0xef4444, 10)
    } else if (type === 'LPOP' || type === 'RPOP') {
      if (this.crates.length > 0) {
        const popped = type === 'LPOP' ? this.crates.shift() : this.crates.pop()
        if (popped) {
          this.createParticles(popped.position, 0xf59e0b, 15)
          this.scene.remove(popped)
          popped.geometry?.dispose()
          popped.material?.dispose()
        }
      }
    }
  }

  stripBossShield() {
    if (this.bossShieldMesh && this.bossShieldActive) {
      this.bossShieldActive = false
      this.bossShieldMesh.visible = false
      if (this.bossGroup) {
        this.createParticles(this.bossGroup.position.clone().add(new THREE.Vector3(0, 2, 0)), 0x10b981, 30)
      }
    }
  }

  damageBoss(amount = 25) {
    if (this.bossShieldActive) {
      // Shield absorbs hit
      if (this.bossGroup) {
        this.createParticles(this.bossGroup.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xef4444, 10)
      }
      return false
    }

    this.bossHp = Math.max(0, this.bossHp - amount)
    if (this.bossGroup) {
      this.createParticles(this.bossGroup.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xf59e0b, 20)
    }

    if (this.bossHp === 0 && this.bossMesh) {
      this.bossMesh.visible = false
    }
    return true
  }

  spawnImp() {
    if (this.imps.length >= 8) return

    const spawnAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
    const angle = spawnAngles[Math.floor(Math.random() * spawnAngles.length)]
    const dist = this.arenaSize - 4

    const impGeo = new THREE.OctahedronGeometry(0.5, 0)
    const impMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
    })
    const imp = new THREE.Mesh(impGeo, impMat)
    imp.position.set(Math.cos(angle) * dist, 1.0, Math.sin(angle) * dist)

    this.imps.push({
      mesh: imp,
      hp: 20,
      fireTimer: Math.random() * 2,
    })
    this.scene.add(imp)
  }

  createParticles(pos, colorHex, count = 10) {
    for (let i = 0; i < count; i++) {
      const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1)
      const pMat = new THREE.MeshBasicMaterial({ color: colorHex })
      const p = new THREE.Mesh(pGeo, pMat)

      p.position.copy(pos)
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8 + 2,
        (Math.random() - 0.5) * 8
      )

      this.particles.push({ mesh: p, vel, life: 0.5 + Math.random() * 0.5 })
      this.scene.add(p)
    }
  }

  // --- Main Update Loop ---

  update(delta) {
    // 1. Controls & Player Movement
    const speed = 10
    const moveDir = new THREE.Vector3()

    if (this.keysDown['w'] || this.keysDown['W'] || this.keysDown['ArrowUp']) moveDir.z -= 1
    if (this.keysDown['s'] || this.keysDown['S'] || this.keysDown['ArrowDown']) moveDir.z += 1
    if (this.keysDown['a'] || this.keysDown['A'] || this.keysDown['ArrowLeft']) moveDir.x -= 1
    if (this.keysDown['d'] || this.keysDown['D'] || this.keysDown['ArrowRight']) moveDir.x += 1

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize()
      this.playerPos.add(moveDir.multiplyScalar(speed * delta))
      // Clamp player within arena limits
      const limit = this.arenaSize - 1.5
      this.playerPos.x = Math.max(-limit, Math.min(limit, this.playerPos.x))
      this.playerPos.z = Math.max(-limit, Math.min(limit, this.playerPos.z))
    }

    if (this.playerGroup) {
      this.playerGroup.position.copy(this.playerPos)
      // Rotate player toward aim point
      const aimDir = this.aimPoint.clone().sub(this.playerPos)
      aimDir.y = 0
      if (aimDir.lengthSq() > 0.01) {
        const angle = Math.atan2(aimDir.x, aimDir.z)
        this.playerGroup.rotation.y = angle
      }
    }

    // Smooth camera follow
    const targetCamPos = this.playerPos.clone().add(new THREE.Vector3(0, 18, 16))
    this.camera.position.lerp(targetCamPos, 0.08)

    // 2. API Gate Shield Timer
    if (this.apiGateActive) {
      this.apiGateTimer -= delta
      if (this.apiGateShield) {
        this.apiGateShield.position.copy(this.playerPos)
        this.apiGateShield.position.y = 1.5
        this.apiGateShield.rotation.y += delta
      }
      if (this.apiGateTimer <= 0) {
        this.apiGateActive = false
        if (this.apiGateShield) this.apiGateShield.visible = false
      }
    }

    // 3. Boss Animation & Rotation
    if (this.bossMesh) {
      this.bossMesh.rotation.y += delta * 0.8
      this.bossMesh.rotation.x += delta * 0.3
    }
    if (this.bossShieldMesh && this.bossShieldActive) {
      this.bossShieldMesh.rotation.y -= delta * 0.5
    }

    // 4. Update Imps & Imp Projectiles
    this.impSpawnTimer += delta
    if (this.impSpawnTimer > 4.0) {
      this.impSpawnTimer = 0
      this.spawnImp()
    }

    for (let i = this.imps.length - 1; i >= 0; i--) {
      const imp = this.imps[i]
      imp.mesh.rotation.y += delta * 2.0
      // Move toward center/player
      const dirToPlayer = this.playerPos.clone().sub(imp.mesh.position).normalize()
      dirToPlayer.y = 0
      imp.mesh.position.add(dirToPlayer.multiplyScalar(2.0 * delta))

      // Fire imp request projectile
      imp.fireTimer += delta
      if (imp.fireTimer > 3.0) {
        imp.fireTimer = 0
        const projGeo = new THREE.SphereGeometry(0.2, 8, 8)
        const projMat = new THREE.MeshBasicMaterial({ color: 0xef4444 })
        const proj = new THREE.Mesh(projGeo, projMat)
        proj.position.copy(imp.mesh.position)
        this.impProjectiles.push({
          mesh: proj,
          dir: dirToPlayer.clone(),
          speed: 12,
          life: 3.0,
        })
        this.scene.add(proj)
      }
    }

    // Update Imp Projectiles
    for (let i = this.impProjectiles.length - 1; i >= 0; i--) {
      const p = this.impProjectiles[i]
      p.life -= delta
      p.mesh.position.add(p.dir.clone().multiplyScalar(p.speed * delta))

      // Collision with API Gate Shield
      if (this.apiGateActive && this.apiGateShield) {
        const distToPlayer = p.mesh.position.distanceTo(this.playerPos)
        if (distToPlayer < 4.0) {
          this.createParticles(p.mesh.position, 0x38bdf8, 8)
          this.scene.remove(p.mesh)
          p.mesh.geometry?.dispose()
          p.mesh.material?.dispose()
          this.impProjectiles.splice(i, 1)
          continue
        }
      }

      // Collision with Player
      const distToPlayer = p.mesh.position.distanceTo(this.playerPos)
      if (distToPlayer < 1.0) {
        this.playerHp = Math.max(0, this.playerHp - 8)
        this.systemPressure = Math.min(100, this.systemPressure + 5)
        this.createParticles(p.mesh.position, 0xef4444, 12)
        this.scene.remove(p.mesh)
        p.mesh.geometry?.dispose()
        p.mesh.material?.dispose()
        this.impProjectiles.splice(i, 1)
        continue
      }

      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        p.mesh.geometry?.dispose()
        p.mesh.material?.dispose()
        this.impProjectiles.splice(i, 1)
      }
    }

    // 5. Update Player Projectiles (SET / DEL / etc)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.life -= delta
      p.mesh.position.add(p.dir.clone().multiplyScalar(p.speed * delta))

      // Check collision with Boss
      if (this.bossGroup && this.bossMesh && this.bossMesh.visible) {
        const bossCenter = this.bossGroup.position.clone().add(new THREE.Vector3(0, 2, 0))
        const dist = p.mesh.position.distanceTo(bossCenter)

        if (dist < 2.6) {
          if (p.type === 'DEL') {
            // DEL strips shield!
            this.stripBossShield()
            this.damageBoss(20)
          } else {
            this.damageBoss(15)
          }
          this.createParticles(p.mesh.position, p.type === 'DEL' ? 0x10b981 : 0x22d3ee, 15)
          this.scene.remove(p.mesh)
          p.mesh.geometry?.dispose()
          p.mesh.material?.dispose()
          this.projectiles.splice(i, 1)
          continue
        }
      }

      // Check collision with Imps
      let impHit = false
      for (let j = this.imps.length - 1; j >= 0; j--) {
        const imp = this.imps[j]
        if (p.mesh.position.distanceTo(imp.mesh.position) < 1.2) {
          imp.hp -= 20
          this.createParticles(imp.mesh.position, 0x22d3ee, 10)
          if (imp.hp <= 0) {
            this.createParticles(imp.mesh.position, 0xef4444, 20)
            this.scene.remove(imp.mesh)
            imp.mesh.geometry?.dispose()
            imp.mesh.material?.dispose()
            this.imps.splice(j, 1)
            this.score += 50
            this.systemPressure = Math.max(0, this.systemPressure - 5)
          }
          impHit = true
          break
        }
      }

      if (impHit) {
        this.scene.remove(p.mesh)
        p.mesh.geometry?.dispose()
        p.mesh.material?.dispose()
        this.projectiles.splice(i, 1)
        continue
      }

      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        p.mesh.geometry?.dispose()
        p.mesh.material?.dispose()
        this.projectiles.splice(i, 1)
      }
    }

    // 6. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= delta
      p.mesh.position.add(p.vel.clone().multiplyScalar(delta))
      p.mesh.scale.multiplyScalar(0.95)

      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        p.mesh.geometry?.dispose()
        p.mesh.material?.dispose()
        this.particles.splice(i, 1)
      }
    }

    // Render step
    this.renderer.render(this.scene, this.camera)

    if (this.onStateChange) {
      this.onStateChange({
        playerHp: this.playerHp,
        systemHealth: this.systemHealth,
        systemPressure: this.systemPressure,
        bossHp: this.bossHp,
        bossMaxHp: this.bossMaxHp,
        bossShieldActive: this.bossShieldActive,
        bossShieldKey: this.bossShieldKey,
        score: this.score,
        apiGateActive: this.apiGateActive,
        apiGateTimer: Math.ceil(this.apiGateTimer),
      })
    }
  }

  start() {
    const loop = (now) => {
      const delta = Math.min((now - this.lastTime) / 1000, 0.1)
      this.lastTime = now
      this.update(delta)
      this.animationFrameId = requestAnimationFrame(loop)
    }
    this.animationFrameId = requestAnimationFrame(loop)
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  updateAimPoint(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mousePos.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.mousePos.y = -((clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mousePos, this.camera)
    const target = new THREE.Vector3()
    this.raycaster.ray.intersectPlane(this.groundPlane, target)
    if (target) {
      this.aimPoint.copy(target)
    }
  }

  onWindowResize() {
    if (!this.container) return
    this.width = this.container.clientWidth || 800
    this.height = this.container.clientHeight || 600
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.width, this.height)
  }

  dispose() {
    this.stop()
    window.removeEventListener('resize', this.boundResize)
    if (this.renderer && this.renderer.domElement) {
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
      }
    }
    this.renderer.dispose()
  }
}
