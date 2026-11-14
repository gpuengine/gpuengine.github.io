// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const BIOMES = [
  {
    name: "Manhattan • Crisp Morning",
    skyTop: [0.05, 0.13, 0.38],
    skyMid: [0.28, 0.34, 0.64],
    skyHorizon: [0.98, 0.58, 0.44],
    sunColor: [1.0, 0.86, 0.64],
    sunDir: [0.42, 0.26, -0.87],
    sunIntensity: 1.14,
    nightFactor: 0.08,
    weatherWetness: 0.0,
    roadColor: [0.16, 0.17, 0.20],
    shoulderColor: [0.62, 0.63, 0.65],
    stripeColor: [0.98, 0.80, 0.22],
    waterColor: [0.12, 0.44, 0.66]
  },
  {
    name: "Manhattan • Sunny Noon",
    skyTop: [0.03, 0.18, 0.58],
    skyMid: [0.08, 0.45, 0.86],
    skyHorizon: [0.36, 0.76, 0.98],
    sunColor: [1.0, 0.97, 0.88],
    sunDir: [0.18, 0.58, -0.79],
    sunIntensity: 1.24,
    nightFactor: 0.0,
    weatherWetness: 0.0,
    roadColor: [0.18, 0.19, 0.22],
    shoulderColor: [0.66, 0.67, 0.69],
    stripeColor: [0.98, 0.82, 0.24],
    waterColor: [0.08, 0.50, 0.74]
  },
  {
    name: "Manhattan • Golden Sunset",
    skyTop: [0.12, 0.05, 0.28],
    skyMid: [0.64, 0.18, 0.42],
    skyHorizon: [1.0, 0.42, 0.18],
    sunColor: [1.0, 0.60, 0.26],
    sunDir: [-0.36, 0.16, -0.92],
    sunIntensity: 1.18,
    nightFactor: 0.38,
    weatherWetness: 0.10,
    roadColor: [0.15, 0.15, 0.19],
    shoulderColor: [0.60, 0.56, 0.54],
    stripeColor: [0.98, 0.78, 0.26],
    waterColor: [0.18, 0.38, 0.56]
  },
  {
    name: "Manhattan • Blue Hour Dusk",
    skyTop: [0.02, 0.03, 0.14],
    skyMid: [0.18, 0.12, 0.38],
    skyHorizon: [0.76, 0.34, 0.48],
    sunColor: [0.96, 0.56, 0.48],
    sunDir: [-0.42, 0.09, -0.90],
    sunIntensity: 0.76,
    nightFactor: 0.74,
    weatherWetness: 0.20,
    roadColor: [0.13, 0.14, 0.18],
    shoulderColor: [0.50, 0.52, 0.58],
    stripeColor: [0.98, 0.80, 0.26],
    waterColor: [0.12, 0.28, 0.48]
  },
  {
    name: "Manhattan • Starry Night",
    skyTop: [0.005, 0.008, 0.024],
    skyMid: [0.012, 0.020, 0.054],
    skyHorizon: [0.032, 0.048, 0.105],
    sunColor: [0.68, 0.82, 1.0],
    sunDir: [0.28, 0.34, -0.89],
    sunIntensity: 0.32,
    nightFactor: 1.0,
    weatherWetness: 0.26,
    roadColor: [0.10, 0.11, 0.15],
    shoulderColor: [0.44, 0.46, 0.52],
    stripeColor: [0.98, 0.82, 0.28],
    waterColor: [0.05, 0.18, 0.36]
  },
  {
    name: "Manhattan • Rainy Metropolis",
    skyTop: [0.04, 0.08, 0.16],
    skyMid: [0.10, 0.20, 0.32],
    skyHorizon: [0.24, 0.42, 0.54],
    sunColor: [0.68, 0.86, 0.98],
    sunDir: [0.22, 0.44, -0.87],
    sunIntensity: 0.62,
    nightFactor: 0.64,
    weatherWetness: 0.95,
    roadColor: [0.11, 0.12, 0.15],
    shoulderColor: [0.48, 0.50, 0.54],
    stripeColor: [0.96, 0.80, 0.24],
    waterColor: [0.12, 0.34, 0.48]
  }
];

const WORLD_SEED = globalThis.presetWorldSeed ?? Math.random() * 1000.0 + 137.42;

function seededRandom(seed) {
  const x = Math.sin(seed * 12.9898 + WORLD_SEED * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const environment = {
  time: 0,
  autoMorph: true,
  biomeIndex: 0,
  biomeTarget: 1,
  biomeBlend: 0.0,
  mutationCount: 0
};

const weatherChangeListeners = [];

function onWeatherChange(listener) {
  weatherChangeListeners.push(listener);
}

function notifyWeatherChange(reason) {
  for (const listener of weatherChangeListeners) listener(reason);
}

function activeBiomeIndex() {
  return environment.biomeBlend > 0.5 ? environment.biomeTarget : environment.biomeIndex;
}

function selectBiome(targetIndex) {
  environment.biomeIndex = targetIndex % BIOMES.length;
  environment.biomeTarget = (environment.biomeIndex + 1) % BIOMES.length;
  environment.biomeBlend = 0.0;
  notifyWeatherChange("selected");
}

function getBlendedBiome() {
  const currentBiome = BIOMES[environment.biomeIndex];
  const targetBiome = BIOMES[environment.biomeTarget];
  const blend = environment.biomeBlend;

  const blendColor = (key) => lerpColor(currentBiome[key], targetBiome[key], blend);
  const blendNumber = (key) => lerp(currentBiome[key], targetBiome[key], blend);
  const blendOptionalNumber = (key) => lerp(currentBiome[key] || 0.0, targetBiome[key] || 0.0, blend);

  return {
    name: blend < 0.5 ? currentBiome.name : targetBiome.name,
    skyTop: blendColor("skyTop"),
    skyMid: lerpColor(currentBiome.skyMid || currentBiome.skyTop, targetBiome.skyMid || targetBiome.skyTop, blend),
    skyHorizon: blendColor("skyHorizon"),
    sunColor: blendColor("sunColor"),
    sunDir: blendColor("sunDir"),
    sunIntensity: blendNumber("sunIntensity"),
    nightFactor: blendNumber("nightFactor"),
    weatherWetness: blendOptionalNumber("weatherWetness"),
    roadColor: blendColor("roadColor"),
    shoulderColor: blendColor("shoulderColor"),
    stripeColor: blendColor("stripeColor"),
    waterColor: blendColor("waterColor")
  };
}

function advanceWeatherMorph(dt, travelSpeed) {
  if (!environment.autoMorph) return;
  environment.biomeBlend += dt * 0.022 * (0.4 + Math.abs(travelSpeed) / 35.0);
  if (environment.biomeBlend < 1.0) return;
  environment.biomeIndex = environment.biomeTarget;
  environment.mutationCount++;
  const step = 1 + (Math.floor(seededRandom(environment.mutationCount * 43.7) * (BIOMES.length - 1)));
  environment.biomeTarget = (environment.biomeIndex + step) % BIOMES.length;
  environment.biomeBlend = 0.0;
  notifyWeatherChange("morphed");
}
