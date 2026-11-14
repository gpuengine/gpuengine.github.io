// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const dynamicCarBuffer = new Float32Array(DYNAMIC_MESH_MAX_VERTS * FLOATS_PER_VERT);

const LAKE_DEPTH_BELOW_TERRAIN_METERS = 2.6;

const LAKE_GRID_OFFSETS = Object.freeze([-900, -400, -180, -80, -30, 0, 30, 80, 180, 400, 900]);

const LAKE_GRID_SNAP_METERS = 30;

const LAKE_FALLBACK_COLOR = [0.12, 0.40, 0.58];
const LAKE_FLOW_SPEED = 0.25;
const LAKE_DEPTH_SHADE = 0.96;

const TRIANGLES_PER_BOX = 12;
const TRAFFIC_VEHICLE_FLOAT_HEADROOM = FLOATS_PER_TRIANGLE * 134;
const PEDESTRIAN_FLOAT_HEADROOM = FLOATS_PER_TRIANGLE * 74;
const PARTICLE_FLOAT_HEADROOM = FLOATS_PER_TRIANGLE * TRIANGLES_PER_BOX;

const TRAFFIC_BODY_LIFT_METERS = 0.40;
const TRAFFIC_SHADOW_COLOR = [0.03, 0.04, 0.06];
const TRAFFIC_GLASS_COLOR = [0.06, 0.09, 0.12];
const TRAFFIC_TIRE_COLOR = [0.10, 0.11, 0.13];
const TRAFFIC_HEADLIGHT_COLOR = [1.0, 0.96, 0.80];
const TRAFFIC_TAILLIGHT_COLOR = [1.0, 0.14, 0.18];

const PEDESTRIAN_SHADOW_COLOR = [0.03, 0.04, 0.06];
const PEDESTRIAN_SKIN_COLOR = [0.92, 0.76, 0.64];
const PEDESTRIAN_SWING_RADIANS = 0.45;

function uploadDynamicDriveMesh(car, renderer, biome) {
  const visibleTraffic = state.trafficEnabled ? state.traffic.filter(vehicle => vehicle.mode !== "hidden") : [];
  const visiblePedestrians = state.trafficEnabled ? state.pedestrians.filter(pedestrian => !pedestrian.hidden) : [];
  const groundVertexCount = pushLakeSurface(dynamicCarBuffer, 0, car, biome.waterColor || LAKE_FALLBACK_COLOR);
  const vertexCount = buildCarAndParticlesMesh(car, visibleTraffic, visiblePedestrians, particles, dynamicCarBuffer, state.cameraMode, groundVertexCount);
  renderer.uploadDynamicMesh(dynamicCarBuffer, vertexCount);
  return { groundVertexCount, vertexCount };
}

function pushLakeSurface(vertices, vertCount, car, waterColor) {
  let offset = vertCount * FLOATS_PER_VERT;
  const originX = Math.round(car.x / LAKE_GRID_SNAP_METERS) * LAKE_GRID_SNAP_METERS;
  const originZ = Math.round(car.z / LAKE_GRID_SNAP_METERS) * LAKE_GRID_SNAP_METERS;
  const gridOffsets = LAKE_GRID_OFFSETS;
  const cellSizeAround = (index) => Math.max(
    index > 0 ? gridOffsets[index] - gridOffsets[index - 1] : 0,
    index < gridOffsets.length - 1 ? gridOffsets[index + 1] - gridOffsets[index] : 0
  );
  const gridPoint = (column, row) => {
    const x = originX + gridOffsets[column];
    const z = originZ + gridOffsets[row];
    return [x, lakeSurfaceHeightAt(x, z, Math.max(cellSizeAround(column), cellSizeAround(row))), z];
  };
  for (let row = 0; row < gridOffsets.length - 1; row++) {
    for (let column = 0; column < gridOffsets.length - 1; column++) {
      offset = pushGroundQuad(vertices, offset, gridPoint(column, row), gridPoint(column + 1, row), gridPoint(column + 1, row + 1), gridPoint(column, row + 1), waterColor, MATERIAL.WATER, LAKE_FLOW_SPEED, LAKE_DEPTH_SHADE);
    }
  }
  return offset / FLOATS_PER_VERT;
}

