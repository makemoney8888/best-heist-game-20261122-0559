// The screenshot scenes behind ?shot=title|play|caught|win. Each one plays the real rules
// forward from a fresh world, steered by a small autopilot that reads the cones before it
// moves — the same judgement a player needs — so the frame is what a short game really looks
// like and the same seed always gives the same frame. The win scene falls back to staging
// the getaway through the world's own stageWin when the autopilot cannot finish in time.

import { FIELD, STEP, TOOLS } from './config.js';
import { circleHits, segmentBlocked } from './level.js';
import { canSee } from './guards.js';
import { EVENT_CAUGHT, EVENT_WIN, PHASE_CAUGHT, PHASE_WIN } from './world.js';
import { SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 6;
const LIMIT_SECONDS = 120;
const LOOKAHEAD = 0.3;

/** How dangerous a point is: the alarm rate someone watching it would add, plus a guard's proximity. */
function dangerAt(state, x, y) {
  let danger = 0;
  const thief = state.thief;
  for (const guard of state.guards) {
    if (canSee(guard, x, y, state.level.blockers, thief.disguised)) danger += 42;
    const distance = Math.hypot(guard.x - x, guard.y - y);
    if (distance < 140) danger += 50 * (1 - distance / 140);
  }
  for (const camera of state.cameras) {
    if (camera.offlineTimer > 0) continue;
    if (canSee(camera, x, y, state.level.blockers, false)) danger += 55;
  }
  return danger;
}

/** How far a point is from any guard's patrol route (the segments between its waypoints). */
function distanceToPatrol(state, x, y) {
  let best = Infinity;
  for (const guard of state.guards) {
    const points = guard.waypoints;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared));
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      best = Math.min(best, Math.hypot(x - px, y - py));
    }
  }
  return best;
}

const DIRECTIONS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 0.7071, y: 0.7071 },
  { x: -0.7071, y: 0.7071 },
  { x: 0.7071, y: -0.7071 },
  { x: -0.7071, y: -0.7071 },
];

/**
 * Drive the world toward a list of waypoints. The autopilot scores each way it could move
 * by progress toward the waypoint minus the danger of standing there, waits when every way
 * is watched, and after two seconds of waiting spends a tool and dashes through. Returns
 * the phase the world ended in.
 */
