// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Vision cones are the game's language — amber while a guard patrols, red while one
// is suspicious, a red sweep for cameras, grey when an EMP killed them — so safe cover,
// danger and loot are obvious at a glance. Text that holds a number is rebuilt only when
// the number changes, so a frame allocates nothing.

import { ALARM, FIELD, FONT, PALETTE, TOOLS } from './config.js';
import { pointBlocked } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

/** The title panel's width; its height grows with its lines. */
const PANEL = { width: 660, top: 150, line: 32, bottom: 64 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const takeLabel = cachedLabel('TAKE $');
  const alarmLabel = cachedLabel('');
  const bestLabel = cachedLabel('Best take $');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  /**
   * How far a ray from (x, y) at `angle` travels before it hits a wall or a case (or
   * reaches `range`): the cone stops at cover, so what it paints is what the watcher
   * can actually see.
   */
  function traceRay(x, y, angle, range, blockers) {
    const step = 5;
    for (let distance = step; distance <= range; distance += step) {
      if (pointBlocked(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, blockers)) return distance - step;
    }
    return range;
  }

  /** A vision cone clipped by walls and cases: a fan of short rays, joined into a polygon. */
  function drawCone(x, y, angle, halfAngle, range, fill, blockers) {
    const rays = 40;
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(x, y);
    for (let index = 0; index <= rays; index += 1) {
      const rayAngle = angle - halfAngle + (2 * halfAngle * index) / rays;
      const distance = traceRay(x, y, rayAngle, range, blockers);
      context.lineTo(x + Math.cos(rayAngle) * distance, y + Math.sin(rayAngle) * distance);
    }
    context.closePath();
    context.fill();
  }

  function drawFloor(state) {
    const floor = state.level.floor;
    context.fillStyle = PALETTE.floor;
    context.fillRect(floor.x, floor.y, floor.w, floor.h);
    // Faint tile grid.
    context.strokeStyle = PALETTE.floorTile;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = floor.x + 64; x < floor.x + floor.w; x += 64) {
      context.moveTo(x, floor.y);
      context.lineTo(x, floor.y + floor.h);
    }
    for (let y = floor.y + 64; y < floor.y + floor.h; y += 64) {
      context.moveTo(floor.x, y);
      context.lineTo(floor.x + floor.w, y);
    }
    context.stroke();
    // Carpet runners.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(470, 316, 340, 190);
    context.fillRect(820, 92, 400, 190);
    context.strokeStyle = PALETTE.carpetEdge;
    context.lineWidth = 3;
    context.strokeRect(470, 316, 340, 190);
    context.strokeRect(820, 92, 400, 190);
    // Room names, faint on the floor.
    text('LOBBY', 218, 180, 26, 'rgba(238,241,245,0.16)', 'center', 'bold ');
    text('GALLERY', 610, 580, 26, 'rgba(238,241,245,0.16)', 'center', 'bold ');
    text('VAULT', 1020, 210, 26, 'rgba(238,241,245,0.16)', 'center', 'bold ');
  }

  function drawExit(state) {
    const e = state.level.exit;
    context.fillStyle = PALETTE.exitPad;
    context.fillRect(e.x, e.y, e.w, e.h);
    context.strokeStyle = PALETTE.exitPadEdge;
    context.lineWidth = 3;
    context.strokeRect(e.x, e.y, e.w, e.h);
    text('GETAWAY', e.x + e.w / 2, e.y + 30, 13, PALETTE.exitPadEdge, 'center', 'bold ');
    // A little van: body, cab and two wheels.
    context.fillStyle = PALETTE.exitPadEdge;
    context.fillRect(e.x + 14, e.y + 40, 30, 14);
    context.fillRect(e.x + 44, e.y + 44, 12, 10);
    context.fillStyle = PALETTE.backdrop;
    context.beginPath();
    context.arc(e.x + 22, e.y + 56, 4, 0, Math.PI * 2);
    context.arc(e.x + 48, e.y + 56, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawCases(state) {
    for (const c of state.level.cases) {
      context.fillStyle = PALETTE.caseWood;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.fillStyle = PALETTE.caseGlass;
      context.fillRect(c.x + 5, c.y + 5, c.w - 10, c.h - 10);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(c.x + 8, c.y + 8, c.w - 16, 5);
    }
  }

  function drawLoot(state) {
    for (const item of state.level.loot) {
      if (item.taken) continue;
      if (item.kind === 'diamond') {
        context.save();
        context.translate(item.x, item.y);
        context.rotate(Math.PI / 4);
        context.fillStyle = PALETTE.diamond;
        context.fillRect(-11, -11, 22, 22);
        context.strokeStyle = '#ffffff';
        context.lineWidth = 2;
        context.strokeRect(-11, -11, 22, 22);
        context.restore();
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(item.x - 4, item.y - 4, 2, 0, Math.PI * 2);
        context.fill();
      } else if (item.kind === 'painting') {
        context.fillStyle = PALETTE.gold;
        context.fillRect(item.x - 16, item.y - 12, 32, 24);
        context.fillStyle = '#7a5a1d';
        context.fillRect(item.x - 12, item.y - 8, 24, 16);
      } else {
        context.fillStyle = PALETTE.cash;
        context.fillRect(item.x - 12, item.y - 8, 24, 16);
        context.fillStyle = '#2c5a2e';
        context.fillRect(item.x - 12, item.y - 2, 24, 4);
      }
    }
  }

  function drawWalls(state) {
    for (const wall of state.level.walls) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.w, 3);
    }
  }

  function drawCones(state) {
    for (const camera of state.cameras) {
      const offline = camera.offlineTimer > 0;
      drawCone(
        camera.x, camera.y, camera.angle, camera.halfAngle, camera.range,
        offline ? 'rgba(140,148,160,0.10)' : PALETTE.cameraCone,
        state.level.blockers,
      );
    }
    for (const guard of state.guards) {
      const fill = guard.seesThief || guard.suspicion > 0.55 ? PALETTE.coneAlert : PALETTE.cone;
      drawCone(guard.x, guard.y, guard.angle, guard.halfAngle, guard.range, fill, state.level.blockers);
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardCap;
      context.beginPath();
      context.arc(guard.x, guard.y - 3, 9, Math.PI, 0);
      context.fill();
      context.fillRect(guard.x - 9, guard.y - 4, 18, 3);
      // A torch beam line shows which way the guard faces.
      context.strokeStyle = 'rgba(238,241,245,0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * 20, guard.y + Math.sin(guard.angle) * 20);
      context.stroke();
      if (guard.seesThief) {
        text('!', guard.x, guard.y - 22, 26, PALETTE.danger, 'center', 'bold ');
      } else if (guard.suspicion > 0.05) {
        text('?', guard.x, guard.y - 22, 22, PALETTE.alarmLow, 'center', 'bold ');
      }
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      const offline = camera.offlineTimer > 0;
      context.fillStyle = offline ? '#5a6272' : PALETTE.cameraBody;
      context.beginPath();
      context.arc(camera.x, camera.y, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = offline ? '#5a6272' : PALETTE.cameraBody;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(camera.x, camera.y);
      context.lineTo(camera.x + Math.cos(camera.angle) * 16, camera.y + Math.sin(camera.angle) * 16);
      context.stroke();
      if (offline) text('OFF', camera.x, camera.y - 12, 11, PALETTE.muted, 'center', 'bold ');
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    if (thief.disguiseTimer > 0 && Math.floor(thief.disguiseTimer * 6) % 2 === 0) {
      // The disguise flickers as it runs out.
      context.globalAlpha = 0.55;
    }
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, 13, 0, Math.PI * 2);
    context.fill();
    // Mask: a dark band across the face, plus a cap.
    context.fillStyle = PALETTE.thiefMask;
    context.fillRect(thief.x - 10, thief.y - 4, 20, 7);
    context.beginPath();
    context.arc(thief.x, thief.y - 2, 9, Math.PI, 0);
    context.fill();
    context.globalAlpha = 1;
    // Facing tick.
    context.strokeStyle = PALETTE.thief;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(thief.x, thief.y);
    context.lineTo(thief.x + Math.cos(thief.angle) * 18, thief.y + Math.sin(thief.angle) * 18);
    context.stroke();
  }

  function drawNoisePing(state) {
    const ping = state.noisePing;
    if (!ping) return;
    context.strokeStyle = 'rgba(242,201,76,0.9)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(ping.x, ping.y, 10 + (0.8 - ping.timer) * 30, 0, Math.PI * 2);
    context.stroke();
    text('CLINK', ping.x, ping.y - 16, 13, PALETTE.gold, 'center', 'bold ');
  }

  function drawHud(state, payout) {
    context.fillStyle = PALETTE.hud;
    context.fillRect(0, 0, FIELD.width, FIELD.hudHeight);
    context.fillStyle = PALETTE.hudLine;
    context.fillRect(0, FIELD.hudHeight - 2, FIELD.width, 2);
    text('THE MIDNIGHT VAULT', 24, 26, 22, PALETTE.text, 'left', 'bold ');
    text('Steal the Starlight Diamond, then reach the getaway.', 24, 50, 14, PALETTE.muted, 'left');

    // Alarm meter, centre.
    const alarm = state.alarm;
    const barX = 470;
    const barY = 18;
    const barW = 340;
    const barH = 20;
    text('ALARM', barX - 10, barY + 16, 16, alarm > 60 ? PALETTE.danger : PALETTE.text, 'right', 'bold ');
    context.fillStyle = '#0b0d12';
    context.fillRect(barX, barY, barW, barH);
    context.fillStyle = alarm > 60 ? PALETTE.alarmHigh : PALETTE.alarmLow;
    context.fillRect(barX, barY, (barW * alarm) / ALARM.max, barH);
    context.strokeStyle = PALETTE.hudLine;
    context.lineWidth = 2;
    context.strokeRect(barX, barY, barW, barH);
    text(alarmLabel(`${Math.round(alarm)}%`), barX + barW / 2, barY + 16, 14, PALETTE.text, 'center', 'bold ');
    text(state.wasSeen ? 'SPOTTED — break line of sight!' : 'Stay out of the cones.', barX + barW / 2, 52, 14, state.wasSeen ? PALETTE.danger : PALETTE.muted, 'center');

    // Take and tools, right.
    text(takeLabel(state.lootValue), 1256, 26, 22, PALETTE.gold, 'right', 'bold ');
    const tools = `1 Noise ×${state.tools.noise} ($${TOOLS.noise.cost})   2 EMP ×${state.tools.emp} ($${TOOLS.emp.cost})   3 Disguise ×${state.tools.disguise} ($${TOOLS.disguise.cost})`;
    text(tools, 1256, 50, 14, state.thief.disguiseTimer > 0 ? PALETTE.text : PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11,13,18,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 44, PALETTE.text, 'center', 'bold ');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'One thief. Three guards. Three cameras. One diamond.',
    'Read the cones before you move — amber is a patrol, red is trouble.',
    'Tools cost you: Noise $50 · EMP $100 · Disguise $150. Spend them wisely.',
    'Move with WASD or arrows, or click where to go. Keys 1 / 2 / 3 use tools.',
    'Grab the Starlight Diamond in the vault, then reach the green getaway pad.',
    '',
  ];
  const CAUGHT_LINES = ['', ''];
  const WIN_LINES = ['', '', ''];

  /** Paint one frame: the floor, then the HUD, then a panel for the screen the game is on. */
  function draw(state, screen, best, payout) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawExit(state);
    drawCases(state);
    drawLoot(state);
    drawWalls(state);
    drawCones(state);
    drawGuards(state);
    drawCameras(state);
    drawThief(state);
    drawNoisePing(state);
    drawHud(state, payout);
    if (state.spottedFlash > 0 && screen === SCREEN_PLAY) {
      text('SPOTTED!', FIELD.width / 2, 130, 34, PALETTE.danger, 'center', 'bold ');
    }
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('THE MIDNIGHT VAULT', TITLE_LINES, 'Press Space or click to start the heist');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_CAUGHT) {
      CAUGHT_LINES[0] = takeLabel(state.lootValue);
      CAUGHT_LINES[1] = bestLabel(best);
      drawPanel('CAUGHT!', CAUGHT_LINES, 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = `Loot $${state.lootValue}  −  tools $${state.toolCosts}  =  take $${payout}`;
      WIN_LINES[1] = bestLabel(best);
      WIN_LINES[2] = state.tools.noise + state.tools.emp + state.tools.disguise === 6 ? 'A perfect run — not a single tool spent.' : 'The crew splits the take. Same time tomorrow?';
      drawPanel('CLEAN GETAWAY!', WIN_LINES, 'Press Space or click to run it again');
    }
  }

  /** Convert a client (mouse) point to field coordinates, for click-to-move. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / (rect.width / FIELD.width),
      y: (clientY - rect.top) / (rect.height / FIELD.height),
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
