# REDIS-QUEST 3D: PROTOCOL ZERO
## International Production-Grade Master Blueprint & Technical Specification

---

## 1. Executive Summary & Vision

**Redis Quest 3D: Protocol Zero** is an AAA-grade, high-velocity 3D FPS Survival Horror and Database Management Action RPG integrated directly into the `redis-quest` engine ecosystem. It bridges retro-modern first-person survival combat (*DOOM Eternal* meets *Dead Space*) with deep, accurate distributed systems engineering principles.

Set within **Cluster Zero**—a monolithic subterranean quantum datacenter buried 400 meters beneath Arctic ice—the player takes on the role of a Systems Specialist battling an apocalyptic datacenter meltdown caused by a self-modifying eviction algorithm entity named **Sultan-0**.

### Core Pillars
- **System State IS Level State**: The physical environment, enemy spawns, dynamic lighting, and room architecture mutate dynamically based on simulated or live Redis cluster metrics (Cache Hit Rate, Queue Depth, Memory Usage, Split-Brain Partitions).
- **Kinesthetic Combat Meets Hacking Abilities**: Gunplay is fast, tactile, and responsive. Weapons and gear directly mirror Redis data structures and operations (`SETEX`, `LRU`/`LFU` eviction beams, `XADD`/`XREADGROUP` consumer turrets, `Redlock` consensus shields, `GEO` threat radar).
- **Dismantling the Educational Game Trap**: Typing commands or managing cluster nodes is never a static quiz—it is activating high-yield cyberdeck abilities and terminal nodes under live enemy fire.
- **AAA Web Graphics & Spatial Audio**: Built on React 18, Three.js, React Three Fiber (`@react-three/fiber`), `@react-three/drei`, `@react-three/postprocessing` (SSAO, Bloom, Chromatic Aberration, Volumetric Fog), Rapier3D physics, and Web Audio 3D spatial sound.

---

## 2. Dynamic Narrative & Storyline Architecture

### Setting & Lore: *Cluster Zero*
*Cluster Zero* is the monolithic nerve center for global real-time infrastructure. Pristine glass-and-steel server halls, liquid-nitrogen cooling reservoirs, and glowing neon fiber optics mutate into decaying, rust-covered industrial horror zones dripping with cryogenic coolant as Sultan-0 spreads.

### Real-Time Metric Mutation Engine

| Redis Metric Condition | Environmental / Narrative Reaction | Gameplay & Combat Consequence |
| :--- | :--- | :--- |
| **Cache Hit Ratio < 60%** (Cache Stampede) | Emergency lighting dies; ambient temperature plummets into freezing darkness. | *Stampede Crawlers* breach airlocks; player must deploy Mutex Locks (`SET NX`) and `SETEX` barriers. |
| **Queue Depth > 10,000** (Backpressure Build) | Coolant pipes rupture; toxic memory-leak liquid floods lower catwalks. | Spatial traversal restricted; player must deploy Stream Consumer Turrets (`XREADGROUP`) to drain queues. |
| **Memory Usage > 90%** (OOM Collapse) | Gravity generators glitch; volumetric void portals open. | *OOM Spectre* boss spawns; player must fire targeted `LRU`/`LFU` eviction cannons before node explosion. |
| **Split-Brain Network Partition** | Datacenter physically splits into two phasing, desynchronized realities. | Dual phantom boss fight; player must enforce `Redlock` distributed consensus ($\text{Quorum} = 3/5$) to resynchronize realities. |

### Act-by-Act Campaign
- **Act I: Sector 1 – Cold Cache**: Inciting breach; escape-room puzzles introducing cache-aside gunplay and `SETEX` barriers.
- **Act II: Sector 2 – Pressure Surge**: High-intensity queue backpressure crisis; wave survival against stream swarmers using `XADD` turrets.
- **Act III: Sector 3 – The Partitioned Deep**: Dynamic branch based on system health (Balanced Matrix vs. Split-Brain Void).
- **Act IV: Sector 0 – Protocol Zero**: Multi-phase boss battle against Sultan-0 inside the core cluster matrix.

---

## 3. Production Redis Pedagogy & Combat Mechanics

### Primary Arsenal & Redis Operations
1. **Cache Rifle (`SET` / `GET` / `SETEX`)**:
   - Primary fire shoots targeted data packets.
   - Alternate fire deploys a `SETEX` temporal forcefield barrier with a live TTL countdown displayed in 3D holographic text. Detonates when TTL reaches zero.
2. **Eviction Ordnance (`Volatile-LRU Beam` / `Allkeys-LFU Pulse Rifle`)**:
   - Weapon modes inspect object headers (`lru_clock` / `lfu_counter`) of RAM Slime Blobs, allowing players to vaporize stale memory leaks without destroying persistent data structures.
3. **Stream Cannon (`XADD` / `XREADGROUP`)**:
   - Mortar weapon launching high-density event streams. Spawns automated consumer turrets that pull event batches and reroute corrupted payloads to Dead Letter Queues.
