/**
 * Web Audio API spatial engine with PannerNode, HRTF
 * Manages 3D audio positioning, distance attenuation, and environmental effects
 */

class Audio3DEngine {
  constructor() {
    this.audioContext = null;
    this.listener = null;
    this.masterGain = null;
    this.ambienceGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    
    // Audio buffers cache
    this.buffers = new Map();
    this.sources = new Map(); // Active playing sources
    
    // Panner nodes for spatial audio
    this.panners = new Map();
    
    // Environmental reverb
    this.convolver = null;
    this.reverbGain = null;
    
    // HRTF support
    this.hrtfEnabled = true;
    
    // Distance model
    this.distanceModel = 'exponential';
    this.rolloffFactor = 1;
    this.refDistance = 1;
    this.maxDistance = 100;
    
    // Listener position/orientation
    this.listenerPosition = { x: 0, y: 0, z: 0 };
    this.listenerOrientation = { forward: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 0, z: 1 } };
  }

  /**
   * Initialize the audio context
   */
  async init() {
    if (this.audioContext) return this.audioContext;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 48000,
      });

      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.listener = this.audioContext.listener;
      
      // Master gain chain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.audioContext.destination);

      // Category gains
      this.ambienceGain = this.audioContext.createGain();
      this.ambienceGain.gain.value = 0.4;
      this.ambienceGain.connect(this.masterGain);

      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.audioContext.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.masterGain);

      // Reverb chain
      this.convolver = this.audioContext.createConvolver();
      this.reverbGain = this.audioContext.createGain();
      this.reverbGain.gain.value = 0.3;
      this.convolver.connect(this.reverbGain);
      this.reverbGain.connect(this.masterGain);

      // Generate impulse response for reverb
      this._generateImpulseResponse();

      console.log('[Audio3DEngine] Initialized');
      return this.audioContext;
    } catch (error) {
      console.error('[Audio3DEngine] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Generate procedural impulse response for reverb
   */
  _generateImpulseResponse() {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 2; // 2 seconds
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with some randomness
        const decay = Math.exp(-i / (sampleRate * 0.5));
        channelData[i] = (Math.random() * 2 - 1) * decay * 0.1;
      }
    }
    
    this.convolver.buffer = impulse;
  }

  /**
   * Update listener position and orientation
   */
  updateListener(position, rotation) {
    if (!this.listener) return;

    this.listenerPosition = position;
    this.listenerOrientation = rotation;

    // Update Web Audio listener
    if (this.listener.positionX) {
      // Modern API
      this.listener.positionX.setTargetAtTime(position.x, this.audioContext.currentTime, 0.05);
      this.listener.positionY.setTargetAtTime(position.y, this.audioContext.currentTime, 0.05);
      this.listener.positionZ.setTargetAtTime(position.z, this.audioContext.currentTime, 0.05);
      
      this.listener.forwardX.setTargetAtTime(rotation.forward.x, this.audioContext.currentTime, 0.05);
      this.listener.forwardY.setTargetAtTime(rotation.forward.y, this.audioContext.currentTime, 0.05);
      this.listener.forwardZ.setTargetAtTime(rotation.forward.z, this.audioContext.currentTime, 0.05);
      
      this.listener.upX.setTargetAtTime(rotation.up.x, this.audioContext.currentTime, 0.05);
      this.listener.upY.setTargetAtTime(rotation.up.y, this.audioContext.currentTime, 0.05);
      this.listener.upZ.setTargetAtTime(rotation.up.z, this.audioContext.currentTime, 0.05);
    } else {
      // Deprecated API
      this.listener.setPosition(position.x, position.y, position.z);
      this.listener.setOrientation(
        rotation.forward.x, rotation.forward.y, rotation.forward.z,
        rotation.up.x, rotation.up.y, rotation.up.z
      );
    }
  }

  /**
   * Load audio buffer from URL
   */
  async loadBuffer(id, url) {
    if (!this.audioContext) await this.init();
    
    if (this.buffers.has(id)) return this.buffers.get(id);

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.buffers.set(id, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error(`[Audio3DEngine] Failed to load ${id}:`, error);
      // Generate procedural fallback
      return this._generateProceduralBuffer(id);
    }
  }

  /**
   * Generate procedural audio buffer for missing files
   */
  _generateProceduralBuffer(id) {
    const sampleRate = this.audioContext.sampleRate;
    let buffer;

    switch (id) {
      case 'hum':
        // Low frequency server room hum
        buffer = this.audioContext.createBuffer(1, sampleRate * 10, sampleRate);
        const humData = buffer.getChannelData(0);
        for (let i = 0; i < humData.length; i++) {
          humData[i] = Math.sin(i * 0.001) * 0.1 + Math.sin(i * 0.0015) * 0.05;
        }
        break;
      case 'click':
        buffer = this.audioContext.createBuffer(1, sampleRate * 0.1, sampleRate);
        const clickData = buffer.getChannelData(0);
        for (let i = 0; i < clickData.length; i++) {
          clickData[i] = Math.exp(-i * 50) * Math.sin(i * 0.5) * 0.5;
        }
        break;
      case 'glitch':
        buffer = this.audioContext.createBuffer(1, sampleRate * 0.5, sampleRate);
        const glitchData = buffer.getChannelData(0);
        for (let i = 0; i < glitchData.length; i++) {
          glitchData[i] = (Math.random() * 2 - 1) * Math.exp(-i * 10) * 0.3;
        }
        break;
      case 'stinger':
        buffer = this.audioContext.createBuffer(1, sampleRate * 2, sampleRate);
        const stingerData = buffer.getChannelData(0);
        for (let i = 0; i < stingerData.length; i++) {
          const t = i / sampleRate;
          stingerData[i] = Math.sin(t * 200) * Math.exp(-t * 3) * 0.5;
        }
        break;
      default:
        buffer = this.audioContext.createBuffer(1, sampleRate, sampleRate);
    }

    this.buffers.set(id, buffer);
    return buffer;
  }

  /**
   * Create a spatial audio source
   */
  createSource(id, options = {}) {
    if (!this.audioContext) return null;

    const {
      bufferId,
      position = { x: 0, y: 0, z: 0 },
      loop = false,
      volume = 1,
      category = 'sfx', // 'sfx', 'ambience', 'music'
      spatial = true,
      rolloffFactor = this.rolloffFactor,
      refDistance = this.refDistance,
      maxDistance = this.maxDistance,
      coneInnerAngle = 360,
      coneOuterAngle = 360,
      coneOuterGain = 0,
    } = options;

    const buffer = this.buffers.get(bufferId);
    if (!buffer) {
      console.warn(`[Audio3DEngine] Buffer ${bufferId} not loaded`);
      return null;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    // Gain for this source
    const gain = this.audioContext.createGain();
    gain.gain.value = volume;

    // Spatial panner
    let panner = null;
    if (spatial) {
      panner = this.audioContext.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = this.distanceModel;
      panner.rolloffFactor = rolloffFactor;
      panner.refDistance = refDistance;
      panner.maxDistance = maxDistance;
      panner.coneInnerAngle = coneInnerAngle;
      panner.coneOuterAngle = coneOuterAngle;
      panner.coneOuterGain = coneOuterGain;
      
      // Set initial position
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;

      // Connect: source -> panner -> gain -> category gain
      source.connect(panner);
      panner.connect(gain);
    } else {
      source.connect(gain);
    }

    // Connect to appropriate category gain
    const categoryGain = this[`${category}Gain`] || this.sfxGain;
    gain.connect(categoryGain);

    // Also send to reverb for spatial sources
    if (spatial && this.reverbGain) {
      const reverbSend = this.audioContext.createGain();
      reverbSend.gain.value = 0.2;
      if (panner) {
        panner.connect(reverbSend);
      } else {
        gain.connect(reverbSend);
      }
      reverbSend.connect(this.convolver);
    }

    // Store for management
    const sourceObj = {
      source,
      gain,
      panner,
      bufferId,
      loop,
      category,
      spatial,
      startTime: this.audioContext.currentTime,
    };

    this.sources.set(id, sourceObj);
    this.panners.set(id, panner);

    return id;
  }

  /**
   * Play a source
   */
  play(id, when = 0) {
    const sourceObj = this.sources.get(id);
    if (!sourceObj) return false;

    try {
      sourceObj.source.start(this.audioContext.currentTime + when);
      return true;
    } catch (error) {
      console.error(`[Audio3DEngine] Failed to play ${id}:`, error);
      return false;
    }
  }

  /**
   * Stop a source
   */
  stop(id, when = 0) {
    const sourceObj = this.sources.get(id);
    if (!sourceObj) return false;

    try {
      sourceObj.source.stop(this.audioContext.currentTime + when);
      this._cleanupSource(id);
      return true;
    } catch (error) {
      console.error(`[Audio3DEngine] Failed to stop ${id}:`, error);
      return false;
    }
  }

  /**
   * Update source position
   */
  setSourcePosition(id, position) {
    const panner = this.panners.get(id);
    if (!panner) return false;

    if (panner.positionX) {
      panner.positionX.setTargetAtTime(position.x, this.audioContext.currentTime, 0.05);
      panner.positionY.setTargetAtTime(position.y, this.audioContext.currentTime, 0.05);
      panner.positionZ.setTargetAtTime(position.z, this.audioContext.currentTime, 0.05);
    } else {
      panner.setPosition(position.x, position.y, position.z);
    }
    return true;
  }

  /**
   * Set source volume
   */
  setSourceVolume(id, volume, rampTime = 0.1) {
    const sourceObj = this.sources.get(id);
    if (!sourceObj) return false;

    const now = this.audioContext.currentTime;
    sourceObj.gain.gain.setTargetAtTime(volume, now, rampTime);
    return true;
  }

  /**
   * Set category volume
   */
  setCategoryVolume(category, volume, rampTime = 0.1) {
    const gain = this[`${category}Gain`];
    if (!gain) return false;

    const now = this.audioContext.currentTime;
    gain.gain.setTargetAtTime(volume, now, rampTime);
    return true;
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume, rampTime = 0.1) {
    if (!this.masterGain) return false;
    const now = this.audioContext.currentTime;
    this.masterGain.gain.setTargetAtTime(volume, now, rampTime);
    return true;
  }

  /**
   * Play one-shot sound at position
   */
  async playOneShot(bufferId, position, options = {}) {
    const id = `oneshot_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    this.createSource(id, {
      bufferId,
      position,
      loop: false,
      spatial: true,
      ...options,
    });

    this.play(id);
    
    // Auto-cleanup after buffer duration + margin
    const buffer = this.buffers.get(bufferId);
    if (buffer) {
      setTimeout(() => this._cleanupSource(id), buffer.duration * 1000 + 100);
    }

    return id;
  }

  /**
   * Cleanup finished source
   */
  _cleanupSource(id) {
    const sourceObj = this.sources.get(id);
    if (sourceObj) {
      try {
        sourceObj.source.disconnect();
        sourceObj.gain.disconnect();
        if (sourceObj.panner) sourceObj.panner.disconnect();
      } catch (e) {}
      this.sources.delete(id);
      this.panners.delete(id);
    }
  }

  /**
   * Get active source count
   */
  getActiveSourceCount() {
    return this.sources.size;
  }

  /**
   * Suspend/resume audio context
   */
  suspend() {
    return this.audioContext?.suspend();
  }

  resume() {
    return this.audioContext?.resume();
  }

  /**
   * Cleanup all resources
   */
  dispose() {
    this.sources.forEach((_, id) => this._cleanupSource(id));
    this.buffers.clear();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Singleton instance
let audioEngineInstance = null;

export function getAudioEngine() {
  if (!audioEngineInstance) {
    audioEngineInstance = new Audio3DEngine();
  }
  return audioEngineInstance;
}

export function createAudioEngine() {
  return new Audio3DEngine();
}

export default Audio3DEngine;
