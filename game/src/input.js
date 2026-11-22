// input.js — keyboard and mouse into one small state the game reads each
// frame. Left click walks to a spot; right click tosses a coin there.
export class Input {
  constructor(canvas) {
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    this.sneak = false;
    this.hackHeld = false;
    this.click = null; // {x, y} in canvas pixels, consumed by the game
    this.coinClick = null; // {x, y} in canvas pixels, consumed by the game
    this.pressed = new Set(); // keys pressed since the last frame, for 1/2/3/Q/R/M
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.pressed.add(e.key.toLowerCase());
      this.applyKey(e.key.toLowerCase(), true);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.applyKey(e.key.toLowerCase(), false);
    });
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      if (e.button === 0) this.click = { x, y };
      if (e.button === 2) this.coinClick = { x, y };
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => {
      this.left = this.right = this.up = this.down = this.sneak = this.hackHeld = false;
    });
  }

  applyKey(key, down) {
    if (key === 'a' || key === 'arrowleft') this.left = down;
    if (key === 'd' || key === 'arrowright') this.right = down;
    if (key === 'w' || key === 'arrowup') this.up = down;
    if (key === 's' || key === 'arrowdown') this.down = down;
    if (key === 'shift') this.sneak = down;
    if (key === 'e') this.hackHeld = down;
  }

  // Take a key pressed since the last frame (one-shot actions).
  take(key) {
    if (this.pressed.has(key)) {
      this.pressed.delete(key);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
    this.click = null;
    this.coinClick = null;
  }
}
