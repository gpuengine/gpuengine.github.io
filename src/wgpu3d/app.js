// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

import { Renderer } from "./renderer.js";
import { Scene } from "./scene.js";
import { Camera, ChaseCamera, OrbitCamera } from "./camera.js";
import { Input } from "./input.js";

const MAXIMUM_FRAME_SECONDS = 1 / 20;
const FRAME_RATE_SMOOTHING = 0.1;

export function isSupported() {
  return Boolean(globalThis.navigator?.gpu);
}

export async function createApp({ canvas, environment = "noon", camera = {}, renderer = {}, input = {} } = {}) {
  if (!canvas) throw new Error("wgpu3d: createApp needs a canvas element.");
  const createdRenderer = await Renderer.create(canvas, renderer);
  return new App({
    canvas,
    renderer: createdRenderer,
    scene: new Scene({ environment }),
    camera: new Camera(camera),
    input: new Input(canvas, input)
  });
}

export class App {
  constructor({ canvas, renderer, scene, camera, input }) {
    Object.assign(this, { canvas, renderer, scene, camera, input });
    this.cameraRig = null;
    this.updateCallbacks = [];
    this.timeSeconds = 0;
    this.framesPerSecond = 0;
    this.isRunning = false;
    this.isOnScreen = true;
    this.animationFrame = 0;
    this.lastTimestamp = null;
    this.visibilityObserver = new IntersectionObserver(([entry]) => { this.isOnScreen = entry.isIntersecting; });
    this.visibilityObserver.observe(canvas);
  }

  add(...objects) {
    this.scene.add(...objects);
    return this;
  }

  onUpdate(callback) {
    this.updateCallbacks.push(callback);
    return () => {
      this.updateCallbacks = this.updateCallbacks.filter((candidate) => candidate !== callback);
    };
  }

  follow(subject, options = {}) {
    this.cameraRig?.dispose?.();
    this.cameraRig = new ChaseCamera(this.camera, subject, options);
    return this.cameraRig;
  }

  orbit(options = {}) {
    this.cameraRig?.dispose?.();
    const sharesTouchWithMovement = Boolean(options.subject) && this.input.touchStickEnabled;
    if (!sharesTouchWithMovement) this.input.touchStickEnabled = false;
    this.cameraRig = new OrbitCamera(this.camera, this.canvas, { ignoreTouch: sharesTouchWithMovement, ...options });
    return this.cameraRig;
  }

  start() {
    if (this.isRunning) return this;
    this.isRunning = true;
    this.lastTimestamp = null;
    const tick = (timestamp) => {
      if (!this.isRunning) return;
      const deltaSeconds = this.lastTimestamp === null ? 0 : Math.min(MAXIMUM_FRAME_SECONDS, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;
      if (this.isOnScreen) this.step(deltaSeconds);
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
    return this;
  }

  stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrame);
    return this;
  }

  step(deltaSeconds) {
    this.timeSeconds += deltaSeconds;
    if (deltaSeconds > 0) this.framesPerSecond += (1 / deltaSeconds - this.framesPerSecond) * FRAME_RATE_SMOOTHING;
    const context = { app: this, scene: this.scene, input: this.input, camera: this.camera, renderer: this.renderer, deltaSeconds, timeSeconds: this.timeSeconds };
    this.scene.updateWorldMatrices();
    this.scene.runBehaviors(context);
    this.scene.updateWorldMatrices();
    for (const callback of this.updateCallbacks) callback(context);
    this.scene.updateWorldMatrices();
    this.cameraRig?.update(deltaSeconds);
    this.renderer.render(this.scene, this.camera, this.timeSeconds);
    this.input.endFrame();
  }

  dispose() {
    this.stop();
    this.visibilityObserver.disconnect();
    this.cameraRig?.dispose?.();
    this.input.dispose();
    this.renderer.dispose();
  }
}
