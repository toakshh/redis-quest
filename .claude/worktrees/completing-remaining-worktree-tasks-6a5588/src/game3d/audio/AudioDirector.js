export function createAudioDirector(audioCtx = new (window.AudioContext || window.webkitAudioContext)()) {
  const masterGain = audioCtx.createGain()
  // Reserve 12dB headroom by dropping master gain (except scare? No, if we drop master, scare is dropped too.
  // We drop all other buses by 12dB (0.25 linear gain) relative to scare).
  masterGain.gain.value = 1.0
  masterGain.connect(audioCtx.destination)

  // 1. Scare Bus (Has full headroom)
  const scareBus = audioCtx.createGain()
  scareBus.gain.value = 1.0
  scareBus.connect(masterGain)

  // Sub-master for everything else, padded down by 12dB (approx 0.25 linear) to give scare headroom
  const standardSubMaster = audioCtx.createGain()
  standardSubMaster.gain.value = 0.25
  standardSubMaster.connect(masterGain)

  // 2. Music Bus (sidechain ducked by combat: -6dB, 120ms release)
  // We'll simulate sidechain ducking via a GainNode we manually modulate later
  const musicBus = audioCtx.createGain()
  musicBus.gain.value = 1.0
  musicBus.connect(standardSubMaster)

  // 3. Combat Bus (compressor 4:1 @ -12dB -> saturation)
  const combatBus = audioCtx.createGain()
  const combatCompressor = audioCtx.createDynamicsCompressor()
  combatCompressor.threshold.value = -12
  combatCompressor.ratio.value = 4
  const combatSaturation = audioCtx.createWaveShaper() // Saturation placeholder
  combatSaturation.curve = makeDistortionCurve(10)

  combatBus.connect(combatCompressor)
  combatCompressor.connect(combatSaturation)
  combatSaturation.connect(standardSubMaster)

  // 4. World Bus (convolver per-zone impulse response)
  const worldBus = audioCtx.createGain()
  const worldConvolver = audioCtx.createConvolver() // IR will be set later
  worldBus.connect(worldConvolver)
  worldConvolver.connect(standardSubMaster)

  // 5. Voice Bus (band-pass + bitcrush ∝ latency)
  const voiceBus = audioCtx.createGain()
  const voiceFilter = audioCtx.createBiquadFilter()
  voiceFilter.type = 'bandpass'
  voiceFilter.frequency.value = 1000 // default voice band

  voiceBus.connect(voiceFilter)
  // (Bitcrush would theoretically be an AudioWorklet or WaveShaper; passing to submaster)
  voiceFilter.connect(standardSubMaster)

  // 6. UI Bus (unprocessed, always audible)
  const uiBus = audioCtx.createGain()
  uiBus.gain.value = 1.0
  uiBus.connect(standardSubMaster)

  function makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Method to manually duck music when combat happens
  function duckMusic(time = audioCtx.currentTime) {
    // -6dB is approx 0.5 amplitude
    musicBus.gain.cancelScheduledValues(time)
    musicBus.gain.setValueAtTime(0.5, time)
    // 120ms release
    musicBus.gain.linearRampToValueAtTime(1.0, time + 0.12)
  }

  // Update voice degradation based on latency/pressure
  function updateVoiceDegradation(latencyNorm) {
    // If latencyNorm (0..1) is high, voice gets crushed/filtered
    voiceFilter.frequency.value = 1000 + (3000 * (1 - latencyNorm))
  }

  return {
    ctx: audioCtx,
    masterGain,
    buses: {
      music: musicBus,
      combat: combatBus,
      world: worldBus,
      scare: scareBus,
      voice: voiceBus,
      ui: uiBus
    },
    duckMusic,
    updateVoiceDegradation
  }
}
