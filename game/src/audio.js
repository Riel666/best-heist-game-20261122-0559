// audio.js — synthesized WebAudio sound, no audio files: footsteps, the
// clink of a coin, the pickup chime, the alarm pulse, the caught sting and
// the win arpeggio. Nothing plays until the first user gesture.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.alarmTimer = null;
  }

  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone(freq, dur, type = 'sine', gain = 0.08, when = 0) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  step(sneaking) {
    this.tone(sneaking ? 140 : 95, 0.05, 'triangle', sneaking ? 0.015 : 0.03);
  }

  pickup() {
    this.tone(880, 0.09, 'sine', 0.07);
    this.tone(1318, 0.12, 'sine', 0.06, 0.07);
  }

  coin() {
    this.tone(2093, 0.07, 'square', 0.04);
    this.tone(1568, 0.1, 'square', 0.035, 0.06);
  }

  emp() {
    this.tone(220, 0.25, 'sawtooth', 0.05);
    this.tone(110, 0.3, 'sawtooth', 0.05, 0.1);
  }

  hackDone() {
    this.tone(523, 0.1, 'sine', 0.07);
    this.tone(784, 0.14, 'sine', 0.07, 0.09);
  }

  spotted() {
    this.tone(196, 0.16, 'square', 0.06);
    this.tone(147, 0.2, 'square', 0.06, 0.12);
  }

  caught() {
    this.tone(110, 0.4, 'sawtooth', 0.09);
    this.tone(82, 0.5, 'sawtooth', 0.09, 0.15);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.07, i * 0.11));
  }

  startAlarm() {
    if (this.alarmTimer || this.muted) return;
    this.alarmTimer = setInterval(() => {
      if (!this.muted) this.tone(620, 0.14, 'square', 0.045);
    }, 450);
  }

  stopAlarm() {
    if (this.alarmTimer) {
      clearInterval(this.alarmTimer);
      this.alarmTimer = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopAlarm();
    return this.muted;
  }
}