function driveWorld(world, seconds, waypoints, useTools, reckless) {
  const state = world.state;
  let waypointIndex = 0;
  let waitTimer = 0;
  let dashTimer = 0;
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    if (state.phase === PHASE_CAUGHT || state.phase === PHASE_WIN) break;
    const target = waypoints[Math.min(waypointIndex, waypoints.length - 1)];
    const thief = state.thief;
    const distanceToTarget = Math.hypot(target.x - thief.x, target.y - thief.y);
    if (distanceToTarget < 22 && waypointIndex < waypoints.length - 1) waypointIndex += 1;

    const input = { direction: { x: 0, y: 0 }, click: null, toolNoise: false, toolEmp: false, toolDisguise: false };
    // Spend a tool the moment someone has eyes on the thief.
    if (useTools) {
      const cameraSees = state.cameras.some((camera) => camera.seesThief);
      const guardSees = state.guards.some((guard) => guard.seesThief);
      if (cameraSees && state.tools.emp > 0) input.toolEmp = true;
      else if (guardSees && state.tools.disguise > 0) input.toolDisguise = true;
    }

    let best = DIRECTIONS[0];
    let bestScore = -Infinity;
    // Fleeing: a guard is hunting, or someone has eyes on the thief right now. Forget
    // the waypoint — get away from the nearest guard and break line of sight.
    const fleeing = state.guards.some((guard) => guard.mode === 'hunt') || state.wasSeen;
    for (const dir of DIRECTIONS) {
      const nx = thief.x + dir.x * 215 * LOOKAHEAD;
      const ny = thief.y + dir.y * 215 * LOOKAHEAD;
      if (dir.x !== 0 || dir.y !== 0) {
        if (nx < 12 || nx > 1268 || ny < 76 || ny > 708) continue;
        if (circleHits(nx, ny, 13, state.level.blockers)) continue;
      }
      const progress = distanceToTarget - Math.hypot(target.x - nx, target.y - ny);
      // Danger weighs far more than progress: walking into a cone to save a second is
      // never worth it, and standing in a cone scores worse than stepping out of it.
      // A step that ends inside a guard's personal space is refused outright.
      const danger = reckless || dashTimer > 0 ? 0 : dangerAt(state, nx, ny);
      let score;
      if (fleeing && !reckless && dashTimer <= 0) {
        // Flee to cover that is off the patrol routes: a spot the hunting guard will
        // walk through is no refuge at all. "Hidden" here means no line of sight from
        // any angle — a cone that is sweeping will find an exposed spot a moment later.
        let nearestGuard = Infinity;
        let hidden = true;
        for (const guard of state.guards) {
          nearestGuard = Math.min(nearestGuard, Math.hypot(guard.x - nx, guard.y - ny));
          const distance = Math.hypot(guard.x - nx, guard.y - ny);
          if (distance <= guard.range && !segmentBlocked(guard.x, guard.y, nx, ny, state.level.blockers)) hidden = false;
        }
        for (const camera of state.cameras) {
          if (camera.offlineTimer > 0) continue;
          const distance = Math.hypot(camera.x - nx, camera.y - ny);
          if (distance <= camera.range && !segmentBlocked(camera.x, camera.y, nx, ny, state.level.blockers)) hidden = false;
        }
        const clearance = Math.min(distanceToPatrol(state, nx, ny), 150);
        score = (hidden ? 300 : 0) + nearestGuard * 1 + clearance - Math.hypot(target.x - nx, target.y - ny) * 0.05;
      } else {
        score = progress * 2 - danger * 3;
        if (!reckless && dashTimer <= 0) {
          if (danger > 0) score -= 300;
          for (const guard of state.guards) {
            if (Math.hypot(guard.x - nx, guard.y - ny) < 60) score -= 1000;
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = dir;
      }
    }
    if (best.x === 0 && best.y === 0) {
      waitTimer += STEP;
      if (useTools && waitTimer > 2) {
        // Watched from every side: spend a tool, then dash through while it lasts.
        if (state.cameras.some((c) => c.offlineTimer <= 0) && state.tools.emp > 0) input.toolEmp = true;
        else if (state.tools.disguise > 0) input.toolDisguise = true;
        else if (state.tools.noise > 0) input.toolNoise = true;
        dashTimer = 1.6;
        waitTimer = 0;
      }
    } else {
      waitTimer = 0;
    }
    if (dashTimer > 0) {
      dashTimer -= STEP;
      const dx = target.x - thief.x;
      const dy = target.y - thief.y;
      const length = Math.hypot(dx, dy) || 1;
      input.direction = { x: dx / length, y: dy / length };
    } else {
      input.direction = best;
    }
    const events = world.step(STEP, input, false);
    if (events & EVENT_CAUGHT) break;
    if (events & EVENT_WIN) break;
  }
  return state.phase;
}

const PLAY_WAYPOINTS = [
  { x: 200, y: 500 },
  { x: 380, y: 336 },
  { x: 500, y: 336 },
  { x: 560, y: 280 },
  { x: 600, y: 200 },
  { x: 560, y: 110 },
];

const WIN_WAYPOINTS = [
  { x: 200, y: 500 },
  { x: 380, y: 336 },
  { x: 500, y: 336 },
  { x: 640, y: 260 },
  { x: 700, y: 170 },
  { x: 820, y: 170 },
  { x: 1150, y: 130 },
  { x: 820, y: 170 },
  { x: 1020, y: 340 },
  { x: 1020, y: 480 },
  { x: 700, y: 580 },
  { x: 380, y: 580 },
  { x: 380, y: 336 },
  { x: 200, y: 500 },
  { x: 51, y: 670 },
];

/**
 * Set `world` to the named scene (title, play, caught or win; any other name is title) and
 * return the screen to draw over it and the best take to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    world.state.phase = 'play';
    driveWorld(world, 30, PLAY_WAYPOINTS, false);
    if (world.state.phase === PHASE_CAUGHT) {
      // The lobby crossing caught the thief out: stage a fresh run already inside the
      // gallery, tucked behind the big display case where the patrols cannot see, and
      // let the cones sweep past for a while.
      world.reset();
      world.state.phase = 'play';
      world.state.thief.x = 805;
      world.state.thief.y = 480;
      driveWorld(world, 12, [{ x: 805, y: 480 }], false);
    }
    const over = world.state.phase === PHASE_CAUGHT;
    return { screen: over ? SCREEN_CAUGHT : SCREEN_PLAY, best: world.state.lootValue };
  }
  if (name === 'caught') {
    world.state.phase = 'play';
    // First slip into the middle of the gallery guard's patrol, reading the cones like a
    // careful player; then stand out in the open and wait for the alarm to catch up.
    driveWorld(world, 60, [{ x: 610, y: 300 }], false, false);
    const input = { direction: { x: 0, y: 0 }, click: null, toolNoise: false, toolEmp: false, toolDisguise: false };
    if (world.state.phase === PHASE_CAUGHT && Math.hypot(world.state.thief.x - 610, world.state.thief.y - 300) > 60) {
      // Caught on the way in, not in the gallery: stage the thief in the patrol's middle
      // and let the guard come to them.
      world.reset();
      world.state.phase = 'play';
      world.state.thief.x = 610;
      world.state.thief.y = 300;
    }
    for (let index = 0; index < 60 / STEP && world.state.phase !== PHASE_CAUGHT; index += 1) {
      world.step(STEP, input, false);
    }
    if (world.state.phase !== PHASE_CAUGHT) {
      // The guard walked away: stand where it patrols and wait to be seen.
      world.state.thief.x = 610;
      world.state.thief.y = 300;
      for (let index = 0; index < LIMIT_SECONDS / STEP && world.state.phase !== PHASE_CAUGHT; index += 1) {
        world.step(STEP, input, false);
      }
    }
    return { screen: SCREEN_CAUGHT, best: world.state.lootValue };
  }
  if (name === 'win') {
    world.state.phase = 'play';
    driveWorld(world, LIMIT_SECONDS, WIN_WAYPOINTS, true);
    if (world.state.phase !== PHASE_WIN) world.stageWin();
    return { screen: SCREEN_WIN, best: world.payout() };
  }
  // Title: let the patrols walk for a while behind the panel.
  for (let index = 0; index < TITLE_SECONDS / STEP; index += 1) {
    world.step(STEP, { direction: { x: 0, y: 0 }, click: null, toolNoise: false, toolEmp: false, toolDisguise: false }, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}

export { FIELD, STEP, TOOLS };
