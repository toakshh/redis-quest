import React, { useRef, useEffect, useMemo } from 'react';
import { extend, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  ShaderPass,
  UnrealBloomPass,
  SSAOPass,
  DepthOfFieldPass,
} from 'three/examples/jsm/postprocessing/index.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

// Extend Three.js post-processing classes for R3F
extend({
  EffectComposer,
  RenderPass,
  ShaderPass,
  UnrealBloomPass,
  SSAOPass,
  DepthOfFieldPass,
  SMAAPass,
});

// --- Custom Shader Passes ---

// Chromatic Aberration Shader
const ChromaticAberrationShader = {
  name: 'ChromaticAberration',
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: new THREE.Vector2(0, 0) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 offset;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv;
      vec4 color = vec4(
        texture2D(tDiffuse, uv + offset).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - offset).b,
        1.0
      );
      gl_FragColor = color;
    }
  `,
};

// Vignette Shader
const VignetteShader = {
  name: 'Vignette',
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.45 },
    darkness: { value: 0.3 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      float vig = smoothstep(offset, offset + 0.5, dist);
      color.rgb = mix(color.rgb, vec3(0.0), vig * darkness);
      gl_FragColor = color;
    }
  `,
};

// Noise / Film Grain Shader
const NoiseShader = {
  name: 'Noise',
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.02 },
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform float time;
    uniform vec2 resolution;
    varying vec2 vUv;
    
    // Random noise function
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    float noise(vec2 uv) {
      vec2 i = floor(uv);
      vec2 f = fract(uv);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(rand(i), rand(i + vec2(1.0, 0.0)), f.x),
        mix(rand(i + vec2(0.0, 1.0)), rand(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      // Animated noise
      vec2 noiseUV = vUv * resolution / 256.0 + time * 0.1;
      float n = noise(noiseUV) - 0.5;
      
      // Scanlines
      float scanline = sin(vUv.y * resolution.y * 0.5 + time * 10.0) * 0.02;
      
      color.rgb += (n + scanline) * intensity;
      gl_FragColor = color;
    }
  `,
};

// CRT/Scanline Distortion Shader (for sanity effects)
const CRTShader = {
  name: 'CRTDistortion',
  uniforms: {
    tDiffuse: { value: null },
    distortion: { value: 0 },
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float distortion;
    uniform float time;
    uniform vec2 resolution;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv;
      
      // Barrel distortion
      vec2 center = vec2(0.5);
      vec2 dir = uv - center;
      float dist = length(dir);
      float distortionFactor = 1.0 + distortion * dist * dist;
      uv = center + dir * distortionFactor;
      
      // Horizontal line distortion (VHS tracking error)
      float lineDistortion = sin(uv.y * resolution.y * 2.0 + time * 20.0) * distortion * 0.01;
      uv.x += lineDistortion;
      
      // RGB shift on scanlines
      vec4 color = texture2D(tDiffuse, uv);
      float r = texture2D(tDiffuse, uv + vec2(distortion * 0.002, 0)).r;
      float b = texture2D(tDiffuse, uv - vec2(distortion * 0.002, 0)).b;
      color.r = r;
      color.b = b;
      
      // Scanline darkening
      float scanline = sin(uv.y * resolution.y * 0.5) * 0.03;
      color.rgb -= scanline * (1.0 - distortion);
      
      gl_FragColor = color;
    }
  `,
};

// --- PostFXPipeline Component ---

/**
 * Full post-processing pipeline with:
 * - SSAO (Screen Space Ambient Occlusion)
 * - Unreal Bloom
 * - Depth of Field
 * - Chromatic Aberration
 * - Vignette
 * - Noise/Film Grain
 * - CRT Distortion (sanity-based)
 * - SMAA Anti-aliasing
 */
export function PostFXPipeline({ 
  enabled = true, 
  resolution = new THREE.Vector2(1920, 1080),
  onComposerReady 
}) {
  const composerRef = useRef(null);
  const renderTargetRef = useRef(null);
  const passesRef = useRef({});

  // Create render target
  useEffect(() => {
    renderTargetRef.current = new THREE.WebGLRenderTarget(
      resolution.x,
      resolution.y,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        depthBuffer: true,
        stencilBuffer: false,
      }
    );
    
    return () => {
      renderTargetRef.current?.dispose();
    };
  }, [resolution.x, resolution.y]);

  // Create composer and passes
  const composer = useMemo(() => {
    if (!renderTargetRef.current) return null;
    
    const comp = new EffectComposer(
      typeof window !== 'undefined' ? window.__THREE_RENDERER__ : null,
      renderTargetRef.current
    );
    
    // We'll add passes manually in useEffect since we need the renderer
    return comp;
  }, [resolution.x, resolution.y]);

  useEffect(() => {
    if (!composer || !window.__THREE_RENDERER__ || !window.__THREE_SCENE__ || !window.__THREE_CAMERA__) {
      return;
    }

    const renderer = window.__THREE_RENDERER__;
    const scene = window.__THREE_SCENE__;
    const camera = window.__THREE_CAMERA__;

    // Recreate composer with actual renderer
    const newComposer = new EffectComposer(renderer, renderTargetRef.current);
    
    // 1. Render Pass
    const renderPass = new RenderPass(scene, camera);
    newComposer.addPass(renderPass);
    passesRef.current.renderPass = renderPass;

    // 2. SSAO Pass
    const ssaoPass = new SSAOPass(scene, camera, resolution.x, resolution.y);
    ssaoPass.name = 'SSAO';
    ssaoPass.kernelRadius = 8;
    ssaoPass.minDistance = 0.005;
    ssaoPass.maxDistance = 0.1;
    ssaoPass.intensity = 0.5;
    newComposer.addPass(ssaoPass);
    passesRef.current.ssaoPass = ssaoPass;

    // 3. Unreal Bloom Pass
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(resolution.x, resolution.y),
      0.4,  // strength
      0.6,  // radius
      0.85  // threshold
    );
    bloomPass.name = 'UnrealBloomPass';
    bloomPass.threshold = 0.85;
    bloomPass.strength = 0.4;
    bloomPass.radius = 0.6;
    newComposer.addPass(bloomPass);
    passesRef.current.bloomPass = bloomPass;

    // 4. Depth of Field Pass
    const dofPass = new DepthOfFieldPass(
      camera,
      new THREE.Vector2(resolution.x, resolution.y),
      10,    // focus
      0.0001, // aperture
      0.01   // maxblur
    );
    dofPass.name = 'DepthOfField';
    newComposer.addPass(dofPass);
    passesRef.current.dofPass = dofPass;

    // 5. Chromatic Aberration Shader Pass
    const chromaticPass = new ShaderPass(ChromaticAberrationShader);
    chromaticPass.name = 'ChromaticAberration';
    newComposer.addPass(chromaticPass);
    passesRef.current.chromaticPass = chromaticPass;

    // 6. Vignette Shader Pass
    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.name = 'Vignette';
    newComposer.addPass(vignettePass);
    passesRef.current.vignettePass = vignettePass;

    // 7. Noise/Film Grain Shader Pass
    const noisePass = new ShaderPass(NoiseShader);
    noisePass.name = 'Noise';
    noisePass.uniforms.resolution.value.set(resolution.x, resolution.y);
    newComposer.addPass(noisePass);
    passesRef.current.noisePass = noisePass;

    // 8. CRT Distortion Shader Pass (for sanity glitches)
    const crtPass = new ShaderPass(CRTShader);
    crtPass.name = 'CRTDistortion';
    crtPass.uniforms.resolution.value.set(resolution.x, resolution.y);
    newComposer.addPass(crtPass);
    passesRef.current.crtPass = crtPass;

    // 9. SMAA Pass (last)
    const smaaPass = new SMAAPass(
      resolution.x * renderer.getPixelRatio(),
      resolution.y * renderer.getPixelRatio()
    );
    newComposer.addPass(smaaPass);
    passesRef.current.smaaPass = smaaPass;

    // Store passes array for dynamic access
    newComposer.passes = [
      renderPass,
      ssaoPass,
      bloomPass,
      dofPass,
      chromaticPass,
      vignettePass,
      noisePass,
      crtPass,
      smaaPass,
    ];

    composerRef.current = newComposer;
    
    if (onComposerReady) {
      onComposerReady(newComposer);
    }

    return () => {
      newComposer.passes.forEach(p => {
        if (p.dispose) p.dispose();
        if (p.material) p.material.dispose();
      });
      composerRef.current = null;
    };
  }, [composer, resolution.x, resolution.y]);

  // Render loop handled by parent (Mode3DApp)
  // This component just sets up the composer

  return null; // No DOM output - this is a setup component
}

/**
 * PostFXRenderer - Actually renders the composer each frame
 * Use this as a child of Canvas in the render loop
 */
export function PostFXRenderer({ composer, enabled = true }) {
  const { gl, scene, camera, size, viewport } = useThree();
  
  useEffect(() => {
    if (!composer || !enabled) return;
    
    // Composer is rendered externally in Mode3DApp's useFrame
    // This component exists to participate in R3F's render cycle
  }, [composer, enabled]);

  return null;
}

export default PostFXPipeline;
