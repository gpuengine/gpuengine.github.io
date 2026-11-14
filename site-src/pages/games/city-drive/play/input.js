// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const TOUCH_BRAKE_SWIPE_PIXELS = 42;
const TOUCH_MIN_STEER_SWIPE_PIXELS = 48;
const TOUCH_STEER_SWIPE_SCREEN_FRACTION = 0.18;

const HELD_KEY_FOR_CODE = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "space"
};
const CODES_THAT_SCROLL_THE_PAGE = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];

const playerInput = {
  keys: {
    up: false,
    down: false,
    left: false,
    right: false,
    space: false
  },
  touchSteerValue: 0
};

function setHeldKey(code, isPressed) {
  const keyName = HELD_KEY_FOR_CODE[code];
  if (!keyName) return false;
  playerInput.keys[keyName] = isPressed;
  return true;
}

function bindCanvasTouchMovement({ canvas, onTouchStart }) {
  let touchId = null;
  let startX = 0;
  let startY = 0;
  const keys = playerInput.keys;
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    onTouchStart();
    if (touchId !== null) return;
    touchId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    if (!keys.down) keys.up = true;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== touchId) return;
    const swipeX = event.clientX - startX;
    const swipeY = event.clientY - startY;
    const fullSteerSwipe = Math.max(TOUCH_MIN_STEER_SWIPE_PIXELS, canvas.clientWidth * TOUCH_STEER_SWIPE_SCREEN_FRACTION);
    playerInput.touchSteerValue = clamp(-swipeX / fullSteerSwipe, -1.0, 1.0);
    const isBraking = swipeY > TOUCH_BRAKE_SWIPE_PIXELS;
    keys.up = !isBraking;
    keys.down = isBraking;
  });
  const endTouch = (event) => {
    if (event.pointerId !== touchId) return;
    touchId = null;
    playerInput.touchSteerValue = 0;
    keys.up = false;
    keys.down = false;
  };
  canvas.addEventListener("pointerup", endTouch);
  canvas.addEventListener("pointercancel", endTouch);
}

function bindHoldButton({ element, keyName, activeClass }) {
  if (!element) return;
  const activePointers = new Set();
  const setPressed = (isPressed) => {
    playerInput.keys[keyName] = isPressed;
    element.classList.toggle(activeClass, isPressed);
  };
  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    element.setPointerCapture(event.pointerId);
    activePointers.add(event.pointerId);
    setPressed(true);
  });
  const release = (event) => {
    if (!activePointers.delete(event.pointerId)) return;
    if (activePointers.size === 0) setPressed(false);
  };
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("contextmenu", (event) => event.preventDefault());
}
