// heist.js — the heist itself: the state machine, the alarm meter, the
// getaway van timer, hacking, loot, scoring, the HUD, and the headless
// self-test driver that plays the real game with the real rules.
import { TILE, CONFIG } from './config.js';
import { LEVELS, parseLevel, tileAt, findPath, LASER } from './levels.js';
import { inVisionCone } from './sight.js';
import { Guard } from './guards.js';
import { Camera, laserState } from './cameras.js';
import { Thief } from './thief.js';
import { ToolKit } from './tools.js';
import { drawGame } from './render.js';

function el(id) {
  return document.getElementById(id);
}

export class HeistGame {
  constructor(input, sfx, canvas) {
    this.input = input;
    this.sfx = sfx;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'title'; // title | play | caught | vanleft | levelclear | win
    this.levelIndex = 0;
    this.score = 0;
    this.time = 0; // game clock, seconds (drives cameras and lasers)
    this._lastStep = 0;
    this.frozen = false; // a posed ?shot= state: drawn but never updated
    this.selftest = null; // {mode, frames, result} while the self-test runs
    this.loadLevel(0);
  }

  loadLevel(i) {
    this.levelIndex = i;
    this.level = parseLevel(LEVELS[i]);
    this.grid = this.level.grid;
    const [sx, sy] = this.level.spawn;
    this.thief = new Thief((sx + 0.5) * TILE, (sy + 0.5) * TILE);
    this.guards = this.level.def.guards.map((g) => {
      const guard = new Guard(g.route);
      guard.name = g.name;
      return guard;
    });
    this.cameras = this.level.def.cameras.map((c) => new Camera(c.tx, c.ty, c.angle));
    this.tools = new ToolKit();
    this.openDoors = new Set();
    this.takenTools = new Set();
    this.lootOnFloor = [];
    for (const [x, y] of this.level.mainLoot) {
      this.lootOnFloor.push({ kind: 'gold', value: CONFIG.scoreMainLoot, weight: 2, tile: [x, y] });
    }
    for (const [x, y] of this.level.cash) {
      this.lootOnFloor.push({ kind: 'cash', value: CONFIG.scoreCash, weight: 1, tile: [x, y] });
    }
    this.meter = 0;
    this.alarm = false;
    this.alarmUnseen = 0;
    this.alarmedEver = false;
    this.goldGrabbed = false;
    this.vanLeft = null; // seconds left once the gold is grabbed
    this.hackProgress = 0;
    this.hackTarget = null;
    this.state = 'play';
    this.message = '';
    this.messageUntil = 0;
    this.levelScore = 0;
    this.updateHud();
  }

  startGame() {
    this.score = 0;
    this.loadLevel(0);
  }

  say(text, seconds = 4) {
    this.message = text;
    this.messageUntil = this.time + seconds;
    const m = el('message');
    if (m) m.textContent = text;
  }

  onSpotted(guard) {
    if (!this.alarm) this.sfx.spotted();
    this.say(`Spotted by ${guard.name}! Break line of sight!`, 3);
  }

  // How fast the meter fills while this watcher sees you: closer is worse.
  meterRateFor(dist, range, base) {
    const closeness = 1 - Math.min(1, dist / range);
    return base * (0.5 + closeness);
  }

