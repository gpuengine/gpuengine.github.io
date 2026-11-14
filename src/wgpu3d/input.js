// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

import { clamp } from "./math.js";

export const DEFAULT_BINDINGS = Object.freeze({
  forward: ["ArrowUp", "KeyW"],
  backward: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump: ["Space"],
  brake: ["Space"],
  run: ["ShiftLeft", "ShiftRight"],
  action: ["KeyE", "Enter"],
  camera: ["KeyC"]
});

const STICK_FULL_DEFLECTION_PIXELS = 70;
const TAP_MAX_MILLISECONDS = 220;
const TAP_MAX_TRAVEL_PIXELS = 12;
const TAP_ACTIONS = ["jump", "action"];
const STICK_ACTION_THRESHOLD = 0.35;

export class Input {
  constructor(element, { bindings = DEFAULT_BINDINGS, touchStick = true } = {}) {
    this.element = element;
    this.bindings = bindings;
    this.touchStickEnabled = touchStick;
    this.heldCodes = new Set();
    this.pressedActions = new Set();
    this.stick = { x: 0, y: 0 };
    this.touch = null;
    if (element.tabIndex < 0) element.tabIndex = 0;
    this.listeners = this.attach();
  }

  attach() {
    const listeners = {
      keydown: (event) => {
        const actions = this.actionsForCode(event.code);
        if (actions.length === 0) return;
        event.preventDefault();
        if (!this.heldCodes.has(event.code)) actions.forEach((action) => this.pressedActions.add(action));
        this.heldCodes.add(event.code);
      },
      keyup: (event) => this.heldCodes.delete(event.code),
      blur: () => this.heldCodes.clear(),
      pointerdown: (event) => this.startTouch(event),
      pointermove: (event) => this.moveTouch(event),
      pointerup: (event) => this.endTouch(event),
      pointercancel: (event) => this.endTouch(event)
    };
    for (const [type, listener] of Object.entries(listeners)) this.element.addEventListener(type, listener);
    return listeners;
  }

  actionsForCode(code) {
    return Object.keys(this.bindings).filter((action) => this.bindings[action].includes(code));
  }

  isDown(action) {
    return (this.bindings[action] ?? []).some((code) => this.heldCodes.has(code)) || this.isStickDown(action);
  }

  wasPressed(action) {
    return this.pressedActions.has(action);
  }

  press(action) {
    this.pressedActions.add(action);
  }

  axis(negativeAction, positiveAction) {
    return (this.isDown(positiveAction) ? 1 : 0) - (this.isDown(negativeAction) ? 1 : 0);
  }

  moveVector() {
    const x = clamp(this.axis("left", "right") + this.stick.x, -1, 1);
    const y = clamp(this.axis("backward", "forward") + this.stick.y, -1, 1);
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  isStickDown(action) {
    if (action === "forward") return this.stick.y > STICK_ACTION_THRESHOLD;
    if (action === "backward") return this.stick.y < -STICK_ACTION_THRESHOLD;
    if (action === "left") return this.stick.x < -STICK_ACTION_THRESHOLD;
    if (action === "right") return this.stick.x > STICK_ACTION_THRESHOLD;
    return false;
  }

  startTouch(event) {
    this.element.focus({ preventScroll: true });
    if (!this.touchStickEnabled || event.pointerType !== "touch" || this.touch) return;
    this.touch = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startTime: performance.now(), travel: 0 };
    this.element.setPointerCapture?.(event.pointerId);
  }

  moveTouch(event) {
    if (event.pointerId !== this.touch?.id) return;
    const offsetX = event.clientX - this.touch.startX;
    const offsetY = event.clientY - this.touch.startY;
    this.touch.travel = Math.max(this.touch.travel, Math.hypot(offsetX, offsetY));
    this.stick = { x: clamp(offsetX / STICK_FULL_DEFLECTION_PIXELS, -1, 1), y: clamp(-offsetY / STICK_FULL_DEFLECTION_PIXELS, -1, 1) };
  }

  endTouch(event) {
    if (event.pointerId !== this.touch?.id) return;
    const isTap = performance.now() - this.touch.startTime < TAP_MAX_MILLISECONDS && this.touch.travel < TAP_MAX_TRAVEL_PIXELS;
    if (isTap) TAP_ACTIONS.forEach((action) => this.pressedActions.add(action));
    this.touch = null;
    this.stick = { x: 0, y: 0 };
  }

  endFrame() {
    this.pressedActions.clear();
  }

  dispose() {
    for (const [type, listener] of Object.entries(this.listeners)) this.element.removeEventListener(type, listener);
  }
}
