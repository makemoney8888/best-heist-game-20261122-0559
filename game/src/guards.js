// Guards: patrol waypoints, vision cones, suspicion and the hunt. A guard walks its route,
// pauses at each waypoint and looks around; when the thief is inside the cone, in range and
// in line of sight, suspicion climbs, the cone turns red and the guard turns toward the thief.
// Past the hunt threshold the guard leaves the route and chases the last seen spot. A thrown
// noise-maker sends nearby guards to investigate the sound instead.

import { GUARD } from './config.js';
import { circleHits, segmentBlocked } from './level.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * True when `watcher` (a guard or a camera: x, y, angle, range, halfAngle) can see the point
 * (tx, ty). A disguised thief is invisible beyond the disguise's blind range.
 */
export function canSee(watcher, tx, ty, blockers, disguised) {
  const dx = tx - watcher.x;
  const dy = ty - watcher.y;
  const distance = Math.hypot(dx, dy);
  if (distance > watcher.range) return false;
  if (disguised && distance > 72) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), watcher.angle)) > watcher.halfAngle) return false;
  return !segmentBlocked(watcher.x, watcher.y, tx, ty, blockers);
}

export function createGuards(definitions) {
  const guards = definitions.map((def) => ({
    name: def.name,
    waypoints: def.waypoints,
    x: def.waypoints[0].x,
    y: def.waypoints[0].y,
    angle: 0,
    waypointIndex: 1,
    pauseTimer: 0,
    mode: 'patrol',
    suspicion: 0,
    lastSeen: null,
    investigateTarget: null,
    investigateTimer: 0,
    /** True this step when the guard has eyes on the thief. */
    seesThief: false,
    range: GUARD.range,
    halfAngle: GUARD.halfAngle,
  }));

  function stepGuard(guard, dt, thief, blockers, alarm, noiseEvents) {
    // A noise-maker within earshot pulls the guard off its route to investigate.
    for (const noise of noiseEvents) {
      const distance = Math.hypot(noise.x - guard.x, noise.y - guard.y);
      if (distance < 280 && guard.mode !== 'hunt') {
        guard.mode = 'investigate';
        guard.investigateTarget = { x: noise.x, y: noise.y };
        guard.investigateTimer = 4;
      }
    }

    guard.seesThief = canSee(guard, thief.x, thief.y, blockers, thief.disguised);
    if (guard.seesThief) {
      guard.suspicion = Math.min(1, guard.suspicion + GUARD.suspicionGain * dt);
      guard.lastSeen = { x: thief.x, y: thief.y };
      guard.angle = Math.atan2(thief.y - guard.y, thief.x - guard.x);
      if (guard.suspicion >= GUARD.huntAt || alarm >= 50) guard.mode = 'hunt';
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
      if (guard.mode === 'hunt' && guard.suspicion <= 0.05) guard.mode = 'patrol';
    }

    const speed = guard.mode === 'hunt' ? GUARD.huntSpeed : GUARD.patrolSpeed;
    let target = null;
    if (guard.mode === 'hunt' && guard.lastSeen) target = guard.lastSeen;
    else if (guard.mode === 'investigate' && guard.investigateTarget) target = guard.investigateTarget;
    else {
      const waypoint = guard.waypoints[guard.waypointIndex];
      target = waypoint;
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        // Look around while waiting at a waypoint.
        guard.angle += dt * 1.6;
        return;
      }
    }

    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4) {
      if (guard.mode === 'patrol') {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = GUARD.pauseAtWaypoint;
      } else if (guard.mode === 'investigate') {
        guard.investigateTimer -= dt;
        guard.angle += dt * 1.8;
        if (guard.investigateTimer <= 0) {
          guard.mode = 'patrol';
          guard.investigateTarget = null;
        }
      } else if (guard.mode === 'hunt') {
        guard.mode = 'patrol';
        guard.lastSeen = null;
      }
      return;
    }
    const step = Math.min(distance, speed * dt);
    const nx = guard.x + (dx / distance) * step;
    const ny = guard.y + (dy / distance) * step;
    // Guards walk around cover, never through it.
    if (!circleHits(nx, guard.y, GUARD.radius, blockers)) guard.x = nx;
    if (!circleHits(guard.x, ny, GUARD.radius, blockers)) guard.y = ny;
    if (!guard.seesThief) guard.angle = Math.atan2(dy, dx);
  }

  /** Advance every guard one fixed step. Returns true when any guard sees the thief.
   * With `harmless` set (the title screen's backdrop) the guards only patrol: nobody
   * watches, nobody hunts, and the thief standing at the door is left alone. */
  function step(dt, thief, blockers, alarm, noiseEvents, harmless) {
    let anySees = false;
    for (const guard of guards) {
      if (harmless) {
        guard.seesThief = false;
        guard.suspicion = 0;
        if (guard.mode !== 'patrol') guard.mode = 'patrol';
        // Patrol only: walk the route, never look for the thief.
        const waypoint = guard.waypoints[guard.waypointIndex];
        if (guard.pauseTimer > 0) {
          guard.pauseTimer -= dt;
          guard.angle += dt * 1.6;
          continue;
        }
        const dx = waypoint.x - guard.x;
        const dy = waypoint.y - guard.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 4) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.pauseTimer = GUARD.pauseAtWaypoint;
          continue;
        }
        const move = Math.min(distance, GUARD.patrolSpeed * dt);
        const nx = guard.x + (dx / distance) * move;
        const ny = guard.y + (dy / distance) * move;
        if (!circleHits(nx, guard.y, GUARD.radius, blockers)) guard.x = nx;
        if (!circleHits(guard.x, ny, GUARD.radius, blockers)) guard.y = ny;
        guard.angle = Math.atan2(dy, dx);
        continue;
      }
      stepGuard(guard, dt, thief, blockers, alarm, noiseEvents);
      if (guard.seesThief) anySees = true;
    }
    return anySees;
  }

  return { guards, step };
}
