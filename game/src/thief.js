// thief.js — you: movement, sneaking, click-to-move, and the loot you
// carry. Every bag slows you down, so a heavy thief is a slow thief: drop
// a bag with Q when you need to run light.
import { TILE, CONFIG } from './config.js';
import { walkable, findPath } from './levels.js';

export class Thief {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2; // facing up, toward the vault
    this.radius = CONFIG.playerRadius;
    this.sneaking = false;
    this.bags = 0; // loot bags carried (the vault gold counts as 2)
    this.carried = []; // {kind: 'gold'|'cash', value, tile:[x,y]}
    this.clickPath = null; // tiles toward a clicked destination
    this.clickIndex = 0;
    this.moving = false;
    this.stepPhase = 0; // drives the footstep sound and the walk bob
  }

  get speed() {
    const base = this.sneaking ? CONFIG.sneakSpeed : CONFIG.walkSpeed;
    return base * Math.max(0.55, 1 - CONFIG.bagSlowdown * this.bags);
  }

  setClickTarget(grid, tx, ty, openDoors) {
    const from = [Math.floor(this.x / TILE), Math.floor(this.y / TILE)];
    if (!walkable(grid, tx, ty, openDoors)) return;
    this.clickPath = findPath(grid, from[0], from[1], tx, ty, openDoors);
    this.clickIndex = 0;
    if (this.clickPath && this.clickPath.length > 0 && this.clickPath[0][0] === from[0] && this.clickPath[0][1] === from[1]) {
      this.clickIndex = 1;
    }
  }

  // Try to move by (dx, dy) pixels, sliding along walls instead of sticking.
  tryMove(grid, dx, dy, openDoors) {
    const r = this.radius;
    const tryAxis = (nx, ny) => {
      const corners = [
        [nx - r, ny - r], [nx + r, ny - r],
        [nx - r, ny + r], [nx + r, ny + r],
      ];
      for (const [cx, cy] of corners) {
        if (!walkable(grid, Math.floor(cx / TILE), Math.floor(cy / TILE), openDoors)) return false;
      }
      return true;
    };
    if (dx !== 0 && tryAxis(this.x + dx, this.y)) this.x += dx;
    if (dy !== 0 && tryAxis(this.x, this.y + dy)) this.y += dy;
  }

  update(dt, input, grid, openDoors) {
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    this.sneaking = input.sneak;
    if (dx !== 0 || dy !== 0) {
      // Keyboard steering cancels a click-to-move.
      this.clickPath = null;
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      this.angle = Math.atan2(dy, dx);
      this.tryMove(grid, dx * this.speed * dt, dy * this.speed * dt, openDoors);
      this.moving = true;
    } else if (this.clickPath && this.clickIndex < this.clickPath.length) {
      const [tx, ty] = this.clickPath[this.clickIndex];
      const cx = (tx + 0.5) * TILE;
      const cy = (ty + 0.5) * TILE;
      const ddx = cx - this.x;
      const ddy = cy - this.y;
      const dist = Math.hypot(ddx, ddy);
      if (dist < 4) {
        this.clickIndex++;
      } else {
        this.angle = Math.atan2(ddy, ddx);
        const move = Math.min(dist, this.speed * dt);
        this.tryMove(grid, (ddx / dist) * move, (ddy / dist) * move, openDoors);
        this.moving = true;
      }
    } else {
      this.moving = false;
    }
    if (this.moving) this.stepPhase += dt * (this.sneaking ? 5 : 9);
  }

  // Drop the lightest bag where you stand, so you can run faster.
  dropBag() {
    if (this.carried.length === 0) return null;
    let idx = 0;
    for (let i = 1; i < this.carried.length; i++) {
      if (this.carried[i].weight < this.carried[idx].weight) idx = i;
    }
    const bag = this.carried.splice(idx, 1)[0];
    this.bags -= bag.weight;
    bag.tile = [Math.floor(this.x / TILE), Math.floor(this.y / TILE)];
    return bag;
  }
}