  update(dt) {
    if (this.state !== 'play') return;
    this.time += dt;
    const thief = this.thief;

    // Tools: one-shot keys, then the toolkit's own timers.
    if (this.input.take('1') && this.tools.useEmp(this.time)) {
      this.sfx.emp();
      this.say('EMP burst — cameras dark for 6 seconds.', 3);
    }
    if (this.input.take('2') && this.tools.useSmoke(this.time, thief.x, thief.y)) {
      this.say('Smoke out. They cannot see through it.', 3);
    }
    if (this.input.take('3')) {
      const tx = thief.x + Math.cos(thief.angle) * 160;
      const ty = thief.y + Math.sin(thief.angle) * 160;
      if (this.tools.tossCoin(this.time, thief.x, thief.y, tx, ty)) this.sfx.coin();
    }
    if (this.input.take('q')) {
      const bag = thief.dropBag();
      if (bag) {
        this.lootOnFloor.push(bag);
        this.say('Dropped a bag — you run lighter now.', 2);
      }
    }
    if (this.input.take('r')) {
      this.score = Math.max(0, this.score - CONFIG.caughtPenalty);
      this.loadLevel(this.levelIndex);
      this.say('Floor restarted. The crew is not impressed.', 3);
      return;
    }
    if (this.input.take('m')) {
      const muted = this.sfx.toggleMute();
      this.say(muted ? 'Sound off.' : 'Sound on.', 2);
    }
    if (this.input.click) {
      const tx = Math.floor(this.input.click.x / TILE);
      const ty = Math.floor(this.input.click.y / TILE);
      thief.setClickTarget(this.grid, tx, ty, this.openDoors);
    }
    if (this.input.coinClick) {
      if (this.tools.tossCoin(this.time, thief.x, thief.y, this.input.coinClick.x, this.input.coinClick.y)) {
        this.sfx.coin();
      }
    }
    this.input.endFrame();

    if (this.selftest) this.debugDrive(dt);

    thief.update(dt, this.input, this.grid, this.openDoors);
    for (const guard of this.guards) guard.update(dt, this);
    for (const cam of this.cameras) cam.update(dt, this.time);
    this.tools.update(dt, this.time, this.guards);

    // Footsteps: one soft tick each time the walk cycle crosses a whole step.
    const stepNow = Math.floor(thief.stepPhase);
    if (thief.moving && stepNow !== this._lastStep) {
      this._lastStep = stepNow;
      this.sfx.step(thief.sneaking);
    }

    // Hacking: hold E beside a terminal.
    this.hackTarget = null;
    if (this.input.hackHeld && this.openDoors.size === 0 && this.level.terminals.length) {
      for (const [kx, ky] of this.level.terminals) {
        const dx = (kx + 0.5) * TILE - thief.x;
        const dy = (ky + 0.5) * TILE - thief.y;
        if (Math.hypot(dx, dy) < TILE * 1.6) {
          this.hackTarget = [kx, ky];
          this.hackProgress += dt / CONFIG.hackTime;
          if (this.hackProgress >= 1) {
            for (const [dx2, dy2] of this.level.doors) this.openDoors.add(dx2 + ',' + dy2);
            this.hackProgress = 0;
            this.sfx.hackDone();
            this.say('Keycard door open. The vault is yours.', 4);
          }
          break;
        }
      }
    } else {
      this.hackProgress = Math.max(0, this.hackProgress - dt / 2);
    }

    // The alarm meter: every watcher that sees you fills it; hiding drains it.
    let seenRate = 0;
    const sneakFactor = thief.sneaking ? CONFIG.sneakDetectFactor : 1;
    for (const guard of this.guards) {
      if (inVisionCone(this.grid, guard.x, guard.y, guard.angle, CONFIG.guardVisionRange,
        CONFIG.guardVisionHalfAngle, thief.x, thief.y, this.openDoors, this.tools.smokeClouds)) {
        const d = Math.hypot(guard.x - thief.x, guard.y - thief.y);
        seenRate += this.meterRateFor(d, CONFIG.guardVisionRange, CONFIG.meterFillBase);
      }
    }
    for (const cam of this.cameras) {
      if (cam.isDisabled(this.time) || this.tools.empUntil > this.time) continue;
      if (inVisionCone(this.grid, cam.x, cam.y, cam.angle, CONFIG.cameraRange,
        CONFIG.cameraHalfAngle, thief.x, thief.y, this.openDoors, this.tools.smokeClouds)) {
        const d = Math.hypot(cam.x - thief.x, cam.y - thief.y);
        seenRate += this.meterRateFor(d, CONFIG.cameraRange, CONFIG.meterFillCamera);
      }
    }
    const thiefTile = [Math.floor(thief.x / TILE), Math.floor(thief.y / TILE)];
    if (tileAt(this.grid, thiefTile[0], thiefTile[1]) === LASER && laserState(this.time, 0) === 'live') {
      seenRate += CONFIG.meterLaserPerSecond;
      if (Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4)) this.sfx.tone(1200, 0.05, 'square', 0.03);
    }
    if (seenRate > 0) {
      this.meter = Math.min(100, this.meter + seenRate * sneakFactor * dt);
      this.alarmUnseen = 0;
    } else {
      this.meter = Math.max(0, this.meter - (this.alarm ? CONFIG.meterDrainAlarm : CONFIG.meterDrain) * dt);
      this.alarmUnseen += dt;
    }
    if (this.meter >= 100 && !this.alarm) {
      this.alarm = true;
      this.alarmedEver = true;
      this.alarmUnseen = 0;
      this.sfx.startAlarm();
      this.say('ALARM! Every guard is coming for you — break away and hide!', 5);
    }
    if (this.alarm && this.alarmUnseen >= CONFIG.alarmHideTime) {
      this.alarm = false;
      this.meter = 55;
      this.sfx.stopAlarm();
      this.say('They lost you. The alarm stands down — stay out of the cones.', 4);
    }

