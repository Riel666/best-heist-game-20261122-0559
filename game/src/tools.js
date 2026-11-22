// tools.js — the thief's kit: an EMP that kills the cameras, smoke pellets
// that blind every cone, and coins that pull a guard off its patrol. Each
// tool costs one charge; pickups on the floor restock you.
import { TILE, CONFIG } from './config.js';

export class ToolKit {
  constructor() {
    this.emp = 1;
    this.smoke = 1;
    this.coins = 3;
    this.empUntil = -1; // game time until which cameras stay dead
    this.smokeClouds = []; // {x, y, r, until}
    this.coinFlights = []; // {x, y, tx, ty, t} — a coin arcing to its target
    this.coinLands = []; // {x, y, until} — a landed coin guards can hear
  }

  useEmp(time) {
    if (this.emp <= 0) return false;
    this.emp--;
    this.empUntil = time + CONFIG.empDuration;
    return true;
  }

  useSmoke(time, x, y) {
    if (this.smoke <= 0) return false;
    this.smoke--;
    this.smokeClouds.push({ x, y, r: CONFIG.smokeRadius, until: time + CONFIG.smokeDuration });
    return true;
  }

  tossCoin(time, fromX, fromY, toX, toY) {
    if (this.coins <= 0) return false;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy);
    if (dist > CONFIG.coinRange) {
      toX = fromX + (dx / dist) * CONFIG.coinRange;
      toY = fromY + (dy / dist) * CONFIG.coinRange;
    }
    this.coins--;
    this.coinFlights.push({ sx: fromX, sy: fromY, x: fromX, y: fromY, tx: toX, ty: toY, t: 0 });
    return true;
  }

  // The nearest patrolling or searching guard inside earshot goes to look.
  distractGuards(guards, x, y) {
    let best = null;
    let bestDist = CONFIG.coinDistractRadius;
    for (const g of guards) {
      if (g.state === 'chase') continue;
      const d = Math.hypot(g.x - x, g.y - y);
      if (d < bestDist) {
        best = g;
        bestDist = d;
      }
    }
    if (best) {
      best.state = 'investigate';
      best.stateTime = 0;
      best.investigateTarget = [Math.floor(x / TILE), Math.floor(y / TILE)];
      best.path = null;
      best.alertFlash = 0.8;
    }
  }

  update(dt, time, guards) {
    this.smokeClouds = this.smokeClouds.filter((c) => time < c.until);
    this.coinLands = this.coinLands.filter((c) => time < c.until);
    // A tossed coin arcs to its target in about half a second, then clinks.
    for (const flight of this.coinFlights) {
      flight.t += dt * 2.2;
      const t = Math.min(1, flight.t);
      flight.x = flight.sx + (flight.tx - flight.sx) * t;
      flight.y = flight.sy + (flight.ty - flight.sy) * t;
    }
    const landed = this.coinFlights.filter((f) => f.t >= 1);
    this.coinFlights = this.coinFlights.filter((f) => f.t < 1);
    for (const f of landed) {
      this.coinLands.push({ x: f.tx, y: f.ty, until: time + 1.2 });
      this.distractGuards(guards, f.tx, f.ty);
    }
  }
}
