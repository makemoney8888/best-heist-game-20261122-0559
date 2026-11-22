// The museum floor: walls, display cases (cover that blocks sight and movement), loot,
// the getaway exit, guard patrol routes and camera mounts. One floor, three rooms — the
// lobby, the gallery and the vault — with two doors into the vault so there is always more
// than one route. Everything is plain data; the rules live in world.js, guards.js and
// cameras.js. Geometry helpers (line of sight, circle collision) live here too, since every
// module that moves or looks needs them.

import { FIELD } from './config.js';

function rect(x, y, w, h) {
  return { x, y, w, h };
}

/** True when the segment (x1,y1)-(x2,y2) touches any rectangle in `blockers`. */
export function segmentBlocked(x1, y1, x2, y2, blockers) {
  for (const b of blockers) {
    if (segmentHitsRect(x1, y1, x2, y2, b)) return true;
  }
  return false;
}

function segmentHitsRect(x1, y1, x2, y2, r) {
  // A segment hits a rectangle when an endpoint is inside it or it crosses an edge.
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  const edges = [
    [r.x, r.y, r.x + r.w, r.y],
    [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
    [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
    [r.x, r.y + r.h, r.x, r.y],
  ];
  for (const [ax, ay, bx, by] of edges) {
    if (segmentsCross(x1, y1, x2, y2, ax, ay, bx, by)) return true;
  }
  return false;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function segmentsCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d1 = cross(x3, y3, x4, y4, x1, y1);
  const d2 = cross(x3, y3, x4, y4, x2, y2);
  const d3 = cross(x1, y1, x2, y2, x3, y3);
  const d4 = cross(x1, y1, x2, y2, x4, y4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function cross(ax, ay, bx, by, px, py) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/** True when the point (x, y) lies inside any rectangle in `blockers`. */
export function pointBlocked(x, y, blockers) {
  for (const b of blockers) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** True when a circle at (x, y) with `radius` overlaps any rectangle in `blockers`. */
export function circleHits(x, y, radius, blockers) {
  for (const b of blockers) {
    const nearestX = Math.max(b.x, Math.min(x, b.x + b.w));
    const nearestY = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/** The museum. `walls` block movement and sight; `cases` do too, and read as cover. */
export function buildLevel() {
  const walls = [
    // Outer shell (the HUD bar sits above y=64, the floor runs 76..708).
    rect(0, 64, 1280, 12),
    rect(0, 708, 1280, 12),
    rect(0, 64, 12, 656),
    rect(1268, 64, 12, 656),
    // Wall A: lobby | gallery, door gap y 296..376.
    rect(424, 76, 12, 220),
    rect(424, 376, 12, 344),
    // Wall B: gallery | vault (south), door gap x 980..1060.
    rect(772, 300, 208, 12),
    rect(1060, 300, 208, 12),
    // Wall C: gallery | vault (west), door gap y 140..200.
    rect(760, 76, 12, 64),
    rect(760, 200, 12, 100),
    // Wall D: gallery | south corridor, door gap x 640..720.
    rect(436, 520, 204, 12),
    rect(720, 520, 180, 12),
  ];

  // Display cases: solid cover you can hide behind.
  const cases = [
    rect(560, 240, 90, 40),
    rect(760, 420, 90, 40),
    rect(980, 420, 90, 40),
    rect(150, 200, 40, 100),
    rect(180, 520, 90, 40),
    rect(900, 190, 80, 40),
  ];

  const loot = [
    { id: 'diamond', kind: 'diamond', name: 'Starlight Diamond', x: 1150, y: 130, value: 5000, taken: false },
    { id: 'painting1', kind: 'painting', name: 'Portrait of a Lady', x: 560, y: 100, value: 300, taken: false },
    { id: 'painting2', kind: 'painting', name: 'Landscape at Dusk', x: 1180, y: 640, value: 300, taken: false },
    { id: 'painting3', kind: 'painting', name: 'Still Life with Pears', x: 1000, y: 640, value: 300, taken: false },
    { id: 'cash1', kind: 'cash', name: 'Register cash', x: 200, y: 600, value: 150, taken: false },
    { id: 'cash2', kind: 'cash', name: 'Donation box', x: 660, y: 620, value: 150, taken: false },
  ];

  const guards = [
    {
      name: 'Gallery guard',
      waypoints: [
        { x: 520, y: 180 },
        { x: 700, y: 180 },
        { x: 700, y: 440 },
        { x: 520, y: 440 },
      ],
    },
    {
      name: 'Vault guard',
      waypoints: [
        { x: 840, y: 150 },
        { x: 1180, y: 150 },
        { x: 1180, y: 250 },
        { x: 840, y: 250 },
      ],
    },
    {
      name: 'Lobby guard',
      waypoints: [
        { x: 140, y: 460 },
        { x: 380, y: 460 },
        { x: 380, y: 340 },
        { x: 140, y: 340 },
      ],
    },
  ];

  const cameras = [
    { name: 'Vault door camera', x: 1020, y: 316, baseAngle: Math.PI / 2, phase: 0 },
    { name: 'Gallery camera', x: 640, y: 80, baseAngle: Math.PI / 2, phase: 2.1 },
    { name: 'Corridor camera', x: 700, y: 534, baseAngle: Math.PI / 2, phase: 4.2 },
  ];

  return {
    walls,
    cases,
    loot,
    guards,
    cameras,
    blockers: [...walls, ...cases],
    spawn: { x: 120, y: 660 },
    exit: rect(16, 636, 70, 68),
    floor: { x: 12, y: FIELD.floorTop, w: FIELD.width - 24, h: FIELD.floorBottom - FIELD.floorTop },
  };
}
