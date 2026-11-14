// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

import { clamp, lerp, damp, dampAngle, forwardFromYaw } from "./math.js";
import { resolveCircleAgainstColliders, circleOverlapsCollider } from "./scene.js";

const FLAT_GROUND = () => 0;
const HEAD_ON_IMPACT_ALIGNMENT = 0.75;
const HEAD_ON_BOUNCE_MIN_SPEED = 2;
const WALL_SCRAPE_KEEP_PER_HIT = 0.97;
const STEER_RESPONSE_PER_SECOND = 9.5;
const HANDBRAKE_EXTRA_STEER = 0.85;
const LOW_SPEED_STEER_FADE = 5;
const MINIMUM_TURNING_SPEED = 0.2;
const REVERSE_ACCELERATION = 14.5;
const ACCELERATION_PITCH = 0.024;
const BRAKING_PITCH = -0.038;
const STEER_ROLL_FACTOR = 0.085;
const BODY_BOB_FREQUENCY = 11;
const BODY_BOB_AMPLITUDE = 0.012;
const FRONT_WHEEL_STEER_SHARE = 0.65;
const PEDAL_DEAD_ZONE = 0.1;
const VEHICLE_BODY_HEIGHT = 1.5;
const MOVING_SPEED = 0.3;
const WALK_CYCLE_PER_METER = 2.4;
const LIMB_SWING_RADIANS = 0.7;
const AIRBORNE_LEG_TUCK = 0.5;
const GROUND_SNAP_DISTANCE = 0.05;
const FOOT_RADIUS_SHARE = 0.6;

export class VehicleController {
  constructor({ maxSpeed = 32, maxReverseSpeed = 10, acceleration = 19.5, braking = 34, coastDrag = 0.32, handbrakeDrag = 1.35, steering = 1.75, collisionRadius = 1.2, bounce = 0.22, wheelRadius = 0.33, groundHeight = FLAT_GROUND, bounds = null } = {}) {
    Object.assign(this, { maxSpeed, maxReverseSpeed, acceleration, braking, coastDrag, handbrakeDrag, steering, collisionRadius, bounce, wheelRadius, groundHeight, bounds });
    this.speed = 0;
    this.steerAngle = 0;
    this.accelerationPitch = 0;
    this.steerRoll = 0;
    this.wheelSpin = 0;
    this.isBraking = false;
    this.hitThisFrame = false;
  }

  update(object, { input, scene, deltaSeconds, timeSeconds }) {
    const move = input.moveVector();
    const isHandbrake = input.isDown("brake");
    this.applyPedals(move.y, isHandbrake, deltaSeconds);
    this.steer(object, -move.x, isHandbrake, deltaSeconds);
    this.drive(object, scene, deltaSeconds);
    this.animate(object, timeSeconds, deltaSeconds);
    object.speed = this.speed;
  }

  applyPedals(throttle, isHandbrake, deltaSeconds) {
    const isAccelerating = throttle > PEDAL_DEAD_ZONE;
    const isBrakingPedal = throttle < -PEDAL_DEAD_ZONE;
    if (isAccelerating) {
      this.speed += (1 - (this.speed / this.maxSpeed) * 0.45) * this.acceleration * throttle * deltaSeconds;
      this.accelerationPitch = lerp(this.accelerationPitch, ACCELERATION_PITCH, Math.min(1, deltaSeconds * 8));
    } else if (isBrakingPedal) {
      const strength = -throttle;
      if (this.speed > 1) {
        this.speed -= this.braking * strength * deltaSeconds;
        this.accelerationPitch = lerp(this.accelerationPitch, BRAKING_PITCH, Math.min(1, deltaSeconds * 10));
      } else {
        this.speed -= REVERSE_ACCELERATION * strength * deltaSeconds;
      }
    } else {
      this.speed *= 1 - this.coastDrag * deltaSeconds;
      this.accelerationPitch = lerp(this.accelerationPitch, 0, Math.min(1, deltaSeconds * 6));
    }
    if (isHandbrake) this.speed *= 1 - this.handbrakeDrag * deltaSeconds;
    this.speed = clamp(this.speed, -this.maxReverseSpeed, this.maxSpeed);
    this.isBraking = (isBrakingPedal && this.speed > 0) || isHandbrake;
  }

