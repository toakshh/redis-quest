/**
 * BGSAVE snapshot loop reset reverse-pitch playback
 * Handles audio for the BGSAVE snapshot loop mechanic
 */

import { getAudioEngine } from './Audio3DEngine';

class LoopTransitionAudio {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.isTransitioning = false;
    this.loopCount = 0;
    this.snapshotBuffer = null;
    this.reverseSource = null;
    this.transitionStartTime = 0;
    
    this.phases = {
      PRE_SNAPSHOT: 'pre_snapshot',
      SNAPSHOT: 'snapshot',
      REVERSE_PLAYBACK: 'reverse',
      LOOP_RESET: 'reset',
      POST_LOOP: 'post_loop',
    };
    
    this.currentPhase = this.phases.PRE_SNAPSHOT;
  }

  async init() {
    const engine = this.audioEngine;
    
    await Promise.all([
      engine.loadBuffer('bgsave_start', '/audio/loop/bgsave_start.ogg'),
      engine.loadBuffer('bgsave_complete', '/audio/loop/bgsave_complete.ogg'),
      engine.loadBuffer('reverse_windup', '/audio/loop/reverse_windup.ogg'),
      engine.loadBuffer('reverse_playback', '/audio/loop/reverse_playback.ogg'),
      engine.loadBuffer('loop_reset', '/audio/loop/loop_reset.ogg'),
      engine.loadBuffer('loop_echo', '/audio/loop/loop_echo.ogg'),
    ]).catch(() => {
      this._generateProceduralSounds();
    });
  }

  _generateProceduralSounds() {
    const ctx = this.audioEngine.audioContext;
    const sr = ctx.sampleRate;

    const bgsaveStart = ctx.createBuffer(1, sr * 1.5, sr);
    const d1 = bgsaveStart.getChannelData(0);
    for (let i = 0; i < d1.length; i++) {
      const t = i / sr;
      const freq = 440 * Math.exp(-t * 1.5);
      d1[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 0.8) * 0.4;
    }
    this.audioEngine.buffers.set('bgsave_start', bgsaveStart);

    const revWindup = ctx.createBuffer(1, sr * 2, sr);
    const d2 = revWindup.getChannelData(0);
    for (let i = 0; i < d2.length; i++) {
      const t = i / sr;
      const freq = 100 * Math.exp(t * 2);
      d2[i] = (Math.sin(2 * Math.PI * freq * t) + Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.5) 
        * Math.exp(-t * 0.3) * 0.3;
    }
    this.audioEngine.buffers.set('reverse_windup', revWindup);

    const revPlayback = ctx.createBuffer(2, sr * 4, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = revPlayback.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const freq = 880 * Math.exp(-t * 0.5);
        d[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 0.2) * 0.2;
      }
    }
    this.audioEngine.buffers.set('reverse_playback', revPlayback);

    const reset = ctx.createBuffer(1, sr * 1, sr);
    const d3 = reset.getChannelData(0);
    for (let i = 0; i < d3.length; i++) {
      const t = i / sr;
      d3[i] = (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.6;
    }
    this.audioEngine.buffers.set('loop_reset', reset);

    const echo = ctx.createBuffer(2, sr * 3, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = echo.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        d[i] = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t * 1.5) * 0.15;
      }
    }
    this.audioEngine.buffers.set('loop_echo', echo);
  }

  async startSnapshot(loopCount) {
    if (this.isTransitioning) return;
    
    this.isTransitioning = true;
    this.loopCount = loopCount;
    this.currentPhase = this.phases.PRE_SNAPSHOT;
    this.transitionStartTime = this.audioEngine.audioContext.currentTime;

    await this._playPhase('bgsave_start', { volume: 0.7, spatial: false });
    await this._wait(1500);

    this.currentPhase = this.phases.SNAPSHOT;
    await this._playPhase('bgsave_complete', { volume: 0.6, spatial: false });
    await this._wait(500);

    this.currentPhase = this.phases.REVERSE_PLAYBACK;
    await this._playPhase('reverse_windup', { volume: 0.8, spatial: false });
    await this._wait(1000);

    await this._playReversePlayback();
    await this._wait(3000);

    this.currentPhase = this.phases.LOOP_RESET;
    await this._playPhase('loop_reset', { volume: 1.0, spatial: false });
    await this._wait(300);

    this.currentPhase = this.phases.POST_LOOP;
    await this._playLoopEchoes();

    this.isTransitioning = false;
    this.currentPhase = this.phases.PRE_SNAPSHOT;
  }

  async _playReversePlayback() {
    const engine = this.audioEngine;
    const ctx = engine.audioContext;
    
    const buffer = engine.buffers.get('reverse_playback');
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 0.5;
    
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;
    
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    
    delay.connect(feedback);
    feedback.connect(delay);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(engine.masterGain);
    gain.connect(delay);
    delay.connect(engine.masterGain);

    source.start(ctx.currentTime);
    this.reverseSource = { source, gain, filter, delay, feedback };

    const modulateFilter = () => {
      if (!this.reverseSource || this.currentPhase !== this.phases.REVERSE_PLAYBACK) return;
      
      const elapsed = ctx.currentTime - this.transitionStartTime;
      const progress = Math.min(elapsed / 3, 1);
      
      this.reverseSource.filter.frequency.setTargetAtTime(
        800 + progress * 3000,
        ctx.currentTime,
        0.1
      );
      
      this.reverseSource.delay.delayTime.setTargetAtTime(
        0.3 + Math.sin(elapsed * 5) * 0.1,
        ctx.currentTime,
        0.05
      );
      
      requestAnimationFrame(modulateFilter);
    };
    
    modulateFilter();
  }

  async _playLoopEchoes() {
    const engine = this.audioEngine;
    const ctx = engine.audioContext;
    
    for (let i = 0; i < 3; i++) {
      const buffer = engine.buffers.get('loop_echo');
      if (!buffer) continue;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      
      const gain = ctx.createGain();
      gain.gain.value = 0.3 * (1 - i * 0.25);
      
      source.playbackRate.value = 1 - i * 0.15;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 440 * (1 - i * 0.2);
      filter.Q.value = 5;
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(engine.masterGain);
      
      source.start(ctx.currentTime + i * 0.8);
      
      await this._wait(800);
    }
  }

  async _playPhase(bufferId, options = {}) {
    const engine = this.audioEngine;
    const ctx = engine.audioContext;
    
    const buffer = engine.buffers.get(bufferId);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const gain = ctx.createGain();
    gain.gain.value = options.volume || 0.5;
    
    if (options.spatial) {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      source.connect(panner);
      panner.connect(gain);
    } else {
      source.connect(gain);
    }
    
    gain.connect(engine.masterGain);
    source.start(ctx.currentTime);
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getPhase() {
    return this.currentPhase;
  }

  cancel() {
    if (this.reverseSource) {
      try {
        this.reverseSource.source.stop();
        this.reverseSource.source.disconnect();
        this.reverseSource.gain.disconnect();
        this.reverseSource.filter.disconnect();
        this.reverseSource.delay.disconnect();
        this.reverseSource.feedback.disconnect();
      } catch (e) {}
      this.reverseSource = null;
    }
    
    this.isTransitioning = false;
    this.currentPhase = this.phases.PRE_SNAPSHOT;
  }

  async triggerLoopEntry() {
    await this._playPhase('bgsave_start', { volume: 0.5, spatial: false });
    await this._wait(300);
    await this._playPhase('reverse_windup', { volume: 0.4, spatial: false });
  }

  async triggerLoopExit() {
    await this._playPhase('loop_reset', { volume: 0.6, spatial: false });
    await this._wait(200);
    await this._playPhase('loop_echo', { volume: 0.3, spatial: false });
  }
}

import { useEffect, useRef } from 'react';
import { use3DGameStore } from '../../stores/use3DGameStore';

export function useLoopTransitionAudio() {
  const loopAudioRef = useRef(null);
  const { phase, loop: { count: loopCount } } = use3DGameStore();

  useEffect(() => {
    const engine = getAudioEngine();
    engine.init().then(() => {
      loopAudioRef.current = new LoopTransitionAudio(engine);
      loopAudioRef.current.init();
    });
  }, []);

  useEffect(() => {
    if (!loopAudioRef.current) return;

    if (phase === 'loopTransition') {
      loopAudioRef.current.triggerLoopEntry();
    }
    
    // Check for exit - would need a previous phase check
    // For now just use the phase change
  }, [phase, loopCount]);

  return {
    startSnapshot: (count) => loopAudioRef.current?.startSnapshot(count),
    cancel: () => loopAudioRef.current?.cancel(),
    getPhase: () => loopAudioRef.current?.getPhase(),
  };
}

export default LoopTransitionAudio;
