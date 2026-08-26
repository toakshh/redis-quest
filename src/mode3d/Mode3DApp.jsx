import React, { useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { RapierPhysics, useRigidBodies } from '@react-three/rapier';

// Extend Three.js classes
extend(THREE);

// Import all 3D mode components
import { PostFXPipeline } from './postfx/PostFXPipeline';
import { useDynamicPostFX } from './postfx/useDynamicPostFX';
import VisorHUD from './hud/VisorHUD';
import { AmbienceZones } from './audio/AmbienceZones';
import { useStingerQueue } from './audio/StingerQueue';
import { useLoopTransitionAudio } from './audio/LoopTransitionAudio';
import LevelGeometry from './world/LevelGeometry';
import MissionManager from './world/MissionManager';
import { use3DGameStore } from './stores/use3DGameStore';

// Physics configuration
const GRAVITY = new THREE.Vector3(0, -9.81, 0);
const FIXED_TIME_STEP = 1 / 60;
const MAX_SUB_STEPS = 3;

// ============================================
// FPS Controller with Head Bob
// ============================================
function FPSController({ 
  position = [0, 1.7, 0], 
  onPositionChange,
  onRotationChange,
}) {
  const { camera, gl, scene } = useThree();
  const { rigidBodies } = useRigidBodies();
  
  const controlsRef = useRef({
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    jump: false,
    sprint: false,
    crouch: false,
  });
  
  const velocityRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());
  const prevTimeRef = useRef(performance.now());
  
  const playerBody = rigidBodies.get('player');
  
  const headBobRef = useRef({
    time: 0,
    intensity: 0.02,
    frequency: 8,
    active: false,
  });
  
  const shakeRef = useRef({ intensity: 0, decay: 0.9 });

  useEffect(() => {
    const onKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW': controlsRef.current.moveForward = true; break;
        case 'KeyS': controlsRef.current.moveBackward = true; break;
        case 'KeyA': controlsRef.current.moveLeft = true; break;
        case 'KeyD': controlsRef.current.moveRight = true; break;
        case 'Space': controlsRef.current.jump = true; break;
        case 'ShiftLeft': controlsRef.current.sprint = true; break;
        case 'ControlLeft': controlsRef.current.crouch = true; break;
      }
    };
    
    const onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': controlsRef.current.moveForward = false; break;
        case 'KeyS': controlsRef.current.moveBackward = false; break;
        case 'KeyA': controlsRef.current.moveLeft = false; break;
        case 'KeyD': controlsRef.current.moveRight = false; break;
        case 'Space': controlsRef.current.jump = false; break;
        case 'ShiftLeft': controlsRef.current.sprint = false; break;
        case 'ControlLeft': controlsRef.current.crouch = false; break;
      }
    };
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    const onClick = () => gl.domElement.requestPointerLock();
    gl.domElement.addEventListener('click', onClick);
    
    const onMouseMove = (e) => {
      if (document.pointerLockElement === gl.domElement) {
        const sensitivity = 0.002;
        camera.rotation.y -= e.movementX * sensitivity;
        camera.rotation.x -= e.movementY * sensitivity;
        camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
        
        if (onRotationChange) {
          onRotationChange(camera.rotation);
        }
      }
    };
    
    document.addEventListener('mousemove', onMouseMove);
    
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      gl.domElement.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [camera, gl.domElement, onRotationChange]);

  useFrame((state, delta) => {
    if (!playerBody) return;
    
    const speed = controlsRef.current.sprint ? 8 : 4;
    const crouchSpeed = 2;
    const currentSpeed = controlsRef.current.crouch ? crouchSpeed : speed;
    
    directionRef.current.set(0, 0, 0);
    
    if (controlsRef.current.moveForward) directionRef.current.z -= 1;
    if (controlsRef.current.moveBackward) directionRef.current.z += 1;
    if (controlsRef.current.moveLeft) directionRef.current.x -= 1;
    if (controlsRef.current.moveRight) directionRef.current.x += 1;
    
    directionRef.current.normalize();
    
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, camera.rotation.y, 0)
    );
    directionRef.current.applyQuaternion(quat);
    
    const linvel = playerBody.linvel();
    const newVel = new THREE.Vector3(
      directionRef.current.x * currentSpeed,
      linvel.y,
      directionRef.current.z * currentSpeed
    );
    
    if (controlsRef.current.jump && Math.abs(linvel.y) < 0.1) {
      newVel.y = 8;
    }
    
    playerBody.setLinvel(newVel, true);
    
    const pos = playerBody.translation();
    camera.position.set(pos.x, pos.y + 1.6, pos.z);
    
    const moving = directionRef.current.length() > 0.1 && Math.abs(linvel.y) < 0.5;
    headBobRef.current.active = moving;
    
    if (moving) {
      headBobRef.current.time += delta * headBobRef.current.frequency;
      const bobY = Math.sin(headBobRef.current.time) * headBobRef.current.intensity;
      const bobX = Math.sin(headBobRef.current.time * 0.5) * headBobRef.current.intensity * 0.5;
      camera.position.y += bobY;
      camera.position.x += bobX;
    } else {
      headBobRef.current.time = 0;
    }
    
    if (shakeRef.current.intensity > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shakeRef.current.intensity;
      camera.position.y += (Math.random() - 0.5) * shakeRef.current.intensity;
      camera.position.z += (Math.random() - 0.5) * shakeRef.current.intensity;
      shakeRef.current.intensity *= shakeRef.current.decay;
    }
    
    if (onPositionChange) {
      onPositionChange(camera.position, camera.rotation);
    }
  });

  const triggerShake = useCallback((intensity = 0.5) => {
    shakeRef.current.intensity = intensity;
  }, []);

  return null;
}

