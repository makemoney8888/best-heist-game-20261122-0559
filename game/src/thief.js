// The thief: movement, facing and the disguise timer. The thief walks with the keys or
// toward a clicked point, sliding along walls instead of sticking to them, and turns to face
// wherever they are going. Nothing here knows about guards, cameras or loot.

import { FIELD, THIEF } from './config.js';
import { circleHits } from './level.js';

export function createThief(spawn) {
  const thief = {
    x: spawn.x,
    y: spawn.y,
    angle: -Math.PI / 2,
    disguiseTimer: 0,
    /** Where a mouse click sent the thief, or null when steering by keys. */
    moveTarget: null,
    /** True while the disguise is running. */
    get disguised() {
      return this.disguiseTimer > 0;
    },
  };

  /**
   * One fixed step. `direction` is the normalised keyboard vector {x, y}; `clickTarget` is a
   * fresh click point in field coordinates, or null. Keys win over a click target.
   */
  function step(dt, direction, clickTarget, blockers) {
    if (thief.disguiseTimer > 0) thief.disguiseTimer = Math.max(0, thief.disguiseTimer - dt);
    if (clickTarget) thief.moveTarget = { x: clickTarget.x, y: clickTarget.y };

    let mx = direction.x;
    let my = direction.y;
    if (mx === 0 && my === 0 && thief.moveTarget) {
      const dx = thief.moveTarget.x - thief.x;
      const dy = thief.moveTarget.y - thief.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 6) {
        thief.moveTarget = null;
      } else {
        mx = dx / distance;
        my = dy / distance;
      }
    }
    if (mx === 0 && my === 0) return;

    thief.angle = Math.atan2(my, mx);
    // Move one axis at a time so the thief slides along a wall instead of stopping dead.
    const nx = thief.x + mx * THIEF.speed * dt;
    if (!circleHits(nx, thief.y, THIEF.radius, blockers)) {
      thief.x = Math.max(12 + THIEF.radius, Math.min(1268 - THIEF.radius, nx));
    }
    const ny = thief.y + my * THIEF.speed * dt;
    if (!circleHits(thief.x, ny, THIEF.radius, blockers)) {
      thief.y = Math.max(FIELD.floorTop + THIEF.radius, Math.min(FIELD.floorBottom - THIEF.radius, ny));
    }
  }

  function reset() {
    thief.x = spawn.x;
    thief.y = spawn.y;
    thief.angle = -Math.PI / 2;
    thief.disguiseTimer = 0;
    thief.moveTarget = null;
  }

  return { thief, step, reset };
}
