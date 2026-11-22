// cameras.js — the wall cameras and the laser grids. A camera sweeps its
// cone back and forth; an EMP kills every camera for a few seconds. A laser
// grid runs on a fixed cycle: it blinks a warning, goes live, then goes dark.
import { TILE, CONFIG } from './config.js';

export class Camera {
  constructor(tx, ty, angle) {
    this.x = (tx + 0.5) * TILE;
    this.y = (ty + 0.5) * TILE;
    this.baseAngle = angle;
    this.angle = angle;
    this.sweep = 0; // phase of the sweep
    this.disabledUntil = -1;
  }

  update(dt, time) {
    this.sweep = Math.sin(time * CONFIG.cameraSweepSpeed) * CONFIG.cameraSweepArc;
    this.angle = this.baseAngle + this.sweep;
  }

  isDisabled(time) {
    return time < this.disabledUntil;
  }
}

// Is the laser grid live right now? phase staggers the grids so they do not
// all blink in unison; the warn window is the last laserWarnTime seconds
// before the grid goes live.
export function laserState(time, phase = 0) {
  const t = ((time + phase) % CONFIG.laserCycle + CONFIG.laserCycle) % CONFIG.laserCycle;
  const onAt = CONFIG.laserCycle * (1 - CONFIG.laserOnFraction);
  if (t >= onAt) return 'live';
  if (t >= onAt - CONFIG.laserWarnTime) return 'warn';
  return 'off';
}
