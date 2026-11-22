// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, caught and win.
//
// ?seed=N fixes the patrol timing. ?shot=title|play|caught|win (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_LOOT, EVENT_SPOTTED, EVENT_WIN, PHASE_PLAY } from './world.js';
import { ACTION_CONFIRM, ACTION_DISGUISE, ACTION_EMP, ACTION_NOISE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best take then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.payout());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toField);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and the alarm.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.state.phase = PHASE_PLAY;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the Starlight Diamond, then reach the getaway.');
  }

  function endGame(caught) {
    screen = caught ? SCREEN_CAUGHT : SCREEN_WIN;
    const payout = world.payout();
    if (payout > best) {
      best = payout;
      saveBest(best);
    }
    announce(caught ? `Caught! Take $${world.state.lootValue}. Best $${best}.` : `Clean getaway! Take $${payout}. Best $${best}.`);
  }

  // Read this frame's presses once, whatever screen the game is on: a confirm on the
  // title screen must reach startGame, and a tool press must fire on one fixed step
  // only, never once per step of a slow frame.
  function handleActions() {
    const actions = input.takeActions();
    const pressed = {
      confirm: Boolean(actions & ACTION_CONFIRM),
      pause: Boolean(actions & ACTION_PAUSE),
      click: input.takeClick(),
      toolNoise: Boolean(actions & ACTION_NOISE),
      toolEmp: Boolean(actions & ACTION_EMP),
      toolDisguise: Boolean(actions & ACTION_DISGUISE),
    };
    if (pressed.pause && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if ((pressed.pause || pressed.confirm) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return pressed;
  }

  function step(pressed) {
    if (screen === SCREEN_TITLE) {
      const confirm = pressed.confirm;
      // One-shot presses never carry past the title screen: a tool key tapped while
      // reading the instructions must not fire on the first step of the heist.
      pressed.confirm = false;
      pressed.click = null;
      pressed.toolNoise = false;
      pressed.toolEmp = false;
      pressed.toolDisguise = false;
      if (confirm) {
        startGame();
        return;
      }
      world.step(STEP, { direction: { x: 0, y: 0 }, click: null, toolNoise: false, toolEmp: false, toolDisguise: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(
      STEP,
      { direction: input.direction(), click: pressed.click, toolNoise: pressed.toolNoise, toolEmp: pressed.toolEmp, toolDisguise: pressed.toolDisguise },
      false,
    );
    pressed.click = null;
    pressed.toolNoise = false;
    pressed.toolEmp = false;
    pressed.toolDisguise = false;
    if (events & EVENT_CAUGHT) endGame(true);
    else if (events & EVENT_WIN) endGame(false);
    else if (events & EVENT_SPOTTED) announce('Spotted! Break line of sight!');
    else if (events & EVENT_LOOT) announce(`Loot $${world.state.lootValue}.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const pressed = handleActions();
    if (pressed.confirm && (screen === SCREEN_CAUGHT || screen === SCREEN_WIN)) {
      startGame();
    } else if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(pressed);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world.payout());
  }

  // Leaving the tab pauses a running game rather than letting the alarm climb unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Midnight Vault. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
