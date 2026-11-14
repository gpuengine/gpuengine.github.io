// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const PARTICLE_POOL_SIZE = 36;

const particles = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
  active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
  size: 0.3, age: 0, maxAge: 0.6, rot: 0, color: [0.8, 0.8, 0.8]
}));

function spawnParticle(x, y, z, velocityX, velocityY, velocityZ, color, size = 0.32) {
  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    if (particle.active) continue;
    particle.active = true;
    particle.x = x; particle.y = y; particle.z = z;
    particle.vx = velocityX; particle.vy = velocityY; particle.vz = velocityZ;
    particle.size = size;
    particle.age = 0;
    particle.maxAge = 0.45 + Math.random() * 0.35;
    particle.rot = Math.random() * Math.PI;
    particle.color = color;
    return;
  }
}

function spawnDriveParticles(car, axes, roadFrame, biome, handbrake) {
  spawnTireDust(car, axes, biome, handbrake);
  spawnRainDrop(car, axes, biome);
  spawnValleySpray(axes, roadFrame);
}

function spawnTireDust(car, axes, biome, handbrake) {
  const isSkidding = handbrake || car.offRoad || Math.abs(car.steerAngle) > 0.65;
  if (!isSkidding || !(Math.abs(car.speed) > 10.0)) return;
  const dustColor = car.offRoad ? biome.shoulderColor : [0.85, 0.88, 0.92];
  const rearX = car.x - axes.forwardX * 1.8 + (Math.random() - 0.5) * 1.4;
  const rearZ = car.z - axes.forwardZ * 1.8 + (Math.random() - 0.5) * 1.4;
  spawnParticle(rearX, car.y + 0.15, rearZ, (Math.random() - 0.5) * 2.0, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 2.0, dustColor);
}

function spawnRainDrop(car, axes, biome) {
  if (!(biome.weatherWetness > 0.45 && Math.random() < 0.65)) return;
  const dropX = car.x + axes.forwardX * (6.0 + Math.random() * 18.0) + (Math.random() - 0.5) * 22.0;
  const dropZ = car.z + axes.forwardZ * (6.0 + Math.random() * 18.0) + (Math.random() - 0.5) * 22.0;
  spawnParticle(dropX, car.y + 7.5 + Math.random() * 4.0, dropZ, 0, -18.0, 0, [0.78, 0.88, 0.98], 0.18);
}

function spawnValleySpray(axes, roadFrame) {
  const blockInfo = roadFrame.blockInfo;
  if (!(roadFrame.onEdge && (blockInfo.leftIsValley || blockInfo.rightIsValley) && Math.random() < 0.45)) return;
  const valleySide = blockInfo.leftIsValley ? -1 : 1;
  const sprayLateral = (14.5 + Math.random() * 6.0) * valleySide;
  const sprayX = roadFrame.centerX + roadFrame.rightX * sprayLateral + axes.forwardX * (Math.random() * 24.0);
  const sprayZ = roadFrame.centerZ + roadFrame.rightZ * sprayLateral + axes.forwardZ * (Math.random() * 24.0);
  spawnParticle(sprayX, terrainHeightAt(sprayX, sprayZ) - 2.1, sprayZ, (Math.random() - 0.5) * 1.8, 2.6 + Math.random() * 2.2, (Math.random() - 0.5) * 1.8, [0.90, 0.97, 1.0], 0.36);
}

function advanceParticles(dt) {
  for (const particle of particles) {
    if (!particle.active) continue;
    particle.age += dt;
    if (particle.age >= particle.maxAge) {
      particle.active = false;
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.z += particle.vz * dt;
    particle.rot += dt * 3.0;
  }
}
