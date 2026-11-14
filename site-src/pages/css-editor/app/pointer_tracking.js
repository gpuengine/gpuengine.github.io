const PRIMARY_BUTTON = 0;

export function relativePointerPosition(event, surface) {
  const bounds = surface.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) / bounds.width,
    y: (event.clientY - bounds.top) / bounds.height
  };
}

export function trackPointerDrag(startEvent, surface, onMove, { isImmediate = true } = {}) {
  if (startEvent.button !== PRIMARY_BUTTON) return;
  const handleMove = (event) => onMove(relativePointerPosition(event, surface), event);
  const stopTracking = () => {
    removeEventListener("pointermove", handleMove);
    removeEventListener("pointerup", stopTracking);
    removeEventListener("pointercancel", stopTracking);
  };
  addEventListener("pointermove", handleMove);
  addEventListener("pointerup", stopTracking);
  addEventListener("pointercancel", stopTracking);
  if (isImmediate) handleMove(startEvent);
}

export function arrowKeyDelta(event, { step = 1, largeStep = 10 } = {}) {
  const amount = event.shiftKey ? largeStep : step;
  switch (event.key) {
    case "ArrowLeft": return { x: -amount, y: 0 };
    case "ArrowRight": return { x: amount, y: 0 };
    case "ArrowUp": return { x: 0, y: -amount };
    case "ArrowDown": return { x: 0, y: amount };
    default: return null;
  }
}

export function emitEvent(element, name, detail) {
  element.dispatchEvent(new CustomEvent(name, { detail }));
}
