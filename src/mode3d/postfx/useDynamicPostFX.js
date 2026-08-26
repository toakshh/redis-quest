import { useEffect, useRef } from 'react';
import { use3DGameStore } from '../../stores/use3DGameStore';

/**
 * Hook connecting sanity/damageFlash/loop state to post-processing parameters
 * Dynamically adjusts chromatic aberration, vignette, noise, bloom, and DOF based on game state
 */
export function useDynamicPostFX(composerRef) {
  const {
    player: { health: playerHealth, maxHealth: playerMaxHealth },
    loop: { count: loopCount, sanityBaseline },
    mission: { pressure },
    environment: { lighting: { flicker } },
    phase,
  } = use3DGameStore();

  const prevPressureRef = useRef(pressure);
  const prevLoopCountRef = useRef(loopCount);
  const prevFlickerRef = useRef(flicker);
  const transitionTimerRef = useRef(0);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    if (!composerRef.current) return;

    const passes = composerRef.current.passes;
    if (!passes) return;

    // Find specific passes by name/type
    const chromaticPass = passes.find(p => p.name === 'ChromaticAberration');
    const vignettePass = passes.find(p => p.name === 'Vignette');
    const noisePass = passes.find(p => p.name === 'Noise');
    const bloomPass = passes.find(p => p.name === 'UnrealBloomPass');
    const dofPass = passes.find(p => p.name === 'DepthOfField');
    const ssaoPass = passes.find(p => p.name === 'SSAO');
    const crtPass = passes.find(p => p.name === 'CRTDistortion');

    // Sanity derived from pressure and loop state
    // sanityBaseline starts at 100, decreases by 5 per loop
    const sanityRatio = Math.max(0, sanityBaseline / 100);
    const healthRatio = playerHealth / playerMaxHealth;
    const loopIntensity = Math.min(loopCount / 5, 1);
    const pressureRatio = pressure / 100;
    const isInLoop = phase === 'loopTransition' || phase === 'playing';

    // --- Chromatic Aberration ---
    if (chromaticPass) {
      let offset = 0;
      
      // Base sanity effect: 0 at full sanity, up to 0.015 at 0 sanity
      offset += (1 - sanityRatio) * 0.015;
      
      // Pressure effect
      offset += pressureRatio * 0.01;
      
      // Flicker spike
      if (flicker > 0) {
        offset += flicker * 0.02;
      }
      
      // Loop distortion
      if (isInLoop) {
        offset += loopIntensity * 0.008 * (1 + Math.sin(transitionTimerRef.current * 3) * 0.3);
      }
      
      chromaticPass.uniforms.offset.value.set(offset, offset * 0.7);
    }

    // --- Vignette ---
    if (vignettePass) {
      let darkness = 0.3;
      let offset = 0.45;
      
      darkness += (1 - sanityRatio) * 0.5;
      offset -= (1 - sanityRatio) * 0.15;
      
      // Pressure
      darkness += pressureRatio * 0.3;
      offset -= pressureRatio * 0.1;
      
      // Flicker
      if (flicker > 0) {
        darkness += flicker * 0.3;
        offset -= flicker * 0.1;
      }
      
      // Health critical
      if (healthRatio < 0.25) {
        darkness += (0.25 - healthRatio) * 1.2;
      }
      
      vignettePass.uniforms.darkness.value = Math.min(darkness, 0.95);
      vignettePass.uniforms.offset.value = Math.max(offset, 0.1);
    }

    // --- Noise / Film Grain ---
    if (noisePass) {
      let intensity = 0.02;
      
      intensity += (1 - sanityRatio) * 0.15;
      intensity += pressureRatio * 0.1;
      
      if (flicker > 0) {
        intensity += flicker * 0.2;
      }
      
      if (isInLoop) {
        intensity += loopIntensity * 0.1 * (1 + Math.sin(transitionTimerRef.current * 5) * 0.5);
      }
      
      if (healthRatio < 0.3) {
        intensity += (0.3 - healthRatio) * 0.3;
      }
      
      noisePass.uniforms.intensity.value = Math.min(intensity, 0.5);
      noisePass.uniforms.time.value = performance.now() * 0.001;
    }

    // --- CRT Distortion (for sanity glitches) ---
    if (crtPass) {
      let distortion = 0;
      
      distortion += (1 - sanityRatio) * 0.05;
      distortion += pressureRatio * 0.03;
      
      if (flicker > 0) {
        distortion += flicker * 0.1;
      }
      
      if (isInLoop) {
        distortion += loopIntensity * 0.02 * (1 + Math.sin(transitionTimerRef.current * 2) * 0.5);
      }
      
      crtPass.uniforms.distortion.value = Math.min(distortion, 0.15);
      crtPass.uniforms.time.value = performance.now() * 0.001;
    }

    // --- Bloom ---
    if (bloomPass) {
      let strength = 0.4;
      let radius = 0.6;
      let threshold = 0.85;
      
      if (flicker > 0) {
        strength += flicker * 1.2;
        radius += flicker * 0.4;
        threshold -= flicker * 0.3;
      }
      
      if (isInLoop) {
        strength += loopIntensity * 0.5;
        radius += loopIntensity * 0.3;
        threshold -= loopIntensity * 0.15;
      }
      
      if (sanityRatio < 0.5) {
        strength += (0.5 - sanityRatio) * 0.4;
      }
      
      bloomPass.strength = Math.min(strength, 2.5);
      bloomPass.radius = Math.min(radius, 1.5);
      bloomPass.threshold = Math.max(threshold, 0.1);
    }

    // --- Depth of Field ---
    if (dofPass) {
      let focus = 10;
      let aperture = 0.0001;
      let maxblur = 0.01;
      
      if (isInLoop) {
        aperture += loopIntensity * 0.0005;
        maxblur += loopIntensity * 0.02;
      }
      
      if (flicker > 0) {
        aperture += flicker * 0.001;
        maxblur += flicker * 0.03;
      }
      
      dofPass.uniforms.focus.value = focus;
      dofPass.uniforms.aperture.value = aperture;
      dofPass.uniforms.maxblur.value = Math.min(maxblur, 0.05);
    }

    // --- SSAO ---
    if (ssaoPass) {
      let intensity = 0.5;
      let radius = 0.5;
      
      if (isInLoop) {
        intensity += loopIntensity * 0.3;
        radius += loopIntensity * 0.2;
      }
      
      ssaoPass.uniforms.intensity.value = Math.min(intensity, 1.2);
      ssaoPass.uniforms.radius.value = Math.min(radius, 1.0);
    }

    // Update transition timer
    const updateTimer = () => {
      transitionTimerRef.current += 1/60;
      
      if (pressure !== prevPressureRef.current) {
        isTransitioningRef.current = true;
        prevPressureRef.current = pressure;
      }
      if (loopCount !== prevLoopCountRef.current) {
        isTransitioningRef.current = true;
        prevLoopCountRef.current = loopCount;
      }
      if (flicker !== prevFlickerRef.current) {
        isTransitioningRef.current = true;
        prevFlickerRef.current = flicker;
      }
      
      if (isTransitioningRef.current) {
        setTimeout(() => { isTransitioningRef.current = false; }, 100);
      }
      
      requestAnimationFrame(updateTimer);
    };
    
    requestAnimationFrame(updateTimer);

  }, [pressure, loopCount, phase, flicker, sanityBaseline, playerHealth, composerRef]);

  return { triggerDamageFlash: () => {} };
}

export default useDynamicPostFX;
