function generateWavUri(freq1, freq2, duration = 0.45) {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Uint8Array(44 + numSamples);
  
  // Encabezado RIFF WAV
  buffer[0] = 82; buffer[1] = 73; buffer[2] = 70; buffer[3] = 70; // "RIFF"
  const fileSize = 36 + numSamples;
  buffer[4] = fileSize & 0xff; buffer[5] = (fileSize >> 8) & 0xff; buffer[6] = (fileSize >> 16) & 0xff; buffer[7] = (fileSize >> 24) & 0xff;
  buffer[8] = 87; buffer[9] = 65; buffer[10] = 86; buffer[11] = 69; // "WAVE"
  buffer[12] = 102; buffer[13] = 109; buffer[14] = 116; buffer[15] = 32; // "fmt "
  buffer[16] = 16; buffer[17] = 0; buffer[18] = 0; buffer[19] = 0;
  buffer[20] = 1; buffer[21] = 0; // PCM
  buffer[22] = 1; buffer[23] = 0; // Mono
  buffer[24] = sampleRate & 0xff; buffer[25] = (sampleRate >> 8) & 0xff; buffer[26] = 0; buffer[27] = 0;
  buffer[28] = sampleRate & 0xff; buffer[29] = (sampleRate >> 8) & 0xff; buffer[30] = 0; buffer[31] = 0;
  buffer[32] = 1; buffer[33] = 0;
  buffer[34] = 8; buffer[35] = 0; // 8 bit
  buffer[36] = 100; buffer[37] = 97; buffer[38] = 116; buffer[39] = 97; // "data"
  buffer[40] = numSamples & 0xff; buffer[41] = (numSamples >> 8) & 0xff; buffer[42] = (numSamples >> 16) & 0xff; buffer[43] = (numSamples >> 24) & 0xff;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const f = t < (duration * 0.4) ? freq1 : freq2;
    const envelope = Math.max(0, 1 - (t / duration));
    const sample = Math.sin(2 * Math.PI * f * t) * envelope;
    buffer[44 + i] = Math.floor((sample * 0.45 + 0.5) * 255);
  }

  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

const URGENT_ALARM_WAV = generateWavUri(950, 1400, 0.5);
const SOFT_CHIME_WAV = generateWavUri(660, 990, 0.4);

class SoundService {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._setupAutoUnlock();
  }

  init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn('AudioContext init warning:', e);
    }
  }

  _setupAutoUnlock() {
    const unlock = () => {
      this.init();
      if (this.ctx && this.ctx.state === 'running') {
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
        document.removeEventListener('touchstart', unlock);
      }
    };

    document.addEventListener('click', unlock, { passive: true });
    document.addEventListener('keydown', unlock, { passive: true });
    document.addEventListener('touchstart', unlock, { passive: true });
  }

  setMuted(isMuted) {
    this.muted = !!isMuted;
  }

  isMuted() {
    return this.muted;
  }

  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }

  playTaskComplete() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  /**
   * 🔴 PRIORIDAD ALTA: Alarma Urgente con Fallback Dual Inmediato
   */
  async playUrgentAlarm() {
    if (this.muted) return;

    // 1. Fallback inmediato con HTML5 Audio
    try {
      const a = new Audio(URGENT_ALARM_WAV);
      a.volume = 0.8;
      a.play().catch(() => {});
    } catch (e) {}

    // 2. Web Audio API
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) {}
    }
    if (!this.ctx) return;

    try {
      const startTime = this.ctx.currentTime + 0.01;
      [0, 0.18, 0.36].forEach(delay => {
        const now = startTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.16);
      });
    } catch (e) {}
  }

  /**
   * 🟡 PRIORIDAD MEDIA: Chime Suave con Fallback Dual Inmediato
   */
  async playSoftChime() {
    if (this.muted) return;

    // 1. Fallback inmediato con HTML5 Audio
    try {
      const a = new Audio(SOFT_CHIME_WAV);
      a.volume = 0.6;
      a.play().catch(() => {});
    } catch (e) {}

    // 2. Web Audio API
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) {}
    }
    if (!this.ctx) return;

    try {
      const startTime = this.ctx.currentTime + 0.01;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, startTime);
      osc.frequency.exponentialRampToValueAtTime(987.77, startTime + 0.18);

      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.55);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.55);
    } catch (e) {}
  }

  /**
   * Acorde de celebración al completar todas las tareas del día
   */
  playCelebration() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const now = this.ctx.currentTime + (i * 0.08);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.5);
      });
    } catch (e) {}
  }

  /**
   * 💧 Sonido armónico especial para recordatorio de hidratación
   */
  async playWaterChime() {
    if (this.muted) return;

    try {
      const a = new Audio(SOFT_CHIME_WAV);
      a.volume = 0.7;
      a.play().catch(() => {});
    } catch (e) {}

    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) {}
    }
    if (!this.ctx) return;

    try {
      const notes = [587.33, 880.00, 1174.66]; // D5, A5, D6 (Acorde brillante de gota de agua)
      notes.forEach((freq, i) => {
        const now = this.ctx.currentTime + (i * 0.12);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
      });
    } catch (e) {}
  }

  playNotification() {
    this.playUrgentAlarm();
  }
}

export const soundService = new SoundService();