function lakeSurfaceHeightAt(x, z, cellSizeMeters) {
  const sagAllowance = TERRAIN_MAX_CURVATURE * cellSizeMeters * cellSizeMeters / 8;
  return terrainHeightAt(x, z) - LAKE_DEPTH_BELOW_TERRAIN_METERS - sagAllowance;
}

function buildCarAndParticlesMesh(car, trafficList, pedestrianList, particleList, vertices, cameraMode = 0, startVertexCount = 0) {
  let offset = startVertexCount * FLOATS_PER_VERT;

  offset = pushPlayerCar(vertices, offset, car, cameraMode);

  const maxFloatCapacity = DYNAMIC_MESH_MAX_VERTS * FLOATS_PER_VERT;
  for (let i = 0; i < trafficList.length; i++) {
    if (offset + TRAFFIC_VEHICLE_FLOAT_HEADROOM > maxFloatCapacity) break;
    offset = pushTrafficVehicle(vertices, offset, trafficList[i]);
  }

  for (let i = 0; i < pedestrianList.length; i++) {
    if (offset + PEDESTRIAN_FLOAT_HEADROOM > maxFloatCapacity) break;
    offset = pushPedestrianMesh(vertices, offset, pedestrianList[i]);
  }

  offset = pushParticleCubes(vertices, offset, particleList, maxFloatCapacity);

  return offset / FLOATS_PER_VERT;
}

function pushTrafficVehicle(vertices, offset, vehicle) {
  const pose = trafficVehiclePose(vehicle);
  offset = pushTrafficVehicleShadow(vertices, offset, vehicle, pose);
  offset = vehicle.type === "truck"
    ? pushTruckBody(vertices, offset, vehicle, pose)
    : pushCarBody(vertices, offset, vehicle, pose);
  offset = pushTrafficVehicleLights(vertices, offset, vehicle, pose);
  return pushTrafficVehicleWheels(vertices, offset, vehicle, pose);
}

function trafficVehiclePose(vehicle) {
  return {
    centerX: vehicle.x,
    centerY: vehicle.y + TRAFFIC_BODY_LIFT_METERS,
    centerZ: vehicle.z,
    yaw: vehicle.heading,
    pitch: vehicle.pitch,
    roll: vehicle.roll
  };
}

function toTrafficVehicleWorld(pose, localX, localY, localZ) {
  return transformPoint(localX, localY, localZ, pose.centerX, pose.centerY, pose.centerZ, pose.yaw, pose.pitch, pose.roll);
}

function pushTrafficVehicleBox(vertices, offset, pose, { center, size, color, material, occlusion }) {
  return pushBox(vertices, offset, { center, size, yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll, color, material, occlusion });
}

function pushTrafficVehicleShadow(vertices, offset, vehicle, pose) {
  const bodyWidth = vehicle.width;
  const bodyLength = vehicle.length;
  return pushQuad(
    vertices, offset,
    toTrafficVehicleWorld(pose, -bodyWidth * 0.54, -0.36, -bodyLength * 0.52), toTrafficVehicleWorld(pose, bodyWidth * 0.54, -0.36, -bodyLength * 0.52),
    toTrafficVehicleWorld(pose, bodyWidth * 0.54, -0.36,  bodyLength * 0.52), toTrafficVehicleWorld(pose, -bodyWidth * 0.54, -0.36,  bodyLength * 0.52),
    TRAFFIC_SHADOW_COLOR, MATERIAL.TERRAIN, 1.0, 0.25
  );
}

function pushTruckBody(vertices, offset, vehicle, pose) {
  const bodyWidth = vehicle.width;
  const bodyLength = vehicle.length;
  const bodyHeight = vehicle.height;
  offset = pushTrafficVehicleBox(vertices, offset, pose, {
    center: toTrafficVehicleWorld(pose, 0, 0.35, -bodyLength * 0.32),
    size: [bodyWidth * 0.95, bodyHeight * 0.72, bodyLength * 0.32],
    color: vehicle.color,
    material: MATERIAL.CAR_PAINT,
    occlusion: 0.95
  });
  offset = pushTrafficVehicleBox(vertices, offset, pose, {
    center: toTrafficVehicleWorld(pose, 0, 0.56, -bodyLength * 0.38),
    size: [bodyWidth * 0.86, bodyHeight * 0.32, bodyLength * 0.22],
    color: TRAFFIC_GLASS_COLOR,
    material: MATERIAL.CAR_GLASS,
    occlusion: 1.0
  });
  return pushTrafficVehicleBox(vertices, offset, pose, {
    center: toTrafficVehicleWorld(pose, 0, 0.62, bodyLength * 0.14),
    size: [bodyWidth, bodyHeight, bodyLength * 0.68],
    color: vehicle.secondaryColor,
    material: MATERIAL.METAL,
    occlusion: 0.98
  });
}

