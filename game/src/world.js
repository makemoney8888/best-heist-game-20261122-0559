// The game's rules and state, with no drawing and no browser in it: the thief, the guards,
// the cameras, the loot, the tools and the alarm meter. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react without the world knowing about
// screens or sound. The alarm is the heart of the fairness: it climbs only while someone is
// actually looking at the thief, falls when hidden, and needs about two seconds of being
// stared at to catch you — the meter, the red cones and the SPOTTED flash are the warning.

import { ALARM, FIELD, LOOT, STEP, THIEF, TOOLS } from './config.js';
import { buildLevel } from './level.js';
import { createGuards } from './guards.js';
import { createCameras } from './cameras.js';
import { createThief } from './thief.js';
import { createRandom } from './random.js';

export const EVENT_SPOTTED = 1;
export const EVENT_LOOT = 2;
export const EVENT_TOOL = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_WIN = 16;
export const EVENT_HIDDEN = 32;

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_CAUGHT = 'caught';
export const PHASE_WIN = 'win';

function inExit(level, x, y) {
  const e = level.exit;
  return x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h;
}

export function createWorld(random) {
  const level = buildLevel();
  const thiefApi = createThief(level.spawn);
  const guardApi = createGuards(level.guards);
  const cameraApi = createCameras(level.cameras);
  const state = {
    level,
    thief: thiefApi.thief,
    guards: guardApi.guards,
    cameras: cameraApi.cameras,
    alarm: 0,
    lootValue: 0,
    toolCosts: 0,
    phase: PHASE_TITLE,
    elapsed: 0,
    tools: {
      noise: TOOLS.noise.count,
      emp: TOOLS.emp.count,
      disguise: TOOLS.disguise.count,
    },
    /** The last noise-maker throw, for the renderer to draw. */
    noisePing: null,
    /** Seconds left on the SPOTTED flash. */
    spottedFlash: 0,
    wasSeen: false,
  };

  function reset() {
    thiefApi.reset();
    for (const item of level.loot) item.taken = false;
    for (const guard of guardApi.guards) {
      guard.x = guard.waypoints[0].x;
      guard.y = guard.waypoints[0].y;
      guard.angle = 0;
      guard.waypointIndex = 1;
      guard.pauseTimer = 0;
      guard.mode = 'patrol';
      guard.suspicion = 0;
      guard.lastSeen = null;
      guard.investigateTarget = null;
      guard.investigateTimer = 0;
      guard.seesThief = false;
    }
    for (const camera of cameraApi.cameras) {
      camera.clock = camera.phase;
      camera.angle = camera.baseAngle;
      camera.offlineTimer = 0;
      camera.seesThief = false;
    }
    state.alarm = 0;
    state.lootValue = 0;
    state.toolCosts = 0;
    state.phase = PHASE_TITLE;
    state.elapsed = 0;
    state.tools.noise = TOOLS.noise.count;
    state.tools.emp = TOOLS.emp.count;
    state.tools.disguise = TOOLS.disguise.count;
    state.noisePing = null;
    state.spottedFlash = 0;
    state.wasSeen = false;
  }

  function diamondTaken() {
    return level.loot.find((item) => item.id === 'diamond').taken;
  }

  /** The take home: loot minus what the tools cost. */
  function payout() {
    return Math.max(0, state.lootValue - state.toolCosts);
  }

  function useNoise() {
    if (state.tools.noise <= 0 || state.phase !== PHASE_PLAY) return false;
    state.tools.noise -= 1;
    state.toolCosts += TOOLS.noise.cost;
    const tx = state.thief.x + Math.cos(state.thief.angle) * TOOLS.noise.throwRange;
    const ty = state.thief.y + Math.sin(state.thief.angle) * TOOLS.noise.throwRange;
    state.noisePing = { x: tx, y: ty, timer: 0.8 };
    return true;
  }

  function useEmp() {
    if (state.tools.emp <= 0 || state.phase !== PHASE_PLAY) return false;
    state.tools.emp -= 1;
    state.toolCosts += TOOLS.emp.cost;
    cameraApi.blackout(TOOLS.emp.durationSeconds);
    return true;
  }

  function useDisguise() {
    if (state.tools.disguise <= 0 || state.phase !== PHASE_PLAY) return false;
    state.tools.disguise -= 1;
    state.toolCosts += TOOLS.disguise.cost;
    state.thief.disguiseTimer = TOOLS.disguise.durationSeconds;
    return true;
  }

  /**
   * One fixed step. `input` carries the keyboard direction, a fresh click point and the tool
   * keys pressed this step. Returns event flags. With `harmless` set (the title screen's
   * backdrop) the patrols walk but nobody watches and nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.noisePing) {
      state.noisePing.timer -= dt;
      if (state.noisePing.timer <= 0) state.noisePing = null;
    }
    if (state.spottedFlash > 0) state.spottedFlash -= dt;

    thiefApi.step(dt, input.direction, input.click, level.blockers);

    const noiseEvents = [];
    if (!harmless) {
      if (input.toolNoise && useNoise()) {
        events |= EVENT_TOOL;
        noiseEvents.push({ x: state.noisePing.x, y: state.noisePing.y });
      }
      if (input.toolEmp && useEmp()) events |= EVENT_TOOL;
      if (input.toolDisguise && useDisguise()) events |= EVENT_TOOL;
    }

    const guardSees = guardApi.step(dt, state.thief, level.blockers, state.alarm, noiseEvents, harmless);
    const cameraSees = harmless ? false : cameraApi.step(dt, state.thief, level.blockers);

    if (harmless) {
      state.alarm = 0;
      return events;
    }

    const seen = guardSees || cameraSees;
    if (seen && !state.wasSeen) {
      state.spottedFlash = 1.0;
      events |= EVENT_SPOTTED;
    }
    if (!seen && state.wasSeen) events |= EVENT_HIDDEN;
    state.wasSeen = seen;

    if (guardSees) state.alarm += ALARM.guardRate * dt;
    if (cameraSees) state.alarm += ALARM.cameraRate * dt;
    if (!seen) state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    state.alarm = Math.min(ALARM.max, state.alarm);

    // Loot: walk over it to pocket it.
    for (const item of level.loot) {
      if (item.taken) continue;
      const distance = Math.hypot(item.x - state.thief.x, item.y - state.thief.y);
      if (distance < THIEF.pickupRadius) {
        item.taken = true;
        state.lootValue += item.value;
        events |= EVENT_LOOT;
      }
    }

    // A guard who touches the thief catches them on the spot.
    for (const guard of guardApi.guards) {
      if (Math.hypot(guard.x - state.thief.x, guard.y - state.thief.y) < 24) {
        state.phase = PHASE_CAUGHT;
        return events | EVENT_CAUGHT;
      }
    }
    if (state.alarm >= ALARM.max) {
      state.phase = PHASE_CAUGHT;
      return events | EVENT_CAUGHT;
    }

    // The getaway: diamond in hand, reach the green exit pad.
    if (diamondTaken() && inExit(level, state.thief.x, state.thief.y)) {
      state.phase = PHASE_WIN;
      return events | EVENT_WIN;
    }
    return events;
  }

  /**
   * Stage a win for a screenshot: the diamond is pocketed, the thief stands on the exit pad
   * with a clean getaway. Used only by the ?shot=win scene; the frame it renders is the
   * game's own win screen.
   */
  function stageWin() {
    const diamond = level.loot.find((item) => item.id === 'diamond');
    if (!diamond.taken) {
      diamond.taken = true;
      state.lootValue += diamond.value;
    }
    state.thief.x = level.exit.x + level.exit.w / 2;
    state.thief.y = level.exit.y + level.exit.h / 2;
    state.thief.angle = -Math.PI / 2;
    state.alarm = 0;
    state.phase = PHASE_WIN;
  }

  reset();
  return { state, reset, step, payout, diamondTaken, stageWin };
}

// Re-exported so the screenshot autopilot can seed its own world the same way.
export { createRandom, STEP, FIELD, LOOT };
