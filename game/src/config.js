// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// The top 64 px are the HUD bar; the museum floor runs from y=76 to y=708.

export const FIELD = { width: 1280, height: 720, hudHeight: 64, floorTop: 76, floorBottom: 708 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  speed: 215,
  pickupRadius: 30,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 92,
  huntSpeed: 158,
  /** How far a guard can see, in pixels. */
  range: 255,
  /** Half the vision cone's angle, in radians. */
  halfAngle: 0.62,
  /** Seconds a guard waits at each patrol waypoint. */
  pauseAtWaypoint: 0.9,
  /** Suspicion 0..1 gained per second while the thief is in the cone. */
  suspicionGain: 1.35,
  suspicionDecay: 0.45,
  /** Above this suspicion the guard hunts the thief's last seen spot. */
  huntAt: 0.55,
};

export const CAMERA = {
  range: 305,
  halfAngle: 0.5,
  /** Radians per second the camera sweeps. */
  sweepSpeed: 0.55,
  /** How far, in radians, the camera swings each side of its base angle. */
  sweepAmplitude: 0.62,
};

export const ALARM = {
  /** Points per second added while a guard has eyes on the thief. */
  guardRate: 42,
  /** Points per second added while a camera has eyes on the thief. */
  cameraRate: 55,
  /** Points per second the alarm falls while nobody sees the thief. */
  decay: 15,
  max: 100,
  /** At this alarm the guards abandon patrol and hunt. */
  huntAt: 50,
};

export const TOOLS = {
  noise: { count: 3, cost: 50, throwRange: 240, hearRadius: 280, investigateSeconds: 4 },
  emp: { count: 2, cost: 100, durationSeconds: 8 },
  disguise: { count: 1, cost: 150, durationSeconds: 6, /** Guards ignore a disguised thief beyond this range. */ blindRange: 72 },
};

export const LOOT = {
  diamondValue: 5000,
  paintingValue: 300,
  cashValue: 150,
};

export const PALETTE = {
  backdrop: '#0b0d12',
  hud: '#141824',
  hudLine: '#2a3040',
  floor: '#1d212b',
  floorTile: '#222735',
  carpet: '#2e1a20',
  carpetEdge: '#4a2a32',
  wall: '#3a4152',
  wallTop: '#565f73',
  caseWood: '#5a3d24',
  caseGlass: '#8fb8c9',
  pedestal: '#2c3242',
  exitPad: '#1e4d2a',
  exitPadEdge: '#3fae5a',
  thief: '#e8e4d8',
  thiefMask: '#20242e',
  guard: '#4a6fa5',
  guardCap: '#2c4266',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneAlert: 'rgba(229, 83, 75, 0.30)',
  cameraCone: 'rgba(229, 83, 75, 0.16)',
  cameraBody: '#8a93a5',
  diamond: '#7fe7f2',
  gold: '#f2c94c',
  cash: '#7bc47f',
  text: '#eef1f5',
  muted: '#9aa3b5',
  danger: '#e5534b',
  alarmLow: '#f2c94c',
  alarmHigh: '#e5534b',
  panel: '#1a1f2c',
  panelEdge: '#3a4152',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best take is kept between visits (this browser only). */
export const BEST_KEY = 'midnight-vault.best';