function pushCarBody(vertices, offset, vehicle, pose) {
  const bodyWidth = vehicle.width;
  const bodyLength = vehicle.length;
  const bodyHeight = vehicle.height;
  const isSuv = vehicle.type === "suv";
  const cabinLength = isSuv ? bodyLength * 0.66 : bodyLength * 0.52;
  const cabinOffsetZ = isSuv ? bodyLength * 0.06 : bodyLength * 0.04;
  offset = pushTrafficVehicleBox(vertices, offset, pose, {
    center: [pose.centerX, pose.centerY + 0.12, pose.centerZ],
    size: [bodyWidth, bodyHeight * 0.48, bodyLength],
    color: vehicle.color,
    material: MATERIAL.CAR_PAINT,
    occlusion: 0.98
  });
  offset = pushTrafficVehicleBox(vertices, offset, pose, {
    center: toTrafficVehicleWorld(pose, 0, bodyHeight * 0.52, cabinOffsetZ),
    size: [bodyWidth * 0.84, bodyHeight * 0.44, cabinLength],
    color: TRAFFIC_GLASS_COLOR,
    material: MATERIAL.CAR_GLASS,
    occlusion: 0.95
  });
  return pushTrafficVehicleBox(vertices, offset, pose, {
    center: toTrafficVehicleWorld(pose, 0, bodyHeight * 0.75, cabinOffsetZ),
    size: [bodyWidth * 0.78, 0.10, cabinLength * 0.88],
    color: vehicle.color,
    material: MATERIAL.CAR_PAINT,
    occlusion: 1.05
  });
}

function pushTrafficVehicleLights(vertices, offset, vehicle, pose) {
  const lateral = vehicle.width * 0.34;
  const halfLength = vehicle.length * 0.50;
  offset = pushTrafficLightPair(vertices, offset, pose, {
    lateral, height: 0.12, along: -halfLength - 0.03, size: [0.34, 0.15, 0.08], color: TRAFFIC_HEADLIGHT_COLOR
  });
  return pushTrafficLightPair(vertices, offset, pose, {
    lateral, height: 0.15, along: halfLength + 0.03, size: [0.38, 0.16, 0.08], color: TRAFFIC_TAILLIGHT_COLOR
  });
}

function pushTrafficLightPair(vertices, offset, pose, { lateral, height, along, size, color }) {
  for (const localX of [-lateral, lateral]) {
    offset = pushTrafficVehicleBox(vertices, offset, pose, {
      center: toTrafficVehicleWorld(pose, localX, height, along),
      size,
      color,
      material: MATERIAL.GLOW,
      occlusion: 1.0
    });
  }
  return offset;
}

function pushTrafficVehicleWheels(vertices, offset, vehicle, pose) {
  const wheelX = vehicle.width * 0.48;
  const wheelZ = vehicle.length * 0.32;
  const wheelY = -0.12;
  const wheelPositions = [[-wheelX, wheelY, -wheelZ], [wheelX, wheelY, -wheelZ], [-wheelX, wheelY, wheelZ], [wheelX, wheelY, wheelZ]];
  for (const [localX, localY, localZ] of wheelPositions) {
    offset = pushBox(vertices, offset, {
      center: toTrafficVehicleWorld(pose, localX, localY, localZ),
      size: [0.28, 0.56, 0.56],
      yaw: pose.yaw,
      pitch: pose.pitch + vehicle.wheelSpin,
      roll: pose.roll,
      color: TRAFFIC_TIRE_COLOR,
      material: MATERIAL.PAVING,
      occlusion: 0.75
    });
  }
  return offset;
}

