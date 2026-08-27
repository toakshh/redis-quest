export function playProceduralSfx(audioCtx, destinationNode, soundId) {
  const time = audioCtx.currentTime

  if (soundId === 'sfx_lunge') {
    // Aggressive synthesized roar/impact
    playNoiseBurst(audioCtx, destinationNode, time, 0.4, 'lowpass', 400)
    playPitchedDrop(audioCtx, destinationNode, time, 'sawtooth', 150, 40, 0.3)
  }
  else if (soundId === 'sfx_sting') {
    // High-pitched dissonance
    playPitchedDrop(audioCtx, destinationNode, time, 'square', 800, 750, 0.5)
    playPitchedDrop(audioCtx, destinationNode, time, 'sawtooth', 850, 800, 0.5)
  }
  else if (soundId === 'sfx_pipe_burst') {
    // Sharp transient + noise burst
    playNoiseBurst(audioCtx, destinationNode, time, 0.3, 'highpass', 2000)
    playNoiseBurst(audioCtx, destinationNode, time, 0.8, 'lowpass', 200)
  }
  else if (soundId === 'sfx_breath_behind') {
    // Quiet, breathy noise sweep
    playNoiseSweep(audioCtx, destinationNode, time, 1.5, 400, 1200)
  }
  else if (soundId.startsWith('sfx_ui_')) {
    // Standard UI blip
    playPitchedDrop(audioCtx, destinationNode, time, 'sine', 600, 600, 0.1)
  }
  else {
    // Generic thud fallback for everything else (impacts, etc)
    // Transient (0-15ms)
    playNoiseBurst(audioCtx, destinationNode, time, 0.05, 'highpass', 2000)
    // Body (15-120ms)
    playPitchedDrop(audioCtx, destinationNode, time, 'square', 200, 50, 0.12)
    // Sub (0-250ms)
    playPitchedDrop(audioCtx, destinationNode, time, 'sine', 60, 20, 0.25)
  }
}

// ----------------------------------------------------
// Generators
// ----------------------------------------------------

function playNoiseBurst(ctx, dest, time, duration, filterType, filterFreq) {
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }

  const noiseSource = ctx.createBufferSource()
  noiseSource.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = filterFreq

  const env = ctx.createGain()
  env.gain.setValueAtTime(1, time)
  env.gain.exponentialRampToValueAtTime(0.01, time + duration)

  noiseSource.connect(filter)
  filter.connect(env)
  env.connect(dest)

  noiseSource.start(time)
  noiseSource.stop(time + duration)
}

function playPitchedDrop(ctx, dest, time, type, startFreq, endFreq, duration) {
  const osc = ctx.createOscillator()
  osc.type = type

  osc.frequency.setValueAtTime(startFreq, time)
  osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration)

  const env = ctx.createGain()
  env.gain.setValueAtTime(1, time)
  env.gain.exponentialRampToValueAtTime(0.01, time + duration)

  osc.connect(env)
  env.connect(dest)

  osc.start(time)
  osc.stop(time + duration)
}

function playNoiseSweep(ctx, dest, time, duration, startFreq, endFreq) {
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }

  const noiseSource = ctx.createBufferSource()
  noiseSource.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(startFreq, time)
  filter.frequency.exponentialRampToValueAtTime(endFreq, time + (duration / 2))
  filter.frequency.exponentialRampToValueAtTime(startFreq, time + duration)

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.01, time)
  env.gain.linearRampToValueAtTime(0.5, time + (duration / 2))
  env.gain.linearRampToValueAtTime(0.01, time + duration)

  noiseSource.connect(filter)
  filter.connect(env)
  env.connect(dest)

  noiseSource.start(time)
  noiseSource.stop(time + duration)
}
