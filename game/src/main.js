// main.js — bootstrap: pose a shot state, run the headless self-test, or
// show the title screen; then the repaint loop. The game itself lives in
// heist.js; this file only wires it to the page.
import { HeistGame } from './heist.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const input = new Input(canvas);
const sfx = new Sfx();
const game = new HeistGame(input, sfx, canvas);
game.state = 'title'; // the title overlay covers the lobby until you start

document.getElementById('startBtn').addEventListener('click', () => {
  sfx.ensure();
  if (game.state === 'title' || game.state === 'win') {
    game.hideOverlay();
    game.startGame();
  } else if (game.state === 'levelclear') {
    game.hideOverlay();
    game.nextLevel();
  } else if (game.state === 'caught' || game.state === 'vanleft') {
    game.hideOverlay();
    game.retryLevel();
  }
});

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (game.state === 'title' && (key === 'enter' || key === ' ')) {
    sfx.ensure();
    game.hideOverlay();
    game.startGame();
    return;
  }
  if (game.state === 'levelclear') {
    game.hideOverlay();
    game.nextLevel();
    return;
  }
  if ((game.state === 'caught' || game.state === 'vanleft') && key === 'r') {
    game.hideOverlay();
    game.retryLevel();
    return;
  }
  if (game.state === 'win' && key === 'r') {
    game.hideOverlay();
    game.startGame();
  }
});

const params = new URLSearchParams(window.location.search);
if (params.get('selftest')) {
  // Headless play-test: drive the real game with the real rules, in fixed
  // 1/60 s steps (no rAF: headless --dump-dom produces no animation
  // frames), then report the result in the title and #selftest.
  const mode = params.get('selftest'); // '1' = clear floor 1, 'alarm' = get caught
  game.hideOverlay();
  game.startGame();
  game.selftest = { mode, frames: 0, result: null };
  const report = document.createElement('div');
  report.id = 'selftest';
  report.style.cssText = 'position:fixed;left:0;top:0;z-index:99;background:#000;color:#fff;font:14px monospace;padding:4px 8px;';
  document.body.appendChild(report);
  const dt = 1 / 60;
  let guard = 0;
  const trace = params.get('trace') === '1';
  const traceLines = [];
  while (!game.selftest.result && guard++ < 60 * 240) {
    game.update(dt);
    game.draw();
    if (trace && guard % 60 === 0) {
      const near = game.guards.reduce((best, g) => {
        const d = Math.hypot(g.x - game.thief.x, g.y - game.thief.y);
        return d < best.d ? { d: Math.round(d), state: g.state, name: g.name } : best;
      }, { d: 9999, state: '', name: '' });
      traceLines.push(`${game.time.toFixed(0)}s tile ${Math.floor(game.thief.x / 40)},${Math.floor(game.thief.y / 40)} meter ${Math.round(game.meter)} alarm ${game.alarm} near ${near.name} ${near.d}px ${near.state} bags ${game.thief.bags}`);
    }
    const mm = Math.floor(game.time / 60);
    const ss = String(Math.floor(game.time % 60)).padStart(2, '0');
    if (mode === '1') {
      if (game.state === 'levelclear') {
        game.selftest.result = `PASS level cleared in ${mm}:${ss} score ${game.score}`;
      } else if (game.state === 'caught') {
        game.selftest.result = 'FAIL caught';
      } else if (game.state === 'vanleft') {
        game.selftest.result = 'FAIL van left';
      }
    } else if (mode === 'alarm') {
      if (game.state === 'caught' && game.alarmedEver) {
        game.selftest.result = `PASS alarm raised then caught at ${mm}:${ss}`;
      } else if (game.state === 'caught') {
        game.selftest.result = 'FAIL caught without alarm';
      } else if (game.state === 'levelclear') {
        game.selftest.result = 'FAIL cleared the level instead of getting caught';
      }
    }
  }
  if (!game.selftest.result) game.selftest.result = 'FAIL timeout';
  report.textContent = `SELFTEST ${game.selftest.result}` + (trace ? '\n' + traceLines.join('\n') : '');
  document.title = `SELFTEST ${game.selftest.result}`;
} else {
  const shot = params.get('shot');
  if (shot) {
    // A posed screenshot state: draw one frame and stop.
    game.hideOverlay();
    applyShot(game, shot);
    game.draw();
  } else {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (game.state === 'play' && !game.frozen) game.update(dt);
      game.draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