4. **Mutex Lock Cannon (`SET key val NX EX`)**:
   - Fires atomic lock bolts. The `NX` flag guarantees single-entity acquisition, preventing Thundering Herd swarms from overwhelming the relational core reactor.
5. **Redlock Barrier (`Distributed Consensus`)**:
   - Capturing 3 out of 5 cluster node pillars ($\text{Quorum} = N/2 + 1$) seals boss phase arenas and grants invulnerability against split-brain entities.
6. **Geospatial Threat Radar (`GEOADD` / `GEORADIUS`)**:
   - Projects an interactive 3D tactical radar overlay showing exact enemy distance vectors and real-time threat rankings.

---

## 4. Technical Architecture & Graphics Stack

### Graphics & Render Pipeline (`@react-three/fiber`)
- **Tone Mapping**: `ACESFilmicToneMapping` with exposure 1.1 for deep high-contrast shadows and vivid neon emissives.
- **Post-Processing Passes**:
  1. **SSAO / N8AO**: Real-time contact shadows in dark server corridors.
  2. **Selective Bloom**: High-intensity bloom (`luminanceThreshold: 0.82`) on emissive data conduits and LED displays.
  3. **Chromatic Aberration & Lens Distortion**: Cyber-optic damage feedback scaling with player health loss and memory stress.
  4. **Volumetric & Depth Fog**: `FogExp2` combined with low-lying floor mist shaders.
  5. **Vignette & Film Grain**: Claustrophobic horror lens aesthetic.

### 3D Physics Engine (`@react-three/rapier`)
- Rapier3D rigid-body character controller supporting smooth WASD movement, stair climbing, jumping, sliding, and jet-dashes.
- Raycast hitscan shooting and projectile ballistics with physical momentum transfer and ragdoll reactions.

### Spatial Audio System (Web Audio API / Howler)
- 3D positional audio nodes for directional gunshots, spatial reverb, footsteps, low-frequency horror drones, and demonic screech samples.
- Dynamic multi-track synthwave soundtrack stems that scale intensity based on system CPU/memory load and enemy proximity.

---

## 5. Directory Structure Blueprint

```
src/
├── game3d/
│   ├── components/
│   │   ├── Player3D.jsx            # FPS Character Controller (Rapier + R3F)
│   │   ├── CanvasRenderer.jsx      # Core Canvas & R3F setup
│   │   ├── PostProcessing.jsx      # SSAO, Bloom, Chromatic Aberration passes
│   │   ├── TerminalNode3D.jsx      # In-world interactive 3D Redis terminal
│   │   ├── EnemySpawner.jsx        # Wave & swarm AI spawner
│   │   └── LightingEnv.jsx         # Volumetric lights & emergency strobes
│   ├── scenes/
│   │   ├── Sector1_ColdCache.jsx   # Act I level
│   │   ├── Sector2_Pressure.jsx    # Act II level
│   │   ├── Sector3_Partition.jsx   # Act III level
│   │   └── Sector0_ProtocolZero.jsx# Act IV boss arena
│   ├── physics/
│   │   ├── PhysicsWorld.jsx        # Rapier provider wrapper
│   │   └── RaycasterGun.jsx        # Shooting mechanics & bullet impact physics
│   ├── audio/
│   │   ├── SoundEngine.js          # Web Audio 3D spatial manager
│   │   └── DynamicMusic.js         # Multi-track adaptive horror soundtrack
│   ├── shaders/
│   │   ├── GlitchShader.js         # Digital corruption fragment shader
│   │   └── RedisStreamShader.js    # Glowing data flow texture shader
│   └── weapons/
│       ├── CacheRifle.jsx          # Set/Get fast packet weapon
│       ├── EvictionBeam.jsx        # LRU/LFU eviction cannon
│       └── StreamMortar.jsx        # Queue & stream turret mortar
```

---

## 6. Implementation Roadmap

1. **Phase 1**: 3D FPS Foundation & Rapier Physics Character Controller (WASD movement, jump, shoot raycaster, R3F Canvas setup).
2. **Phase 2**: Post-Processing Pass Pipeline & Custom Shaders (SSAO, Bloom, Chromatic Aberration, Volumetric Fog, Data Stream shaders).
3. **Phase 3**: 3D Spatial Audio Engine & Sound FX Bank (Position audio nodes, gunshot SFX, dynamic synthwave stems).
4. **Phase 4**: In-World Interactive 3D Terminals (`TerminalNode3D`) connected to `src/engine/engine.js` Redis mock engine.
5. **Phase 5**: Dynamic Horror Mutation Engine & AI Swarms (Stampede Crawlers, Memory Blobs, Sultan-0 Boss fight).
6. **Phase 6**: Polish, LOD Culling, Performance Optimization (locked 60 FPS target).

---

## 7. Reference Reports

Detailed scout research documents produced for this plan:
- Narrative & Gameplay Specification: `data/rq3d-scout-story-gameplay/report.md`
- Graphics, Physics & Audio Architecture: `data/rq3d-scout-tech-physics-audio/report.md`
- Production Redis Pedagogy & 3D Mechanics: `data/rq3d-scout-pedagogy-learning/report.md`