  steer(object, steerTarget, isHandbrake, deltaSeconds) {
    const speedSteerFactor = 1 / (1 + Math.abs(this.speed) * 0.019);
    this.steerAngle = lerp(this.steerAngle, steerTarget, Math.min(1, deltaSeconds * STEER_RESPONSE_PER_SECOND));
    if (Math.abs(this.speed) <= MINIMUM_TURNING_SPEED) return;
    const turnRate = this.steerAngle * (this.steering + (isHandbrake ? HANDBRAKE_EXTRA_STEER : 0)) * speedSteerFactor;
    const drivingDirection = this.speed >= 0 ? 1 : -1;
    object.yaw += turnRate * drivingDirection * deltaSeconds * Math.min(1, Math.abs(this.speed) / LOW_SPEED_STEER_FADE);
  }

  drive(object, scene, deltaSeconds) {
    const forward = forwardFromYaw(object.yaw);
    const position = object.position;
    position[0] += forward[0] * this.speed * deltaSeconds;
    position[2] += forward[2] * this.speed * deltaSeconds;
    if (this.bounds) {
      position[0] = clamp(position[0], this.bounds.minX, this.bounds.maxX);
      position[2] = clamp(position[2], this.bounds.minZ, this.bounds.maxZ);
    }
    const hit = resolveCircleAgainstColliders(position, this.collisionRadius, scene.solidColliders(object), { bottom: position[1] + 0.1, top: position[1] + VEHICLE_BODY_HEIGHT });
    this.hitThisFrame = Boolean(hit);
    if (hit) this.reactToImpact(forward, hit);
    position[1] = damp(position[1], this.groundHeight(position[0], position[2]), 18, deltaSeconds);
  }

  reactToImpact(forward, hit) {
    const travelDirection = Math.sign(this.speed) || 1;
    const impact = -(forward[0] * hit.x + forward[2] * hit.z) * travelDirection;
    const isHeadOn = impact > HEAD_ON_IMPACT_ALIGNMENT && Math.abs(this.speed) > HEAD_ON_BOUNCE_MIN_SPEED;
    this.speed = isHeadOn ? -this.speed * this.bounce : this.speed * WALL_SCRAPE_KEEP_PER_HIT;
  }

  animate(object, timeSeconds, deltaSeconds) {
    const { body, wheels = [], bodyHeight = 0 } = object.parts;
    this.steerRoll = lerp(this.steerRoll, this.steerAngle * (this.speed / 45) * STEER_ROLL_FACTOR, Math.min(1, deltaSeconds * 8));
    this.wheelSpin = (this.wheelSpin + (this.speed * deltaSeconds) / this.wheelRadius) % (Math.PI * 2);
    if (body) {
      body.pitch = this.accelerationPitch;
      body.roll = this.steerRoll;
      body.position[1] = bodyHeight + Math.sin(timeSeconds * BODY_BOB_FREQUENCY) * BODY_BOB_AMPLITUDE * Math.min(1, Math.abs(this.speed) / 20);
    }
    for (const wheel of wheels) {
      wheel.pitch = -this.wheelSpin;
      if (wheel.tags.has("front-wheel")) wheel.yaw = this.steerAngle * FRONT_WHEEL_STEER_SHARE;
    }
    object.parts.brakeLights?.forEach((light) => { light.glow = this.isBraking ? 1.2 : 0; });
  }
}

export class CharacterController {
  constructor({ walkSpeed = 3.4, runSpeed = 6.8, acceleration = 14, jumpSpeed = 7, gravity = 20, radius = 0.35, height = 1.8, stepHeight = 0.35, turnRate = 12, groundHeight = FLAT_GROUND } = {}) {
    Object.assign(this, { walkSpeed, runSpeed, acceleration, jumpSpeed, gravity, radius, height, stepHeight, turnRate, groundHeight });
    this.velocity = [0, 0, 0];
    this.isGrounded = true;
    this.walkPhase = 0;
    this.jumpCount = 0;
  }

