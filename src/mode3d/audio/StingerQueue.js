/**
 * Dynamic horror stingers for low sanity/enemy aggro
 * Queue-based system for triggering one-shot horror sounds
 */

class StingerQueue {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.queue = [];
    this.isPlaying = false;
    this.cooldowns = new Map();
    
    this.stingers = {
      sanity_low: {
        ids: ['stinger_sanity_1', 'stinger_sanity_2', 'stinger_sanity_3'],
        minInterval: 8000,
        maxInterval: 20000,
        triggerCondition: (state) => state.loop.sanityBaseline < 30 && state.phase !== 'loopTransition',
        volume: 0.6,
        spatial: false,
      },
      sanity_critical: {
        ids: ['stinger_sanity_crit_1', 'stinger_sanity_crit_2'],
        minInterval: 5000,
        maxInterval: 12000,
        triggerCondition: (state) => state.loop.sanityBaseline < 15,
        volume: 0.7,
        spatial: false,
      },
      enemy_aggro: {
        ids: ['stinger_enemy_spot_1', 'stinger_enemy_spot_2'],
        minInterval: 3000,
        maxInterval: 8000,
        triggerCondition: (state) => state.enemies.alertsActive > 3,
        volume: 0.8,
        spatial: true,
      },
      enemy_attack: {
        ids: ['stinger_enemy_attack_1', 'stinger_enemy_attack_2', 'stinger_enemy_attack_3'],
        minInterval: 1000,
        maxInterval: 3000,
        triggerCondition: (state) => state.enemies.active.some(e => e.state === 'attack'),
        volume: 0.9,
        spatial: true,
      },
      loop_transition: {
        ids: ['stinger_loop_entry', 'stinger_loop_deep'],
        minInterval: 0,
        maxInterval: 0,
        triggerCondition: (state) => state.phase === 'loopTransition',
        volume: 0.7,
        spatial: false,
        priority: 'high',
      },
      objective_complete: {
        ids: ['stinger_objective_done'],
        minInterval: 0,
        maxInterval: 0,
        triggerCondition: (state) => state.mission.objectives.some(o => o.justCompleted),
        volume: 0.5,
        spatial: false,
      },
      jump_scare: {
        ids: ['stinger_jumpscare_1', 'stinger_jumpscare_2'],
        minInterval: 30000,
        maxInterval: 60000,
        triggerCondition: (state) => state.loop.sanityBaseline < 25 && Math.random() < 0.001,
        volume: 1.0,
        spatial: true,
        priority: 'high',
      },
    };

    this.lastTriggerTime = new Map();
  }

  update(gameState) {
    Object.entries(this.stingers).forEach(([type, config]) => {
      if (!config.triggerCondition(gameState)) return;

      const now = Date.now();
      const lastTime = this.lastTriggerTime.get(type) || 0;
      
      if (config.minInterval === 0) {
        const flagKey = `triggered_${type}`;
        if (gameState[flagKey]) return;
      }
      
      if (now - lastTime < config.minInterval) return;

      this.queue.push({
        type,
        config,
        timestamp: now,
        priority: config.priority || 'normal',
      });

      this.lastTriggerTime.set(type, now);
    });

    this.queue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    this._processQueue();
  }

  async _processQueue() {
    if (this.isPlaying || this.queue.length === 0) return;
    
    const next = this.queue[0];
    if (this.isPlaying && next.priority !== 'high') return;

    this.isPlaying = true;
    const stinger = this.queue.shift();

    try {
      const variantIndex = Math.floor(Math.random() * stinger.config.ids.length);
      const bufferId = stinger.config.ids[variantIndex];

      const position = stinger.config.spatial && gameState?.player?.position
        ? gameState.player.position
        : { x: 0, y: 0, z: 0 };

      await this.audioEngine.playOneShot(bufferId, position, {
        volume: stinger.config.volume,
        spatial: stinger.config.spatial,
        category: 'sfx',
      });

      const buffer = this.audioEngine.buffers.get(bufferId);
      const duration = buffer ? buffer.duration * 1000 : 2000;
      
      await new Promise(resolve => setTimeout(resolve, duration + 200));
    } catch (error) {
      console.error('[StingerQueue] Error playing stinger:', error);
    } finally {
      this.isPlaying = false;
      if (this.queue.length > 0) {
        setTimeout(() => this._processQueue(), 100);
      }
    }
  }

  async trigger(type, options = {}) {
    const config = this.stingers[type];
    if (!config) {
      console.warn(`[StingerQueue] Unknown stinger type: ${type}`);
      return;
    }

    const bufferId = config.ids[Math.floor(Math.random() * config.ids.length)];
    const position = options.position || { x: 0, y: 0, z: 0 };

    await this.audioEngine.playOneShot(bufferId, position, {
      volume: options.volume ?? config.volume,
      spatial: options.spatial ?? config.spatial,
      category: 'sfx',
    });
  }

  clear() {
    this.queue = [];
    this.isPlaying = false;
    this.lastTriggerTime.clear();
  }

  setCooldownMultiplier(multiplier) {
    Object.values(this.stingers).forEach(config => {
      config.minInterval *= multiplier;
      config.maxInterval *= multiplier;
    });
  }

  registerStinger(type, config) {
    this.stingers[type] = {
      minInterval: 5000,
      maxInterval: 15000,
      priority: 'normal',
      volume: 0.6,
      spatial: false,
      ...config,
    };
  }
}

import { useEffect, useRef } from 'react';
import { use3DGameStore } from '../../stores/use3DGameStore';
import { getAudioEngine } from './Audio3DEngine';

export function useStingerQueue() {
  const queueRef = useRef(null);

  useEffect(() => {
    const audioEngine = getAudioEngine();
    queueRef.current = new StingerQueue(audioEngine);
  }, []);

  useEffect(() => {
    if (!queueRef.current) return;
    
    const interval = setInterval(() => {
      const state = use3DGameStore.getState();
      queueRef.current.update({
        loop: state.loop,
        enemies: state.enemies,
        mission: state.mission,
        player: state.player,
        phase: state.phase,
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return {
    trigger: (type, options) => queueRef.current?.trigger(type, options),
    clear: () => queueRef.current?.clear(),
  };
}

export default StingerQueue;
