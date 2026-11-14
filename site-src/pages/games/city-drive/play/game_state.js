// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const state = {
  trafficEnabled: false,
  cameraMode: 0,
  autoSteer: false,
  cruiseHold: false,
  turnIntent: 0,
  turnAlignTimer: 0,
  manualSteerHold: 0,
  laneSide: 1,
  wasOnJunction: false,
  crossroad: null,

  car: {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 22.0,
    steerAngle: 0,
    wheelSpin: 0,
    suspBob: 0,
    accelPitch: 0,
    steerRoll: 0,
    braking: false,
    offRoad: false,
    surface: "road",
    colliding: false,
    collisionFlashTimer: 0,
    distanceMeters: 0
  },

  traffic: [],
  pedestrians: [],

  cam: {
    x: 0,
    y: 3.5,
    z: 10,
    lookX: 0,
    lookY: 1,
    lookZ: -20
  }
};

const carLocation = {
  kind: "edge",
  edge: null,
  edgePosition: 0,
  junction: null,
  entryHeading: 0,
  fromEdge: null,
  fromEnd: null,
  lastJunction: null,
  lastJunctionTime: -Infinity,
  lastIntent: 0
};
