// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

import { clamp, damp, dampAngle, forwardFromYaw } from "./math.js";

const ORBIT_PITCH_LIMIT = Math.PI / 2 - 0.05;
const ORBIT_DRAG_RADIANS_PER_PIXEL = 0.006;
const ORBIT_ZOOM_PER_WHEEL_PIXEL = 0.0012;

export class Camera {
  constructor({ position = [0, 4, 10], target = [0, 0, 0], up = [0, 1, 0], fieldOfView = 60, near = 0.1, far = 600 } = {}) {
    this.position = [...position];
    this.target = [...target];
    this.up = [...up];
    this.fieldOfView = fieldOfView;
    this.near = near;
    this.far = far;
  }

  lookAt(target) {
    this.target = [...target];
    return this;
  }

  yaw() {
    return Math.atan2(-(this.target[0] - this.position[0]), -(this.target[2] - this.position[2]));
  }
}

export class ChaseCamera {
  constructor(camera, subject, { distance = 7.4, height = 2.45, lookAhead = 14, lookHeight = 0.85, stiffness = 8.5, speedFieldOfView = 0 } = {}) {
    this.camera = camera;
    this.subject = subject;
    Object.assign(this, { distance, height, lookAhead, lookHeight, stiffness, speedFieldOfView });
    this.baseFieldOfView = camera.fieldOfView;
    this.followYaw = subject.yaw;
    this.snap();
  }

  snap() {
    this.followYaw = this.subject.yaw;
    this.place(1);
  }

  update(deltaSeconds) {
    this.followYaw = dampAngle(this.followYaw, this.subject.yaw, this.stiffness, deltaSeconds);
    this.place(1 - Math.exp(-this.stiffness * deltaSeconds));
    const speed = Math.abs(this.subject.speed);
    this.camera.fieldOfView = this.baseFieldOfView + clamp(speed / 40, 0, 1) * this.speedFieldOfView;
  }

  place(follow) {
    const [subjectX, subjectY, subjectZ] = this.subject.position;
    const [forwardX, , forwardZ] = forwardFromYaw(this.followYaw);
    const camera = this.camera;
    const wanted = [subjectX - forwardX * this.distance, subjectY + this.height, subjectZ - forwardZ * this.distance];
    const wantedTarget = [subjectX + forwardX * this.lookAhead, subjectY + this.lookHeight, subjectZ + forwardZ * this.lookAhead];
    for (let axis = 0; axis < 3; axis++) {
      camera.position[axis] += (wanted[axis] - camera.position[axis]) * follow;
      camera.target[axis] += (wantedTarget[axis] - camera.target[axis]) * Math.min(1, follow * 1.2);
    }
  }
}

export class OrbitCamera {
  constructor(camera, element, { target = [0, 0, 0], distance = 12, yaw = 0.6, pitch = 0.45, minDistance = 2, maxDistance = 80, autoRotateSpeed = 0, subject = null, ignoreTouch = false } = {}) {
    this.camera = camera;
    this.element = element;
    this.focus = [...target];
    Object.assign(this, { distance, yaw, pitch, minDistance, maxDistance, autoRotateSpeed, subject, ignoreTouch });
    this.smoothYaw = yaw;
    this.smoothPitch = pitch;
    this.smoothDistance = distance;
    this.activePointers = new Map();
    this.listeners = this.attach();
    this.update(0);
  }

  attach() {
    const element = this.element;
    const onPointerDown = (event) => {
      if (this.ignoreTouch && event.pointerType === "touch") return;
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      element.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
      const previous = this.activePointers.get(event.pointerId);
      if (!previous) return;
      if (this.activePointers.size === 1) {
        this.yaw -= (event.clientX - previous.x) * ORBIT_DRAG_RADIANS_PER_PIXEL;
        this.pitch = clamp(this.pitch + (event.clientY - previous.y) * ORBIT_DRAG_RADIANS_PER_PIXEL, -ORBIT_PITCH_LIMIT, ORBIT_PITCH_LIMIT);
      } else {
        const [first, second] = [...this.activePointers.values()];
        const before = Math.hypot(first.x - second.x, first.y - second.y);
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const [newFirst, newSecond] = [...this.activePointers.values()];
        const after = Math.hypot(newFirst.x - newSecond.x, newFirst.y - newSecond.y);
        if (after > 0) this.zoomBy(before / after);
      }
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };
    const onPointerUp = (event) => this.activePointers.delete(event.pointerId);
    const onWheel = (event) => {
      event.preventDefault();
      this.zoomBy(Math.exp(event.deltaY * ORBIT_ZOOM_PER_WHEEL_PIXEL));
    };
    const listeners = { pointerdown: onPointerDown, pointermove: onPointerMove, pointerup: onPointerUp, pointercancel: onPointerUp, wheel: onWheel };
    for (const [type, listener] of Object.entries(listeners)) element.addEventListener(type, listener, { passive: type !== "wheel" });
    element.style.touchAction = "none";
    return listeners;
  }

  zoomBy(factor) {
    this.distance = clamp(this.distance * factor, this.minDistance, this.maxDistance);
  }

  update(deltaSeconds) {
    this.yaw += this.autoRotateSpeed * deltaSeconds;
    const rate = deltaSeconds === 0 ? Infinity : 14;
    this.smoothYaw = deltaSeconds === 0 ? this.yaw : damp(this.smoothYaw, this.yaw, rate, deltaSeconds);
    this.smoothPitch = deltaSeconds === 0 ? this.pitch : damp(this.smoothPitch, this.pitch, rate, deltaSeconds);
    this.smoothDistance = deltaSeconds === 0 ? this.distance : damp(this.smoothDistance, this.distance, rate, deltaSeconds);
    const focus = this.subject ? this.subject.position : this.focus;
    const horizontal = Math.cos(this.smoothPitch) * this.smoothDistance;
    this.camera.position = [
      focus[0] + Math.sin(this.smoothYaw) * horizontal,
      focus[1] + Math.sin(this.smoothPitch) * this.smoothDistance,
      focus[2] + Math.cos(this.smoothYaw) * horizontal
    ];
    this.camera.target = [...focus];
  }

  dispose() {
    for (const [type, listener] of Object.entries(this.listeners)) this.element.removeEventListener(type, listener);
  }
}
