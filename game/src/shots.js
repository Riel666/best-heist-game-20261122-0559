// shots.js — posed states for honest screenshots (?shot=cover/alarm/victory).
// Each pose puts the game into a state a real play session reaches, using
// the same code and the same state a player would have: only the path there
// is a query string. Posed games are frozen, so the frame never drifts.
import { TILE } from './config.js';

function place(game, tx, ty) {
  game.thief.x = (tx + 0.5) * TILE;
  game.thief.y = (ty + 0.5) * TILE;
}

function placeGuard(game, i, tx, ty, angle, state) {
  const g = game.guards[i];
  g.x = (tx + 0.5) * TILE;
  g.y = (ty + 0.5) * TILE;
  g.angle = angle;
  if (state) g.state = state;
  if (state === 'chase') g.alertFlash = 1.2;
}

export function applyShot(game, shot) {
  if (shot === 'cover') {
    // Floor 1 mid-heist: you crouch behind a desk while a guard's cone
    // sweeps past, the vault gold glowing across the lobby, meter part full.
    game.frozen = true;
    game.startGame();
    game.time = 12.5;
    place(game, 5, 8);
    game.thief.angle = Math.PI / 2;
    game.thief.sneaking = true;
    placeGuard(game, 0, 10, 5, Math.PI / 2);
    placeGuard(game, 1, 15, 10, -Math.PI / 2);
    game.cameras[0].angle = Math.PI / 2 + 0.5;
    game.cameras[1].angle = Math.PI / 2 - 0.6;
    game.meter = 34;
    game.say('Stay low. Rook is sweeping the lobby — the vault is straight ahead.');
    game.updateHud();
    return 'cover';
  }
  if (shot === 'alarm') {
    // Floor 2, the alarm sounding: the meter nearly full, the laser grid
    // live, guards converging on you as you dive for the terminal.
    game.frozen = true;
    game.loadLevel(1);
    game.time = 2.0; // inside the laser grid's live window
    game.alarm = true;
    game.alarmedEver = true;
    game.meter = 96;
    game.sfx.startAlarm();
    place(game, 10, 13);
    game.thief.angle = -Math.PI / 2;
    placeGuard(game, 0, 8, 11, Math.PI / 4, 'chase');
    placeGuard(game, 1, 13, 12, -Math.PI * 0.75, 'chase');
    placeGuard(game, 2, 12, 8, Math.PI / 2, 'chase');
    game.cameras[0].angle = Math.PI / 2 + 0.7;
    game.cameras[1].angle = Math.PI / 2 - 0.4;
    game.cameras[2].angle = Math.PI - 0.3;
    game.say('ALARM! Every guard is coming for you — break away and hide!');
    game.updateHud();
    return 'alarm';
  }
  if (shot === 'victory') {
    // The win screen after the third floor, with the final score.
    game.frozen = true;
    game.startGame();
    game.loadLevel(2);
    game.time = 40.0;
    game.score = 3420;
    game.levelScore = 1180;
    game.goldGrabbed = true;
    game.vanLeft = 18;
    place(game, 20, 14);
    game.thief.angle = Math.PI;
    placeGuard(game, 0, 5, 3, 0);
    placeGuard(game, 1, 16, 4, Math.PI / 2);
    game.meter = 12;
    game.state = 'win';
    game.showOverlay('HEIST COMPLETE', 'Three floors, one clean getaway. Final score 3420 — the Meridian Bank will not miss the gold until morning.', 'R — play it again');
    game.updateHud();
    return 'victory';
  }
  return null;
}
