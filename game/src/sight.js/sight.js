// sight.js — pure sight geometry: line of sight across the tile grid, the
// vision-cone test, and the cone polygon the renderer draws. Nothing here
// touches the DOM or the game state, so the node smoke test can import it.
import { TILE } from './config.js';
import { tileAt, SOLID, DOOR } from './levels.js';

// Does a straight line from (x0, y0) to (x1, y1) cross any sight-blocking
// tile? Walls, desks, planters and terminals block sight; locked doors do
// too. Sampled along the line in quarter-tile steps.
export function hasLineOfSight(grid, x0, y0, x1, y1, openDoors) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / (TILE / 4)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const tile = tileAt(grid, tx, ty);
    if (SOLID.has(tile)) return false;
    if (tile === DOOR && !openDoors.has(tx + ',' + ty)) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Is the point (px, py) inside the vision cone of a watcher at (wx, wy)
// facing `angle`, with the given range and half-angle — and with a clear
// line of sight? Smoke clouds blank out sight entirely.
export function inVisionCone(grid, wx, wy, angle, range, halfAngle, px, py, openDoors, smokeClouds) {
  const dx = px - wx;
  const dy = py - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 12) return true; // stepped on the watcher: seen, no angle test
  if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfAngle) return false;
  if (!hasLineOfSight(grid, wx, wy, px, py, openDoors)) return false;
  for (const cloud of smokeClouds) {
    if (Math.hypot(px - cloud.x, py - cloud.y) < cloud.r) return false;
  }
  return true;
}

// The cone as a polygon, clipped by the first blocking tile along each ray,
// so the renderer draws a cone that stops at walls instead of shining
// through them.
export function conePolygon(grid, wx, wy, angle, range, halfAngle, openDoors) {
  const points = [[wx, wy]];
  const rays = 14;
  for (let i = 0; i <= rays; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    let r = range;
    const step = TILE / 3;
    for (let d = step; d <= range; d += step) {
      const px = wx + Math.cos(a) * d;
      const py = wy + Math.sin(a) * d;
      const tile = tileAt(grid, Math.floor(px / TILE), Math.floor(py / TILE));
      if (SOLID.has(tile) || (tile === DOOR && !openDoors.has(Math.floor(px / TILE) + ',' + Math.floor(py / TILE)))) {
        r = d - step / 2;
        break;
      }
    }
    points.push([wx + Math.cos(a) * r, wy + Math.sin(a) * r]);
  }
  return points;
}
