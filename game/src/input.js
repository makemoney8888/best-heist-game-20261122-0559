// Keyboard and pointer input. Held keys give a steering vector; one-shot presses (start or
// restart, pause, the three tools) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice. A click on the canvas sets
// a move target in field coordinates; the keys win over a click while they are held.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_NOISE = 4;
export const ACTION_EMP = 8;
export const ACTION_DISGUISE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const NOISE = new Set(['Digit1', 'Numpad1']);
const EMP = new Set(['Digit2', 'Numpad2']);
const DISGUISE = new Set(['Digit3', 'Numpad3']);

export function createInput(canvas, toField) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  let click = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (NOISE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_NOISE;
    } else if (EMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_EMP;
    } else if (DISGUISE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DISGUISE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toField(event.clientX, event.clientY);
    if (point.y > 64) click = point;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Normalised steering vector from the held keys. */
    direction() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** A fresh click point since the last call, in field coordinates, or null. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