// ============================================
// Plasma Cutter Weapon
// ============================================
function PlasmaCutter() {
  const { camera, scene } = useThree();
  const { player: { weapons: { plasma } }, setPlayerWeaponHeat } = use3DGameStore();
  
  const cutterRef = useRef(null);
  const beamRef = useRef(null);
  const heatRef = useRef(plasma.heat);
  const isFiringRef = useRef(false);

  useEffect(() => {
    const group = new THREE.Group();
    
    const handleGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.8, roughness: 0.2 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = -Math.PI / 2;
    handle.position.set(0.2, -0.15, -0.3);
    group.add(handle);
    
    const emitterGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.2, 8);
    const emitterMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.5 });
    const emitter = new THREE.Mesh(emitterGeo, emitterMat);
    emitter.rotation.x = -Math.PI / 2;
    emitter.position.set(0.2, -0.15, -0.5);
    group.add(emitter);
    
    const heatGeo = new THREE.RingGeometry(0.02, 0.04, 8);
    const heatMat = new THREE.MeshBasicMaterial({ color: 0xff3030, side: THREE.DoubleSide });
    const heatIndicator = new THREE.Mesh(heatGeo, heatMat);
    heatIndicator.position.set(0.25, -0.1, -0.35);
    heatIndicator.rotation.x = -Math.PI / 2;
    group.add(heatIndicator);
    
    cutterRef.current = group;
    scene.add(group);
    
    return () => scene.remove(group);
  }, [scene]);

  useFrame(() => {
    if (cutterRef.current) {
      cutterRef.current.position.copy(camera.position);
      cutterRef.current.rotation.copy(camera.rotation);
      cutterRef.current.position.add(new THREE.Vector3(0.3, -0.2, -0.5).applyQuaternion(camera.quaternion));
    }
  });

  useFrame((state, delta) => {
    const { mousePressed } = use3DGameStore.getState();
    const maxHeat = 100;
    
    if (mousePressed && heatRef.current < maxHeat) {
      fireCutter(delta);
    } else {
      heatRef.current = Math.max(0, heatRef.current - delta * 15);
      use3DGameStore.getState().setPlayerWeaponHeat?.(heatRef.current);
    }
    
    if (cutterRef.current) {
      const heatRatio = heatRef.current / maxHeat;
      const indicator = cutterRef.current.children.find(c => c.geometry?.type === 'RingGeometry');
      if (indicator) {
        indicator.material.color.setHSL(heatRatio * 0.3, 1, 0.5);
      }
    }
  });

  const fireCutter = (delta) => {
    isFiringRef.current = true;
    heatRef.current = Math.min(100, heatRef.current + delta * 30);
    use3DGameStore.getState().setPlayerWeaponHeat?.(heatRef.current);
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    if (!beamRef.current) {
      const beamGeo = new THREE.CylinderGeometry(0.02, 0.05, 50, 6);
      const beamMat = new THREE.MeshBasicMaterial({ 
        color: 0x00f0ff, 
        transparent: true, 
        opacity: 0.8,
        depthWrite: false,
      });
      beamRef.current = new THREE.Mesh(beamGeo, beamMat);
      scene.add(beamRef.current);
    }
    
    if (beamRef.current) {
      beamRef.current.position.copy(camera.position);
      beamRef.current.rotation.copy(camera.rotation);
      beamRef.current.rotateX(Math.PI / 2);
      beamRef.current.position.z -= 25;
      beamRef.current.scale.y = 1;
      beamRef.current.material.opacity = 0.8;
    }
    
    const intersects = raycaster.intersectObjects(scene.children, true);
    intersects.forEach(hit => {
      if (hit.object.userData?.enemy) {
        hit.object.userData.onHit?.(25);
      }
    });
  };

  return null;
}

