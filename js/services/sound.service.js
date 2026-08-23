/**
 * FocusFlow Web - Services: Ultra Lightweight, Non-Blocking Sound Synthesizer
 * Síntesis de audio pura y segura que nunca bloquea el hilo principal del navegador.
 */

import { StorageService } from './storage.service.js';

class SoundService {
  constructor() {
    this.ctx = null;
    this.muted = StorageService.get('dnd_enabled', false);
    this._setupAutoUnlock();
  }

  _getCtx() {
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch (e) {
        console.warn('[SoundService] AudioContext no soportado:', e);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _setupAutoUnlock() {
    const unlock = () => {
      const ctx = this._getCtx();
      if (ctx && ctx.state === 'running') {
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
        document.removeEventListener('touchstart', unlock);
      }
    };

    document.addEventListener('click', unlock, { passive: true, once: true });
    document.addEventListener('keydown', unlock, { passive: true, once: true });
    document.addEventListener('touchstart', unlock, { passive: true, once: true });
  }

  setMuted(isMuted) {
    this.muted = !!isMuted;
  }

  isMuted() {
    return this.muted;
  }

  /**
   * Clic de navegación ligero
   */
  playClick() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  /**
   * Tarea completada
   */
  playTaskComplete() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  /**
   * 🔴 PRIORIDAD ALTA: Alarma Urgente
   */
  playUrgentAlarm() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    try {
      const startTime = ctx.currentTime + 0.01;
      [0, 0.15, 0.30].forEach(delay => {
        const now = startTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.06);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
      });
    } catch (e) {}
  }

  /**
   * 🟡 PRIORIDAD MEDIA: Chime Suave
   */
  playSoftChime() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    try {
      const startTime = ctx.currentTime + 0.01;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, startTime);
      osc.frequency.exponentialRampToValueAtTime(987.77, startTime + 0.15);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    } catch (e) {}
  }

  /**
   * 🎉 Acorde de celebración
   */
  playCelebration() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      const now = ctx.currentTime + 0.01;

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        gain.gain.setValueAtTime(0.18, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.5);
      });
    } catch (e) {}
  }

  /**
   * 💧 Gota / Burbuja de Agua
   */
  playWaterDrop() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + 0.01;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {}
  }

  /**
   * 💧 Sonido armónico especial para hidratación (D5, A5, D6)
   */
  playWaterChime() {
    if (this.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;

    try {
      const notes = [587.33, 880.00, 1174.66];
      notes.forEach((freq, i) => {
        const now = ctx.currentTime + (i * 0.1);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      });
    } catch (e) {}
  }

  playNotification() {
    this.playSoftChime();
  }
}

export const soundService = new SoundService();