    // Pickups: loot and tool kits on your tile.
    for (let i = this.lootOnFloor.length - 1; i >= 0; i--) {
      const loot = this.lootOnFloor[i];
      if (loot.tile[0] === thiefTile[0] && loot.tile[1] === thiefTile[1]) {
        this.lootOnFloor.splice(i, 1);
        thief.carried.push(loot);
        thief.bags += loot.weight;
        this.score += loot.value;
        this.levelScore += loot.value;
        this.sfx.pickup();
        if (loot.kind === 'gold' && !this.goldGrabbed) {
          this.goldGrabbed = true;
          this.vanLeft = this.level.def.vanTime;
          this.say(`Vault gold secured! The van leaves in ${this.vanLeft} seconds — GO!`, 5);
        } else {
          this.say(loot.kind === 'gold' ? 'More gold. Heavy, but worth it.' : 'Cash stack pocketed.', 2);
        }
      }
    }
    for (const [tx, ty] of this.level.tools) {
      const key = tx + ',' + ty;
      if (!this.takenTools.has(key) && tx === thiefTile[0] && ty === thiefTile[1]) {
        this.takenTools.add(key);
        this.tools.emp++;
        this.tools.smoke++;
        this.score += CONFIG.scoreToolPickup;
        this.levelScore += CONFIG.scoreToolPickup;
        this.sfx.pickup();
        this.say('Tool kit: +1 EMP, +1 smoke.', 3);
      }
    }

    // The getaway van timer.
    if (this.vanLeft !== null) {
      this.vanLeft -= dt;
      if (this.vanLeft <= 0) {
        this.vanLeft = 0;
        this.sfx.stopAlarm();
        this.state = 'vanleft';
        this.showOverlay('THE VAN LEFT', 'Your driver waited as long as they could. The gold stays in the bank — and so do you, until the next run.', 'R — retry this floor');
        return;
      }
    }

    // Caught: a guard closes in.
    for (const guard of this.guards) {
      if (Math.hypot(guard.x - thief.x, guard.y - thief.y) < CONFIG.guardCatchRadius) {
        this.sfx.stopAlarm();
        this.sfx.caught();
        this.state = 'caught';
        this.showOverlay('CAUGHT', `${guard.name} has you. The crew posts bail — the floor resets, minus ${CONFIG.caughtPenalty} points.`, 'R — retry this floor');
        return;
      }
    }

    // The exit: only counts once the vault gold is yours.
    const [ex, ey] = this.level.exit;
    if (thiefTile[0] === ex && thiefTile[1] === ey) {
      if (!this.goldGrabbed) {
        this.say('The van is here — but the job is not done. Grab the vault gold first.', 3);
      } else {
        this.finishLevel();
        return;
      }
    }