// ============================================
// Enemy Manager
// ============================================
function EnemyManager() {
  const { scene } = useThree();
  const { 
    enemies: { active: enemies }, 
    spawnEnemy, 
    killEnemy: killEnemyAction,
    playerDamage,
    setDamageFlash,
  } = use3DGameStore();
  
  const enemiesRef = useRef(new Map());
  const spawnTimerRef = useRef(0);

  useFrame((state, delta) => {
    spawnTimerRef.current += delta;
    if (spawnTimerRef.current > 5) {
      spawnTimerRef.current = 0;
      if (enemiesRef.current.size < 10 && Math.random() < 0.3) {
        spawnEnemyLogic();
      }
    }

    enemiesRef.current.forEach((enemy, id) => {
      updateEnemy(enemy, delta);
    });
  });

  const spawnEnemyLogic = () => {
    const types = ['cache_thrasher', 'db_connection', 'rate_limiter', 'memory_phantom'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const enemy = createEnemy(type);
    const id = `enemy_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    enemy.mesh.position.set(
      (Math.random() - 0.5) * 60,
      1,
      (Math.random() - 0.5) * 60
    );
    
    enemiesRef.current.set(id, { ...enemy, id, type, health: 100, lastAttack: 0 });
    scene.add(enemy.mesh);
    
    spawnEnemy({ 
      id, 
      type, 
      position: [enemy.mesh.position.x, enemy.mesh.position.y, enemy.mesh.position.z],
      state: 'idle',
    });
  };

  const createEnemy = (type) => {
    const group = new THREE.Group();
    
    let color, size;
    switch (type) {
      case 'cache_thrasher': color = 0xff3030; size = 1.5; break;
      case 'db_connection': color = 0xffb000; size = 1.2; break;
      case 'rate_limiter': color = 0xff0080; size = 1; break;
      case 'memory_phantom': color = 0x8000ff; size = 1.8; break;
    }
    
    const bodyGeo = new THREE.SphereGeometry(size * 0.5, 16, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color, 
      emissive: color, 
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.5,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);
    
    const particles = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 20 }, () => new THREE.Vector3(
          (Math.random() - 0.5) * size,
          (Math.random() - 0.5) * size,
          (Math.random() - 0.5) * size
        ))
      ),
      new THREE.PointsMaterial({ color, size: 0.05, transparent: true, opacity: 0.6 })
    );
    group.add(particles);
    
    group.userData.enemy = true;
    group.userData.type = type;
    group.userData.onHit = (damage) => {
      const enemy = enemiesRef.current.get(id);
      if (enemy) {
        enemy.health -= damage;
        if (enemy.health <= 0) {
          killEnemy(id);
        }
      }
    };
    
    return { mesh: group, particles };
  };

  const updateEnemy = (enemy, delta) => {
    const { player: { position: playerPosition } } = use3DGameStore.getState();
    if (!playerPosition) return;
    
    const dir = new THREE.Vector3()
      .subVectors(new THREE.Vector3(playerPosition[0], playerPosition[1], playerPosition[2]), enemy.mesh.position)
      .normalize();
    
    enemy.mesh.position.addScaledVector(dir, delta * 3);
    enemy.mesh.lookAt(playerPosition[0], playerPosition[1], playerPosition[2]);
    
    if (enemy.particles) {
      enemy.particles.rotation.y += delta;
    }
    
    const distance = enemy.mesh.position.distanceTo(new THREE.Vector3(playerPosition[0], playerPosition[1], playerPosition[2]));
    if (distance < 2 && Date.now() - enemy.lastAttack > 1000) {
      enemy.lastAttack = Date.now();
      playerDamage(10);
      setDamageFlash(0.4);
    }
  };

  const killEnemy = (id) => {
    const enemy = enemiesRef.current.get(id);
    if (enemy) {
      scene.remove(enemy.mesh);
      enemiesRef.current.delete(id);
      killEnemyAction(id);
      // Reward - reduce pressure
      use3DGameStore.getState().reducePressure?.(2);
    }
  };

  return null;
}

// ============================================
// Physics World Wrapper
// ============================================
function PhysicsWorld({ children }) {
  return (
    <RapierPhysics
      gravity={GRAVITY}
      fixedTimeStep={FIXED_TIME_STEP}
      maxSubSteps={MAX_SUB_STEPS}
      debug={false}
    >
      {children}
    </RapierPhysics>
  );
}

// ============================================
// Player Physics Body
// ============================================
function PlayerBody({ position = [0, 2, 0] }) {
  return (
    <RigidBody
      name="player"
      type="dynamic"
      position={position}
      colliders={[
        { 
          shape: 'capsule', 
          args: [0.5, 1.7], 
          friction: 0.1, 
          restitution: 0,
          collisionGroups: 1,
          collidesWithGroups: -1,
        },
      ]}
      ccd={true}
      lockRotation={true}
    />
  );
}

// ============================================
// Main 3D App Component
// ============================================
export function Mode3DApp() {
  const { 
    phase, 
    loop: { sanityBaseline, count: loopCount },
    player: { health: playerHealth, maxHealth: playerMaxHealth },
    setPlayerPosition,
    setPlayerRotation,
  } = use3DGameStore();
  
  const composerRef = useRef(null);
  const canvasRef = useRef(null);
  
  useStingerQueue();
  useLoopTransitionAudio();
  
  useDynamicPostFX(composerRef);

  useEffect(() => {
    if (phase === 'defeat' || phase === 'victory') {
      document.exitPointerLock?.();
    }
  }, [phase]);

  useFrame((state, delta) => {
    if (composerRef.current && state.gl) {
      composerRef.current.render(delta);
    } else if (state.gl) {
      state.gl.render(state.scene, state.camera);
    }
  }, 1);

  const onCreated = useCallback(({ gl, scene, camera }) => {
    window.__THREE_RENDERER__ = gl;
    window.__THREE_SCENE__ = scene;
    window.__THREE_CAMERA__ = camera;
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Canvas
        ref={canvasRef}
        onCreated={onCreated}
        camera={{ position: [0, 1.7, 5], fov: 75 }}
        gl={{ 
          antialias: true, 
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
        }}
        shadows={true}
        shadowMapType={THREE.PCFSoftShadowMap}
        toneMapping={THREE.ACESFilmicToneMapping}
        toneMappingExposure={1.2}
      >
        <ambientLight color={0x101020} intensity={0.3} />
        <directionalLight 
          position={[-10, 30, 10]} 
          intensity={2} 
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={100}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
          shadow-bias={-0.001}
        />
        <hemisphereLight color={0x00f0ff} groundColor={0x1a1a2e} intensity={0.5} />
        
        <PhysicsWorld>
          <PlayerBody position={[0, 2, 0]} />
        </PhysicsWorld>
        
        <LevelGeometry missionTheme="standard" />
        
        <MissionManager autoStart />
        <EnemyManager />
        <PlasmaCutter />
        <FPSController 
          onPositionChange={(pos) => {
            setPlayerPosition([pos.x, pos.y, pos.z]);
          }}
          onRotationChange={(rot) => {
            setPlayerRotation(rot.y, rot.x);
          }}
        />
        <AmbienceZones />
        
        <PostFXPipeline onComposerReady={(comp) => { composerRef.current = comp; }} />
      </Canvas>
      
      <VisorHUD />
      
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: 10,
          left: 10,
          color: '#00f0ff',
          fontFamily: 'monospace',
          fontSize: '12px',
          zIndex: 1000,
          pointerEvents: 'none',
        }}>
          <div>Phase: {phase}</div>
          <div>Sanity: {sanityBaseline}/100</div>
          <div>Loop: {loopCount}</div>
          <div>Health: {playerHealth}/{playerMaxHealth}</div>
        </div>
      )}
    </div>
  );
}

export default Mode3DApp;