  update(object, { input, scene, camera, deltaSeconds }) {
    this.steerVelocity(input, camera, deltaSeconds);
    if (this.isGrounded && input.wasPressed("jump")) {
      this.velocity[1] = this.jumpSpeed;
      this.isGrounded = false;
      this.jumpCount += 1;
    }
    this.velocity[1] -= this.gravity * deltaSeconds;
    const position = object.position;
    for (let axis = 0; axis < 3; axis++) position[axis] += this.velocity[axis] * deltaSeconds;
    const colliders = scene.solidColliders(object);
    resolveCircleAgainstColliders(position, this.radius, colliders, { bottom: position[1] + this.stepHeight, top: position[1] + this.height });
    this.landOnFloor(position, colliders);
    this.face(object, deltaSeconds);
    this.animate(object, deltaSeconds);
  }

  steerVelocity(input, camera, deltaSeconds) {
    const move = input.moveVector();
    const cameraYaw = camera.yaw();
    const forward = forwardFromYaw(cameraYaw);
    const right = [Math.cos(cameraYaw), 0, -Math.sin(cameraYaw)];
    const topSpeed = input.isDown("run") ? this.runSpeed : this.walkSpeed;
    const wantedX = (forward[0] * move.y + right[0] * move.x) * topSpeed;
    const wantedZ = (forward[2] * move.y + right[2] * move.x) * topSpeed;
    const control = this.isGrounded ? 1 : 0.35;
    this.velocity[0] = damp(this.velocity[0], wantedX, this.acceleration * control, deltaSeconds);
    this.velocity[2] = damp(this.velocity[2], wantedZ, this.acceleration * control, deltaSeconds);
  }

  landOnFloor(position, colliders) {
    let floor = this.groundHeight(position[0], position[2]);
    for (const collider of colliders) {
      const isBelowFeet = collider.top <= position[1] + this.stepHeight;
      if (isBelowFeet && collider.top > floor && circleOverlapsCollider(position[0], position[2], this.radius * FOOT_RADIUS_SHARE, collider)) floor = collider.top;
    }
    const isFalling = this.velocity[1] <= 0;
    if (position[1] <= floor || (isFalling && position[1] - floor < GROUND_SNAP_DISTANCE)) {
      position[1] = floor;
      this.velocity[1] = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }
  }

  face(object, deltaSeconds) {
    const horizontalSpeed = Math.hypot(this.velocity[0], this.velocity[2]);
    object.speed = horizontalSpeed;
    if (horizontalSpeed < MOVING_SPEED) return;
    object.yaw = dampAngle(object.yaw, Math.atan2(-this.velocity[0], -this.velocity[2]), this.turnRate, deltaSeconds);
  }

  animate(object, deltaSeconds) {
    const { leftLeg, rightLeg, leftArm, rightArm } = object.parts;
    if (!leftLeg) return;
    const horizontalSpeed = object.speed;
    this.walkPhase += horizontalSpeed * deltaSeconds * WALK_CYCLE_PER_METER;
    const stride = this.isGrounded ? Math.sin(this.walkPhase) * LIMB_SWING_RADIANS * Math.min(1, horizontalSpeed / this.walkSpeed) : 0;
    const tuck = this.isGrounded ? 0 : AIRBORNE_LEG_TUCK;
    leftLeg.pitch = damp(leftLeg.pitch, stride + tuck, 20, deltaSeconds);
    rightLeg.pitch = damp(rightLeg.pitch, -stride + tuck, 20, deltaSeconds);
    leftArm.pitch = damp(leftArm.pitch, -stride * 0.8 - tuck, 20, deltaSeconds);
    rightArm.pitch = damp(rightArm.pitch, stride * 0.8 - tuck, 20, deltaSeconds);
  }
}

export function spin(radiansPerSecond = 1) {
  return (object, { deltaSeconds }) => {
    object.yaw += radiansPerSecond * deltaSeconds;
  };
}

export function bob({ height = 0.25, speed = 2 } = {}) {
  let baseHeight = null;
  return (object, { timeSeconds }) => {
    baseHeight ??= object.position[1];
    object.position[1] = baseHeight + Math.sin(timeSeconds * speed) * height;
  };
}
