// render.js — one frame of the Meridian Bank at night: the marble floor,
// the gold carpet, desks and planters, the vault door, the sweeping cones,
// the laser grids, the thief and the guards. Safe cover, danger and loot are
// meant to be obvious at a glance: gold glows, danger is red, cover is dark.
import { TILE, VIEW_W, VIEW_H, CONFIG } from './config.js';
import { conePolygon } from './sight.js';
import { laserState } from './cameras.js';

function tileXY(tx, ty) {
  return [(tx + 0.5) * TILE, (ty + 0.5) * TILE];
}

export function drawGame(ctx, game) {
  const grid = game.grid;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  // Marble floor: dark blue-grey tiles with a faint checker.
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const t = grid[y][x];
      if (t === '#') continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? '#232c3d' : '#202839';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  // The gold carpet runner down the middle of each floor.
  ctx.fillStyle = '#5a3d16';
  ctx.fillRect(11 * TILE, 0, 2 * TILE, VIEW_H);

  // Laser grids: red beams across the tile, blinking before they go live.
  const laser = laserState(game.time, 0);
  for (const [lx, ly] of game.level.lasers) {
    const px = lx * TILE;
    const py = ly * TILE;
    if (laser === 'live') {
      ctx.strokeStyle = '#ff2e4d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + TILE / 2);
      ctx.lineTo(px + TILE - 4, py + TILE / 2);
      ctx.moveTo(px + TILE / 2, py + 4);
      ctx.lineTo(px + TILE / 2, py + TILE - 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,46,77,0.18)';
      ctx.fillRect(px, py, TILE, TILE);
    } else if (laser === 'warn') {
      const blink = Math.floor(game.time * 8) % 2 === 0;
      if (blink) {
        ctx.strokeStyle = '#ff8fa0';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    }
  }

  // Walls, desks, planters, terminals, doors.
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const t = grid[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (t === '#') {
        ctx.fillStyle = '#3a4358';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#4a5570';
        ctx.fillRect(px, py, TILE, 4);
      } else if (t === 'D') {
        ctx.fillStyle = '#4b3620';
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = '#6b4e2e';
        ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        ctx.fillStyle = '#2c2113';
        ctx.fillRect(px + 8, py + 8, TILE - 16, 6);
      } else if (t === 'P') {
        ctx.fillStyle = '#1e4d2b';
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2f7a44';
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, 9, 0, Math.PI * 2);
        ctx.fill();
      } else if (t === 'K') {
        const hacked = game.openDoors.size > 0;
        ctx.fillStyle = hacked ? '#1f6b3a' : '#123a5c';
        ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
        ctx.fillStyle = hacked ? '#7dffab' : '#7fd4ff';
        ctx.fillRect(px + 10, py + 10, TILE - 20, 8);
        ctx.fillStyle = '#cfe8ff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('KEYCARD', px + TILE / 2, py + TILE - 7);
      } else if (t === 'X') {
        const open = game.openDoors.has(x + ',' + y);
        if (!open) {
          ctx.fillStyle = '#7a1f2b';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#ffb3bd';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('LOCKED', px + TILE / 2, py + TILE / 2 + 4);
        }
      }
    }
  }

  // The vault: a big gold door on the wall above the gold, or a floor vault
  // where the gold sits in the open.
  const [gx, gy] = [game.level.mainLoot[0][0], game.level.mainLoot[0][1]];
  const doorTile = game.grid[gy - 1] && game.grid[gy - 1][gx] === '#' ? [gx, gy - 1] : [gx, gy];
  const [vx, vy] = tileXY(doorTile[0], doorTile[1]);
  ctx.fillStyle = '#8a6d1f';
  ctx.beginPath();
  ctx.arc(vx, vy, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(vx, vy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a6d1f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(vx, vy, 6, 0, Math.PI * 2);
  ctx.stroke();

  // Loot on the floor: gold bars and cash stacks, glowing so they read.
  for (const loot of game.lootOnFloor) {
    const [lx, ly] = tileXY(loot.tile[0], loot.tile[1]);
    const pulse = 0.6 + 0.4 * Math.sin(game.time * 3 + loot.tile[0]);
    if (loot.kind === 'gold') {
      ctx.fillStyle = `rgba(212,175,55,${0.25 + 0.3 * pulse})`;
      ctx.beginPath();
      ctx.arc(lx, ly, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(lx - 11, ly - 5, 22, 10);
      ctx.fillStyle = '#8a6d1f';
      ctx.fillRect(lx - 11, ly - 5, 22, 3);
    } else {
      ctx.fillStyle = `rgba(120,220,130,${0.25 + 0.3 * pulse})`;
      ctx.beginPath();
      ctx.arc(lx, ly, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4caf6d';
      ctx.fillRect(lx - 9, ly - 6, 18, 12);
      ctx.fillStyle = '#d7ffd9';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$', lx, ly + 4);
    }
  }

  // Tool pickups.
  for (const [tx, ty] of game.level.tools) {
    if (game.takenTools.has(tx + ',' + ty)) continue;
    const [px, py] = tileXY(tx, ty);
    ctx.fillStyle = '#7fd4ff';
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b2233';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+', px, py + 4);
  }

  // The exit: the back door with the getaway van waiting beyond it.
  const [ex, ey] = tileXY(game.level.exit[0], game.level.exit[1]);
  const exitPulse = 0.5 + 0.5 * Math.sin(game.time * 4);
  ctx.fillStyle = `rgba(88,214,141,${0.25 + 0.35 * exitPulse})`;
  ctx.fillRect(ex - 20, ey - 20, 40, 40);
  ctx.fillStyle = '#1d5c33';
  ctx.fillRect(ex - 16, ey - 16, 32, 32);
  ctx.fillStyle = '#58d68d';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VAN', ex, ey - 22);
  ctx.fillText('EXIT', ex, ey + 4);

  // Smoke clouds.
  for (const cloud of game.tools.smokeClouds) {
    ctx.fillStyle = 'rgba(180,190,205,0.45)';
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,190,205,0.3)';
    ctx.beginPath();
    ctx.arc(cloud.x - 30, cloud.y + 12, cloud.r * 0.6, 0, Math.PI * 2);
    ctx.arc(cloud.x + 28, cloud.y - 10, cloud.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vision cones: guards first, then cameras. Red when the alarm is on or
  // the watcher is chasing; amber otherwise; grey while a camera is EMP'd.
  for (const guard of game.guards) {
    const hot = game.alarm || guard.state === 'chase';
    const poly = conePolygon(game.grid, guard.x, guard.y, guard.angle,
      CONFIG.guardVisionRange, CONFIG.guardVisionHalfAngle, game.openDoors);
    ctx.fillStyle = hot ? 'rgba(255,60,60,0.30)' : 'rgba(255,196,66,0.22)';
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  for (const cam of game.cameras) {
    const dead = cam.isDisabled(game.time) || game.tools.empUntil > game.time;
    const poly = conePolygon(game.grid, cam.x, cam.y, cam.angle,
      CONFIG.cameraRange, CONFIG.cameraHalfAngle, game.openDoors);
    ctx.fillStyle = dead ? 'rgba(150,160,175,0.12)' : game.alarm ? 'rgba(255,60,60,0.26)' : 'rgba(255,120,80,0.20)';
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    ctx.fill();
    // The camera body on its wall.
    ctx.fillStyle = dead ? '#5a636e' : '#c8ccd4';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dead ? '#3a4149' : '#e33';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Landed coins, glinting.
  for (const coin of game.tools.coinLands) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const flight of game.tools.coinFlights) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(flight.x, flight.y - 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Guards: dark uniforms, a cap, a "!" when they spot you or investigate.
  for (const guard of game.guards) {
    const chasing = guard.state === 'chase';
    ctx.fillStyle = chasing ? '#7a1f2b' : '#2c3550';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8c9a3';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 8, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = '#0e1420';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 14, guard.y + Math.sin(guard.angle) * 14);
    ctx.stroke();
    if (guard.alertFlash > 0) {
      ctx.fillStyle = '#ffdf3d';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - 18);
    } else if (guard.state === 'investigate' || guard.state === 'search') {
      ctx.fillStyle = '#ffb84d';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, guard.y - 18);
    }
  }

  // The thief: a dark coat, a pale mask glint, a small bob while walking.
  const thief = game.thief;
  const bob = thief.moving ? Math.sin(thief.stepPhase) * 1.5 : 0;
  ctx.fillStyle = '#101018';
  ctx.beginPath();
  ctx.arc(thief.x, thief.y + bob, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(thief.x, thief.y + bob, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e8e4d8';
  ctx.beginPath();
  ctx.arc(thief.x, thief.y + bob, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#101018';
  ctx.fillRect(thief.x - 4, thief.y + bob - 2, 8, 2);
  // Carried bags on the thief's back.
  if (thief.bags > 0) {
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(thief.x - 12, thief.y + bob - 4, 6, 8);
  }

  // Hack progress ring over a terminal being hacked.
  if (game.hackTarget) {
    const [hx, hy] = tileXY(game.hackTarget[0], game.hackTarget[1]);
    ctx.strokeStyle = '#7fd4ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(hx, hy, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * game.hackProgress);
    ctx.stroke();
  }
}
