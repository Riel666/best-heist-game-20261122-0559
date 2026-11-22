// config.js — every tuning number for the Gilded Vault heist in one place,
// so a balance change never means hunting through the game code.
export const TILE = 40;
export const COLS = 24;
export const ROWS = 16;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 640

export const CONFIG = {
  // The thief.
  walkSpeed: 148, // px per second, unladen
  sneakSpeed: 82,
  sneakDetectFactor: 0.45, // how much slower the meter fills while sneaking
  bagSlowdown: 0.08, // each carried loot bag cuts speed by 8%
  playerRadius: 13,

  // The alarm meter (0-100).
  meterFillBase: 26, // per second at point blank in a cone
  meterFillCamera: 24,
  meterLaserPerSecond: 34, // standing on a live laser grid
  meterDrain: 13, // per second while unseen
  meterDrainAlarm: 5, // per second while the alarm is sounding
  alarmHideTime: 6, // seconds unseen before the alarm stands down

  // Guards.
  guardSpeed: 62,
  guardChaseSpeed: 128,
  guardVisionRange: 205,
  guardVisionHalfAngle: 0.61, // radians, about 35 degrees
  guardCatchRadius: 20, // a guard this close catches you
  investigateTime: 4.5, // seconds a guard studies a distraction
  searchTime: 5, // seconds a guard searches where you were last seen

  // Cameras.
  cameraRange: 235,
  cameraHalfAngle: 0.52, // about 30 degrees
  cameraSweepSpeed: 0.55, // radians per second
  cameraSweepArc: 0.9, // radians either side of its facing

  // Lasers.
  laserCycle: 3.2, // seconds: on, then off, then on again
  laserOnFraction: 0.55, // share of the cycle the grid is live
  laserWarnTime: 0.5, // seconds of blinking before the grid goes live

  // Tools.
  empDuration: 6, // seconds cameras stay dead after an EMP
  smokeDuration: 5,
  smokeRadius: 95,
  coinRange: 320, // how far a tossed coin flies
  coinDistractRadius: 340, // guards inside this hear it land

  // Hacking.
  hackTime: 2.0, // seconds holding E beside a terminal

  // Scoring.
  scoreMainLoot: 500,
  scoreCash: 150,
  scoreToolPickup: 25,
  scoreGhostBonus: 300, // clear a floor without ever tripping the alarm
  scoreTimeBonusPerSecond: 8, // leftover van time, per second
  caughtPenalty: 250,
};