function pushPedestrianMesh(vertices, offset, pedestrian) {
  const pose = {
    baseX: pedestrian.x,
    baseY: pedestrian.y,
    baseZ: pedestrian.z,
    yaw: pedestrian.heading,
    swing: Math.sin(pedestrian.walkPhase) * PEDESTRIAN_SWING_RADIANS
  };
  offset = pushPedestrianShadow(vertices, offset, pose);
  offset = pushPedestrianLegs(vertices, offset, pose, pedestrian.pantsColor);
  offset = pushPedestrianTorso(vertices, offset, pose, pedestrian.shirtColor);
  offset = pushPedestrianArms(vertices, offset, pose, pedestrian.shirtColor);
  return pushPedestrianHead(vertices, offset, pose);
}

function toPedestrianWorld(pose, localX, localY, localZ) {
  return transformPoint(localX, localY, localZ, pose.baseX, pose.baseY, pose.baseZ, pose.yaw, 0, 0);
}

function pushPedestrianBox(vertices, offset, pose, { center, size, pitch, color, occlusion }) {
  return pushBox(vertices, offset, { center, size, yaw: pose.yaw, pitch, color, material: MATERIAL.TERRAIN, occlusion });
}

function pushPedestrianShadow(vertices, offset, pose) {
  return pushQuad(
    vertices, offset,
    toPedestrianWorld(pose, -0.35, 0.03, -0.35), toPedestrianWorld(pose, 0.35, 0.03, -0.35),
    toPedestrianWorld(pose, 0.35, 0.03,  0.35), toPedestrianWorld(pose, -0.35, 0.03,  0.35),
    PEDESTRIAN_SHADOW_COLOR, MATERIAL.TERRAIN, 1.0, 0.3
  );
}

function pushPedestrianLegs(vertices, offset, pose, pantsColor) {
  const swing = pose.swing;
  offset = pushPedestrianBox(vertices, offset, pose, {
    center: toPedestrianWorld(pose, -0.14, 0.42, swing * 0.18),
    size: [0.18, 0.78, 0.20],
    pitch: swing,
    color: pantsColor,
    occlusion: 0.9
  });
  return pushPedestrianBox(vertices, offset, pose, {
    center: toPedestrianWorld(pose, 0.14, 0.42, -swing * 0.18),
    size: [0.18, 0.78, 0.20],
    pitch: -swing,
    color: pantsColor,
    occlusion: 0.9
  });
}

function pushPedestrianTorso(vertices, offset, pose, shirtColor) {
  return pushPedestrianBox(vertices, offset, pose, {
    center: toPedestrianWorld(pose, 0, 1.08, 0),
    size: [0.48, 0.66, 0.28],
    color: shirtColor,
    occlusion: 0.95
  });
}

function pushPedestrianArms(vertices, offset, pose, shirtColor) {
  const swing = pose.swing;
  offset = pushPedestrianBox(vertices, offset, pose, {
    center: toPedestrianWorld(pose, -0.32, 1.05, -swing * 0.14),
    size: [0.15, 0.56, 0.16],
    pitch: -swing * 0.8,
    color: shirtColor,
    occlusion: 0.9
  });
  return pushPedestrianBox(vertices, offset, pose, {
    center: toPedestrianWorld(pose, 0.32, 1.05, swing * 0.14),
    size: [0.15, 0.56, 0.16],
    pitch: swing * 0.8,
    color: shirtColor,
    occlusion: 0.9
  });
}

function pushPedestrianHead(vertices, offset, pose) {
  return pushPedestrianBox(vertices, offset, pose, {
    center: toPedestrianWorld(pose, 0, 1.58, 0),
    size: [0.30, 0.32, 0.30],
    color: PEDESTRIAN_SKIN_COLOR,
    occlusion: 1.0
  });
}

function pushParticleCubes(vertices, offset, particleList, maxFloatCapacity) {
  for (let i = 0; i < particleList.length; i++) {
    const particle = particleList[i];
    if (!particle.active) continue;
    if (offset + PARTICLE_FLOAT_HEADROOM > maxFloatCapacity) break;
    const particleSize = particle.size * (1.0 - particle.age / particle.maxAge * 0.5);
    offset = pushBox(vertices, offset, {
      center: [particle.x, particle.y, particle.z],
      size: [particleSize, particleSize, particleSize],
      yaw: particle.rot,
      pitch: particle.rot * 0.7,
      color: particle.color,
      material: MATERIAL.TERRAIN,
      occlusion: 0.95
    });
  }
  return offset;
}
