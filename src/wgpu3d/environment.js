// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

import { normalize, toLinearColor } from "./math.js";

export const ENVIRONMENT_PRESETS = Object.freeze({
  morning: {
    skyTop: [0.05, 0.13, 0.38],
    skyHorizon: [0.98, 0.58, 0.44],
    groundColor: [0.24, 0.20, 0.17],
    sunColor: [1.0, 0.86, 0.64],
    sunDirection: [0.42, 0.26, -0.87],
    sunIntensity: 2.6,
    ambientIntensity: 0.9,
    fogStart: 60,
    fogEnd: 260,
    exposure: 1.0
  },
  noon: {
    skyTop: [0.03, 0.18, 0.58],
    skyHorizon: [0.36, 0.76, 0.98],
    groundColor: [0.26, 0.24, 0.20],
    sunColor: [1.0, 0.97, 0.88],
    sunDirection: [0.35, 0.78, -0.5],
    sunIntensity: 2.8,
    ambientIntensity: 1.0,
    fogStart: 80,
    fogEnd: 320,
    exposure: 1.0
  },
  sunset: {
    skyTop: [0.12, 0.05, 0.28],
    skyHorizon: [1.0, 0.42, 0.18],
    groundColor: [0.22, 0.13, 0.10],
    sunColor: [1.0, 0.60, 0.26],
    sunDirection: [-0.36, 0.2, -0.92],
    sunIntensity: 2.7,
    ambientIntensity: 0.85,
    fogStart: 50,
    fogEnd: 230,
    exposure: 1.05
  },
  dusk: {
    skyTop: [0.02, 0.03, 0.14],
    skyHorizon: [0.76, 0.34, 0.48],
    groundColor: [0.10, 0.08, 0.12],
    sunColor: [0.96, 0.56, 0.48],
    sunDirection: [-0.42, 0.12, -0.9],
    sunIntensity: 1.4,
    ambientIntensity: 0.8,
    fogStart: 70,
    fogEnd: 280,
    exposure: 1.0
  },
  night: {
    skyTop: [0.005, 0.008, 0.03],
    skyHorizon: [0.06, 0.07, 0.14],
    groundColor: [0.03, 0.03, 0.05],
    sunColor: [0.55, 0.65, 1.0],
    sunDirection: [0.3, 0.55, 0.4],
    sunIntensity: 0.45,
    ambientIntensity: 0.7,
    fogStart: 30,
    fogEnd: 160,
    exposure: 1.5
  }
});

const COLOR_FIELDS = ["skyTop", "skyHorizon", "groundColor", "sunColor"];

export function resolveEnvironment(environment) {
  const base = typeof environment === "string" ? presetNamed(environment) : { ...ENVIRONMENT_PRESETS.noon, ...presetNamed(environment.preset ?? "noon"), ...environment };
  const resolved = { ...base };
  for (const field of COLOR_FIELDS) resolved[field] = toLinearColor(base[field]);
  resolved.sunDirection = normalize(base.sunDirection);
  return resolved;
}

function presetNamed(name) {
  const preset = ENVIRONMENT_PRESETS[name];
  if (!preset) throw new Error(`wgpu3d: unknown environment "${name}". Use one of ${Object.keys(ENVIRONMENT_PRESETS).join(", ")}.`);
  return preset;
}
