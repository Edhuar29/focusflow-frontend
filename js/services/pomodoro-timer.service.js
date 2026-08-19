/**
 * FocusFlow Web - Services: Customizable Focus Timer Service
 * Temporizador totalmente personalizable por el usuario (en minutos y segundos).
 * Soporta ejecución en segundo plano, persistencia limpia, sonidos y notificaciones.
 */

import { eventBus } from '../core/event-bus.js';
import { store } from '../core/store.js';
import { soundService } from './sound.service.js';
import { notificationScheduler } from './notification-scheduler.service.js';

class PomodoroTimerService {
  constructor() {
    this.totalDurationSeconds = 25 * 60;
    this.remainingSeconds = 25 * 60;
    this.isRunning = false;
    this.endTime = null;
    this.timerInterval = null;

    this._init();
  }

  _init() {
    this.isRunning = false;
    this.endTime = null;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getState() {
    let seconds = this.remainingSeconds;

    if (this.isRunning && this.endTime) {
      const now = Date.now();
      const diffMs = this.endTime - now;
      seconds = Math.max(0, Math.ceil(diffMs / 1000));
      this.remainingSeconds = seconds;
    }

    return {
      remainingSeconds: seconds,
      totalDurationSeconds: this.totalDurationSeconds,
      isRunning: this.isRunning,
      activeTask: store.getActiveFocusTask()
    };
  }

  /**
   * Configura la duración personalizada del temporizador (en segundos)
   * @param {number} totalSeconds 
   */
  setDuration(totalSeconds) {
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) return;
    
    // Rango seguro: mínimo 10 segundos, máximo 4 horas (14400s)
    const clamped = Math.max(10, Math.min(14400, totalSeconds));
    
    this.pause();
    this.totalDurationSeconds = clamped;
    this.remainingSeconds = clamped;
    this.endTime = null;

    eventBus.emit('pomodoro:durationChanged', this.getState());
  }

  /**
   * Ajusta el tiempo sumando o restando segundos (ej: +60s, -300s)
   */
  adjustTime(deltaSeconds) {
    if (this.isRunning) return;

    const newDuration = Math.max(60, this.totalDurationSeconds + deltaSeconds);
    this.setDuration(newDuration);
  }

  start() {
    if (this.isRunning) return;
    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = this.totalDurationSeconds;
    }

    this.isRunning = true;
    this.endTime = Date.now() + (this.remainingSeconds * 1000);

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (!this.isRunning) return;

      const now = Date.now();
      const diffMs = this.endTime - now;
      const secondsLeft = Math.max(0, Math.ceil(diffMs / 1000));

      this.remainingSeconds = secondsLeft;
      eventBus.emit('pomodoro:tick', this.getState());

      if (secondsLeft <= 0) {
        this._handleComplete();
      }
    }, 1000);

    eventBus.emit('pomodoro:started', this.getState());
  }

  pause() {
    if (!this.isRunning && !this.timerInterval) return;

    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.endTime) {
      const now = Date.now();
      this.remainingSeconds = Math.max(0, Math.ceil((this.endTime - now) / 1000));
      this.endTime = null;
    }

    eventBus.emit('pomodoro:paused', this.getState());
  }

  reset() {
    this.pause();
    this.remainingSeconds = this.totalDurationSeconds;
    this.endTime = null;
    eventBus.emit('pomodoro:reset', this.getState());
  }

  skip() {
    this._handleComplete();
  }

  _handleComplete() {
    this.pause();
    soundService.playCelebration();

    const focusMinutes = Math.round(this.totalDurationSeconds / 60);
    const pomodoroState = store.getState().pomodoro || {};
    pomodoroState.cyclesCompletedToday = (pomodoroState.cyclesCompletedToday || 0) + 1;
    pomodoroState.totalFocusMinutes = (pomodoroState.totalFocusMinutes || 0) + focusMinutes;
    store._persistAndNotify('pomodoro', pomodoroState, 'pomodoro:updated');

    notificationScheduler.addNotification({
      title: '¡Tiempo Completado!',
      description: `Has finalizado tu sesión de enfoque de ${focusMinutes} minutos. ¡Gran trabajo!`,
      priority: 'high',
      type: 'pomodoro'
    });

    this.remainingSeconds = this.totalDurationSeconds;
    this.endTime = null;

    eventBus.emit('pomodoro:completed', this.getState());
  }
}

export const pomodoroTimerService = new PomodoroTimerService();
