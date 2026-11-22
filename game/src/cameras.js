// Security cameras: wall-mounted, sweeping cones. A camera sweeps back and forth around its
// base angle; an EMP blast takes every camera offline for a while, and the renderer shows the
// dead cone as a grey stump. Cameras never move, so their only state is the sweep clock and
// the offline timer.

import { CAMERA } from './config.js';
import { canSee } from './guards.js';

export function createCameras(definitions) {
  const cameras = definitions.map((def) => ({
    name: def.name,
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    phase: def.phase,
    angle: def.baseAngle,
    clock: def.phase,
    offlineTimer: 0,
    /** True this step when the camera has eyes on the thief. */
    seesThief: false,
    range: CAMERA.range,
    halfAngle: CAMERA.halfAngle,
  }));

  /** Advance every camera one fixed step. Returns true when any camera sees the thief. */
  function step(dt, thief, blockers) {
    let anySees = false;
    for (const camera of cameras) {
      camera.clock += dt;
      camera.angle = camera.baseAngle + Math.sin(camera.clock * CAMERA.sweepSpeed * 2 + camera.phase) * CAMERA.sweepAmplitude;
      if (camera.offlineTimer > 0) {
        camera.offlineTimer = Math.max(0, camera.offlineTimer - dt);
        camera.seesThief = false;
        continue;
      }
      camera.seesThief = canSee(camera, thief.x, thief.y, blockers, false);
      if (camera.seesThief) anySees = true;
    }
    return anySees;
  }

  /** Take every camera offline for `seconds` (an EMP blast). */
  function blackout(seconds) {
    for (const camera of cameras) camera.offlineTimer = Math.max(camera.offlineTimer, seconds);
  }

  return { cameras, step, blackout };
}