    if (this.time > this.messageUntil && this.message) {
      this.message = '';
      const m = el('message');
      if (m) m.textContent = '';
    }
    this.updateHud();
  }

  finishLevel() {
    let bonus = 0;
    if (!this.alarmedEver) bonus += CONFIG.scoreGhostBonus;
    if (this.vanLeft !== null) bonus += Math.round(this.vanLeft) * CONFIG.scoreTimeBonusPerSecond;
    this.score += bonus;
    this.levelScore += bonus;
    this.sfx.stopAlarm();
    this.sfx.win();
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.state = 'win';
      this.showOverlay('HEIST COMPLETE', `Three floors, one clean getaway. Final score ${this.score} — the Meridian Bank will not miss the gold until morning.`, 'R — play it again');
    } else {
      this.state = 'levelclear';
      this.showOverlay(`${this.level.def.name} — CLEAR`, `Loot banked: ${this.levelScore} points${!this.alarmedEver ? ' (ghost bonus — never spotted)' : ''}${this.vanLeft !== null ? `, van time bonus ${Math.round(this.vanLeft) * CONFIG.scoreTimeBonusPerSecond}` : ''}. Total score ${this.score}.`, 'Any key — next floor');
    }
    this.updateHud();
  }

  nextLevel() {
    if (this.state === 'levelclear') this.loadLevel(this.levelIndex + 1);
    else if (this.state === 'win' || this.state === 'caught' || this.state === 'vanleft') this.startGame();
  }

  retryLevel() {
    this.score = Math.max(0, this.score - CONFIG.caughtPenalty);
    this.loadLevel(this.levelIndex);
  }

  showOverlay(title, body, hint) {
    const overlay = el('overlay');
    if (!overlay) return;
    el('overlayTitle').textContent = title;
    el('overlayBody').textContent = body;
    el('overlayHint').textContent = hint;
    // The one button does what the screen asks for: start, advance, retry.
    const btn = el('startBtn');
    if (btn) {
      btn.textContent = this.state === 'levelclear' ? 'NEXT FLOOR'
        : this.state === 'win' ? 'PLAY IT AGAIN'
        : this.state === 'caught' || this.state === 'vanleft' ? 'RETRY THIS FLOOR'
        : 'START THE HEIST';
    }
    overlay.classList.remove('hidden');
  }

  hideOverlay() {
    const overlay = el('overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  updateHud() {
    const set = (id, text) => {
      const n = el(id);
      if (n) n.textContent = text;
    };
    set('levelName', this.level.def.name);
    set('score', `Score ${this.score}`);
    set('loot', `Loot ${this.thief.bags} bag${this.thief.bags === 1 ? '' : 's'}`);
    set('tools', `EMP ${this.tools.emp} · Smoke ${this.tools.smoke} · Coins ${this.tools.coins}`);
    const fill = el('alertFill');
    if (fill) {
      fill.style.width = `${this.meter}%`;
      fill.style.background = this.alarm ? '#e33' : this.meter > 55 ? '#f5a623' : '#58d68d';
    }
    const label = el('alertLabel');
    if (label) label.textContent = this.alarm ? 'ALARM' : `Alert ${Math.round(this.meter)}%`;
    const van = el('vanTimer');
    if (van) {
      van.textContent = this.vanLeft === null ? '' : `VAN ${Math.ceil(this.vanLeft)}s`;
      van.style.color = this.vanLeft !== null && this.vanLeft <= 10 ? '#ff5b6e' : '#ffd94d';
    }
    const dots = el('levelDots');
    if (dots) {
      dots.textContent = LEVELS.map((_, i) => (i < this.levelIndex ? '●' : i === this.levelIndex ? '◉' : '○')).join(' ');
    }
  }

  draw() {
    drawGame(this.ctx, this);
  }

  // -- The headless self-test driver -------------------------------------
  // Plays the real game with the real rules: it walks to the vault gold,
  // then to the van, waiting whenever the next tile sits inside a vision
  // cone or on a live laser. Mode 'alarm' instead walks straight at the
  // nearest guard, to prove the alarm and the caught path.
  tileDangerous(tx, ty) {
    const cx = (tx + 0.5) * TILE;
    const cy = (ty + 0.5) * TILE;
    for (const guard of this.guards) {
      if (inVisionCone(this.grid, guard.x, guard.y, guard.angle, CONFIG.guardVisionRange,
        CONFIG.guardVisionHalfAngle, cx, cy, this.openDoors, [])) return true;
    }
    for (const cam of this.cameras) {
      if (cam.isDisabled(this.time) || this.tools.empUntil > this.time) continue;
      if (inVisionCone(this.grid, cam.x, cam.y, cam.angle, CONFIG.cameraRange,
        CONFIG.cameraHalfAngle, cx, cy, this.openDoors, [])) return true;
    }
    if (tileAt(this.grid, tx, ty) === LASER && laserState(this.time, 0) === 'live') return true;
    return false;
  }

  debugDrive(dt) {
    const st = this.selftest;
    if (!st) return;
    st.frames++;
    const thief = this.thief;
    this.input.sneak = false;

    if (st.mode === 'alarm') {
      // Stand in Rook's patrol path until it spots you, then kite it around
      // a loop — just slower than its chase — so the meter fills and the
      // alarm trips before it can close in. Once the alarm sounds, walk
      // straight at the guard to be caught.
      if (!st.guard) st.guard = this.guards[0];
      const g = st.guard;
      const here = [Math.floor(thief.x / TILE), Math.floor(thief.y / TILE)];
      if (this.alarm) {
        const dx = g.x - thief.x;
        const dy = g.y - thief.y;
        const d = Math.hypot(dx, dy) || 1;
        thief.angle = Math.atan2(dy, dx);
        thief.tryMove(this.grid, (dx / d) * thief.speed * dt, (dy / d) * thief.speed * dt, this.openDoors);
        thief.moving = true;
        return;
      }
      if (g.state === 'chase' || g.state === 'search') {
        // Kite: run straight away from the guard at 125 px/s — a hair
        // slower than its 128 px/s chase, so it stays on your heels inside
        // its own cone while the meter fills, and never quite catches you.
        // When a wall blocks the way, steer around it; tryMove slides you
        // along walls instead of sticking.
        const ax = thief.x - g.x;
        const ay = thief.y - g.y;
        const base = Math.atan2(ay, ax);
        const turns = [0, Math.PI / 3, -Math.PI / 3, (2 * Math.PI) / 3, -(2 * Math.PI) / 3, Math.PI];
        for (const turn of turns) {
          const a = base + turn;
          const ox = thief.x;
          const oy = thief.y;
          thief.tryMove(this.grid, Math.cos(a) * 125 * dt, Math.sin(a) * 125 * dt, this.openDoors);
          if (Math.hypot(thief.x - ox, thief.y - oy) > 0.5) {
            thief.angle = a;
            thief.moving = true;
            break;
          }
        }
        return;
      }
      // Approach: go to the waypoint Rook is walking toward and wait there —
      // it walks straight onto you. The target follows Rook's route, so if
      // it turns first the thief simply walks to the next waypoint.
      const wp = g.route[g.waypoint];
      if (here[0] === wp[0] && here[1] === wp[1]) return; // hold the spot
      const path = findPath(this.grid, here[0], here[1], wp[0], wp[1], this.openDoors);
      if (path && path.length >= 2) {
        const next = path[1];
        const cx = (next[0] + 0.5) * TILE;
        const cy = (next[1] + 0.5) * TILE;
        const dx = cx - thief.x;
        const dy = cy - thief.y;
        const len = Math.hypot(dx, dy) || 1;
        thief.angle = Math.atan2(dy, dx);
        const move = Math.min(len, thief.speed * dt);
        thief.tryMove(this.grid, (dx / len) * move, (dy / len) * move, this.openDoors);
        thief.moving = true;
      }
      return;
    }

    // A guard is on your heels: drop smoke so it loses you, then keep moving.
    if (this.guards.some((g) => g.state === 'chase') && this.tools.smoke > 0
      && this.time - (st.lastSmoke || -99) > 6) {
      this.tools.useSmoke(this.time, thief.x, thief.y);
      st.lastSmoke = this.time;
    }

    // Normal run: gold first, then the van. If a locked door blocks the
    // way, go to its terminal and hack it first.
    if (!st.targets) {
      st.targets = [this.level.mainLoot[0], this.level.exit];
      st.targetIndex = 0;
      st.waited = 0;
    }
    let target = st.targets[st.targetIndex];
    const here = [Math.floor(thief.x / TILE), Math.floor(thief.y / TILE)];
    if (here[0] === target[0] && here[1] === target[1]) {
      st.targetIndex++;
      if (st.targetIndex >= st.targets.length) return; // the game ends it
      target = st.targets[st.targetIndex];
      st.waited = 0;
    }
    const openDoors = new Set(this.openDoors);
    let path = findPath(this.grid, here[0], here[1], target[0], target[1], openDoors);
    if (!path && this.level.doors.length && this.openDoors.size === 0) {
      // The door is shut: route to the terminal instead and hack it; the
      // main update loop does the hacking while E is held.
      const term = this.level.terminals[0];
      const near = [term[0], term[1] + 1];
      if (here[0] === near[0] && here[1] === near[1]) {
        this.input.hackHeld = true;
        return;
      }
      path = findPath(this.grid, here[0], here[1], near[0], near[1], openDoors);
    }
    if (!path || path.length < 2) return;
    const next = path[1];
    const hereDangerous = this.tileDangerous(here[0], here[1]);
    if (!hereDangerous && this.tileDangerous(next[0], next[1])) {
      // The next tile is watched: wait here (sneaking, so a cone edge that
      // clips you fills the meter slowly) until the cone sweeps past.
      this.input.sneak = true;
      st.waited += dt;
      if (st.waited < 25) return; // wait for the cone to sweep past
    } else {
      st.waited = 0;
    }
    const cx = (next[0] + 0.5) * TILE;
    const cy = (next[1] + 0.5) * TILE;
    const dx = cx - thief.x;
    const dy = cy - thief.y;
    const len = Math.hypot(dx, dy) || 1;
    thief.angle = Math.atan2(dy, dx);
    const move = Math.min(len, thief.speed * dt);
    thief.tryMove(this.grid, (dx / len) * move, (dy / len) * move, this.openDoors);
    thief.moving = true;
  }
}
