// guards.js — one guard's behaviour: patrol a route, investigate a noise,
// chase a thief it can see, search where it last saw one, then return.
// The guard never knows where you are unless a cone (or the alarm) tells it.
import { TILE, CONFIG } from './config.js';
import { findPath } from './levels.js';
import { inVisionCone } from './sight.js';

function tileCenter(tx, ty) {
  return [(tx + 0.5) * TILE, (ty + 0.5) * TILE];
}

export class Guard {
  constructor(route, speed = CONFIG.guardSpeed) {
    this.name = '';
    this.route = route;
    const [sx, sy] = tileCenter(route[0][0], route[0][1]);
    this.x = sx;
    this.y = sy;
    this.angle = 0;
    this.speed = speed;
    this.state = 'patrol'; // patrol | investigate | chase | search
    this.waypoint = 1 % route.length;
    this.path = null; // tiles toward a chase/investigate target
    this.pathIndex = 0;
    this.stateTime = 0;
    this.lastSeen = null;
    this.seenTime = 0; // seconds of continuous sight: a glimpse is not a chase
    this.chaseLost = 0; // seconds since the chase last saw you
    this.investigateTarget = null;
    this.alertFlash = 0; // seconds the "!" stays above the guard's head
  }

  // Move toward (tx, ty) in pixels, turning to face the direction of travel.
  // Returns true when arrived.
  stepToward(tx, ty, dt, speed) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) return true;
    const move = Math.min(dist, speed * dt);
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    this.angle = Math.atan2(dy, dx);
    return dist - move < 3;
  }

  followPath(dt, speed) {
    if (!this.path || this.pathIndex >= this.path.length) return true;
    const [tx, ty] = tileCenter(this.path[this.pathIndex][0], this.path[this.pathIndex][1]);
    if (this.stepToward(tx, ty, dt, speed)) this.pathIndex++;
    return this.pathIndex >= this.path.length;
  }

  setPath(grid, tx, ty, openDoors) {
    const from = [Math.floor(this.x / TILE), Math.floor(this.y / TILE)];
    this.path = findPath(grid, from[0], from[1], tx, ty, openDoors);
    this.pathIndex = 0;
    if (this.path && this.path.length > 0 && this.path[0][0] === from[0] && this.path[0][1] === from[1]) {
      this.pathIndex = 1;
    }
  }

  update(dt, game) {
    this.stateTime += dt;
    if (this.alertFlash > 0) this.alertFlash -= dt;
    const player = game.thief;
    const seen = game.alarm
      ? true // during the alarm every guard knows roughly where you are
      : inVisionCone(game.grid, this.x, this.y, this.angle, CONFIG.guardVisionRange,
          CONFIG.guardVisionHalfAngle, player.x, player.y, game.openDoors, game.tools.smokeClouds);

    if (seen) {
      this.seenTime += dt;
      this.lastSeen = { x: player.x, y: player.y };
      // A glimpse is not a chase: the guard needs a good half-second look
      // before it is sure enough to run you down. That is the fair caught
      // moment — crossing a cone edge never ends the run by itself.
      if (this.seenTime > 0.6 && this.state !== 'chase') {
        this.state = 'chase';
        this.stateTime = 0;
        this.alertFlash = 1.2;
        game.onSpotted(this);
      }
    } else {
      this.seenTime = Math.max(0, this.seenTime - dt * 2);
    }

    if (this.state === 'patrol') {
      const [wx, wy] = tileCenter(this.route[this.waypoint][0], this.route[this.waypoint][1]);
      if (this.stepToward(wx, wy, dt, this.speed)) {
        this.waypoint = (this.waypoint + 1) % this.route.length;
      }
    } else if (this.state === 'investigate') {
      if (!this.path) this.setPath(game.grid, this.investigateTarget[0], this.investigateTarget[1], game.openDoors);
      if (this.followPath(dt, this.speed * 1.35) || this.stateTime > CONFIG.investigateTime + 2) {
        this.state = 'patrol';
        this.stateTime = 0;
        this.path = null;
      }
    } else if (this.state === 'chase') {
      if (game.alarm || seen) {
        this.chaseLost = 0;
        const tx = Math.floor(player.x / TILE);
        const ty = Math.floor(player.y / TILE);
        if (!this.path || this.stateTime > 0.6) {
          this.setPath(game.grid, tx, ty, game.openDoors);
          this.stateTime = 0;
        }
        this.followPath(dt, CONFIG.guardChaseSpeed);
      } else {
        // Lost you for a moment — a path turn, a desk edge. Keep running
        // at the last seen spot for a second before giving up to search.
        this.chaseLost += dt;
        if (this.chaseLost > 1.0) {
          this.state = 'search';
          this.stateTime = 0;
          this.path = null;
        } else {
          this.followPath(dt, CONFIG.guardChaseSpeed);
        }
      }
    } else if (this.state === 'search') {
      if (!this.path && this.lastSeen) {
        this.setPath(game.grid, Math.floor(this.lastSeen.x / TILE), Math.floor(this.lastSeen.y / TILE), game.openDoors);
      }
      if (this.followPath(dt, this.speed * 1.2) || this.stateTime > CONFIG.searchTime) {
        this.state = 'patrol';
        this.stateTime = 0;
        this.path = null;
      }
    }
  }
}
