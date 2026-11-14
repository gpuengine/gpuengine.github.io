// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const ENGINE_GEAR_THRESHOLDS_KMH = [0, 32, 64, 102, 146, 195, 280];
const SOUND_FULL_SPEED_KMH = 240;
const SOUND_MUTE_FADE_SECONDS = 0.08;
const WIND_NOISE_BUFFER_SECONDS = 2;
const PINK_NOISE_OUTPUT_GAIN = 0.04;

class SoundEngine {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.subOscillator = null;
    this.mainOscillator = null;
    this.harmonicOscillator = null;
    this.harmonicGain = null;
    this.engineGain = null;
    this.windGain = null;
    this.windFilter = null;
    this.lastSpeedKmh = 0;
    this.steadyCruiseTimer = 0;
    this.phaseTime = 0;
  }

  ensureGraph() {
    if (this.audioContext) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.audioContext = new AudioContextClass();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    this.createEngineVoices();
    const noiseSource = this.createWindVoice();

    this.subOscillator.start();
    this.mainOscillator.start();
    this.harmonicOscillator.start();
    noiseSource.start();
  }

  recordingAudioTracks() {
    this.ensureGraph();
    if (!this.audioContext || !this.audioContext.createMediaStreamDestination) return [];
    if (!this.recordingDestination) {
      this.recordingDestination = this.audioContext.createMediaStreamDestination();
      this.masterGain.connect(this.recordingDestination);
    }
    return this.recordingDestination.stream.getAudioTracks();
  }

  unlockIfNeeded() {
    this.ensureGraph();
    if (this.audioContext && this.audioContext.state === "suspended" && this.enabled) {
      this.audioContext.resume().catch(() => {});
    }
  }

  toggle() {
    this.ensureGraph();
    this.enabled = !this.enabled;
    if (this.enabled && this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
    if (!this.enabled && this.engineGain && this.audioContext) {
      this.engineGain.gain.setTargetAtTime(0.0, this.audioContext.currentTime, SOUND_MUTE_FADE_SECONDS);
      if (this.windGain) this.windGain.gain.setTargetAtTime(0.0, this.audioContext.currentTime, SOUND_MUTE_FADE_SECONDS);
    }
    return this.enabled;
  }

  playCollisionBump() {
    if (!this.isReadyToPlay()) return;
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(115, now);
    oscillator.frequency.exponentialRampToValueAtTime(36, now + 0.18);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  update(speedKmh, throttle, offRoad, dt = 0.016, pitch = 0, steerAngle = 0, nearWater = false) {
    if (!this.isReadyToPlay()) return;
    this.phaseTime += dt;
    this.updateSteadyCruise(speedKmh, dt);

    const now = this.audioContext.currentTime;
    const effectiveRpm = this.computeEffectiveRpm(speedKmh);
    const hillLoadHz = Math.sin(pitch) * 18.0;
    this.updateEngineTone({ now, effectiveRpm, hillLoadHz, pitch, steerAngle, offRoad });
    this.updateEngineVolume({ now, speedKmh, throttle });
    if (this.windGain && this.windFilter) this.updateWind({ now, speedKmh, offRoad, nearWater });
  }

  isReadyToPlay() {
    if (!this.enabled) return false;
    this.ensureGraph();
    return !!this.audioContext && this.audioContext.state !== "suspended";
  }

  createEngineVoices() {
    const audioContext = this.audioContext;
    this.subOscillator = audioContext.createOscillator();
    this.mainOscillator = audioContext.createOscillator();
    this.harmonicOscillator = audioContext.createOscillator();
    this.subOscillator.type = "sine";
    this.mainOscillator.type = "triangle";
    this.harmonicOscillator.type = "sine";

    this.subGain = audioContext.createGain();
    this.subGain.gain.value = 0.65;
    this.harmonicGain = audioContext.createGain();
    this.harmonicGain.gain.value = 0.18;

    this.engineFilter = audioContext.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 180;
    this.engineFilter.Q.value = 0.8;

    this.engineGain = audioContext.createGain();
    this.engineGain.gain.value = 0.0;

    this.subOscillator.connect(this.subGain);
    this.subGain.connect(this.engineFilter);
    this.mainOscillator.connect(this.engineFilter);
    this.harmonicOscillator.connect(this.harmonicGain);
    this.harmonicGain.connect(this.engineFilter);

    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
  }

  createWindVoice() {
    const audioContext = this.audioContext;
    const noiseBuffer = createPinkNoiseBuffer(audioContext, audioContext.sampleRate * WIND_NOISE_BUFFER_SECONDS);
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    this.windFilter = audioContext.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.value = 280;
    this.windFilter.Q.value = 0.9;

    this.windGain = audioContext.createGain();
    this.windGain.gain.value = 0.0;

    noiseSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    return noiseSource;
  }

  updateSteadyCruise(speedKmh, dt) {
    const speedChangeRate = Math.abs(speedKmh - this.lastSpeedKmh) / Math.max(dt, 0.004);
    this.lastSpeedKmh = speedKmh;

    if (speedChangeRate < 3.5 && speedKmh > 35) {
      this.steadyCruiseTimer = Math.min(1.0, this.steadyCruiseTimer + dt * 0.55);
    } else {
      this.steadyCruiseTimer = Math.max(0.0, this.steadyCruiseTimer - dt * 1.8);
    }
  }

  computeEffectiveRpm(speedKmh) {
    const gear = engineGearForSpeed(speedKmh);
    const gearMinKmh = ENGINE_GEAR_THRESHOLDS_KMH[gear];
    const gearMaxKmh = ENGINE_GEAR_THRESHOLDS_KMH[gear + 1];
    const inGearNormalized = clamp((speedKmh - gearMinKmh) / (gearMaxKmh - gearMinKmh), 0.0, 1.0);
    const overdriveRelax = this.steadyCruiseTimer * 0.22;
    return clamp(inGearNormalized * (1.0 - overdriveRelax) + gear * 0.11, 0.0, 1.05);
  }

  updateEngineTone({ now, effectiveRpm, hillLoadHz, pitch, steerAngle, offRoad }) {
    const lfoSlow = Math.sin(this.phaseTime * 1.35) * 1.4 + Math.cos(this.phaseTime * 0.58) * 1.1;
    const lfoFlutter = Math.sin(this.phaseTime * 6.8) * 0.55 * (0.4 + this.steadyCruiseTimer * 0.6);
    const cornerLoadHz = Math.abs(steerAngle) * 2.5;

    const baseFrequency = clamp(38 + effectiveRpm * 42 + hillLoadHz + cornerLoadHz + lfoSlow + lfoFlutter, 34, 92);

    this.subOscillator.frequency.setTargetAtTime(baseFrequency * 0.5, now, 0.06);
    this.mainOscillator.frequency.setTargetAtTime(baseFrequency, now, 0.06);
    const harmonicRatio = 1.498 + Math.sin(this.phaseTime * 0.9) * 0.015 + (offRoad ? 0.04 : 0);
    this.harmonicOscillator.frequency.setTargetAtTime(baseFrequency * harmonicRatio, now, 0.07);

    const harmonicLevel = clamp(0.12 + Math.sin(this.phaseTime * 1.7) * 0.04 + Math.max(0, pitch) * 0.45 - this.steadyCruiseTimer * 0.05, 0.05, 0.26);
    this.harmonicGain.gain.setTargetAtTime(harmonicLevel, now, 0.1);

    const cutoffHz = clamp(
      145 + effectiveRpm * 155 + (1.0 - this.steadyCruiseTimer) * 70 + hillLoadHz * 2.2 + Math.sin(this.phaseTime * 1.1) * 18,
      120,
      360
    );
    this.engineFilter.frequency.setTargetAtTime(cutoffHz, now, 0.08);
  }

  updateEngineVolume({ now, speedKmh, throttle }) {
    const cruiseDuck = 1.0 - this.steadyCruiseTimer * 0.34;
    const rawVolume = (0.048 + (speedKmh / SOUND_FULL_SPEED_KMH) * 0.068 + (throttle ? 0.016 : 0)) * cruiseDuck;
    const engineVolume = clamp(rawVolume, 0.0, 0.125);
    this.engineGain.gain.setTargetAtTime(engineVolume, now, 0.1);
  }

  updateWind({ now, speedKmh, offRoad, nearWater }) {
    const windCenterHz = 220 + (speedKmh / SOUND_FULL_SPEED_KMH) * 240 + (nearWater ? 90 : 0) + Math.sin(this.phaseTime * 0.75) * 35;
    this.windFilter.frequency.setTargetAtTime(windCenterHz, now, 0.12);
    const windVolume = clamp(0.012 + (speedKmh / SOUND_FULL_SPEED_KMH) * 0.048 + (nearWater ? 0.014 : 0) + (offRoad ? 0.020 : 0), 0.0, 0.075);
    this.windGain.gain.setTargetAtTime(windVolume, now, 0.12);
  }
}

function engineGearForSpeed(speedKmh) {
  let gear = 0;
  for (let gearIndex = 0; gearIndex < ENGINE_GEAR_THRESHOLDS_KMH.length - 1; gearIndex++) {
    if (speedKmh >= ENGINE_GEAR_THRESHOLDS_KMH[gearIndex]) gear = gearIndex;
  }
  return gear;
}

function createPinkNoiseBuffer(audioContext, sampleCount) {
  const noiseBuffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
  const samples = noiseBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < sampleCount; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    samples[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * PINK_NOISE_OUTPUT_GAIN;
    b6 = white * 0.115926;
  }
  return noiseBuffer;
}
