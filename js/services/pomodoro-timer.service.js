/**
 * FocusFlow Web - Services: Global Background Pomodoro Timer Service
 * Mantiene el tiempo y ciclo de concentración activo en segundo plano sin reiniciarse al cambiar de pestaña ni recargar la página.
 * Persistencia en tiempo real en LocalStorage para garantizar continuidad absoluta.
 */

import { eventBus } from '../core/event-bus.js';
import { store } from '../core/store.js';
import { soundService } from './sound.service.js';
import { notificationScheduler } from './notification-scheduler.service.js';

class PomodoroTimerService {
  constructor() {
    this.durations = {
      focus: 25 * 60,
      shortBreak: 5 * 60,
      longBreak: 15 * 60
    };

    this.currentMode = 'focus';
    this.remainingSeconds = this.durations.focus;
    this.totalDurationSeconds = this.durations.focus;
    this.isRunning = false;
    this.endTime = null;
    this.timerInterval = null;

    this._loadSession();
  }

  _loadSession() {
    try {
      const raw = localStorage.getItem('focusflow_pomodoro_session');
      if (raw) {
        const saved = JSON.parse(raw);
        this.currentMode = saved.currentMode || 'focus';
        this.totalDurationSeconds = saved.totalDurationSeconds || this.durations[this.currentMode] || (25 * 60);

        if (saved.isRunning && saved.endTime) {
          const now = Date.now();
          const diffMs = saved.endTime - now;
          if (diffMs > 0) {
            this.remainingSeconds = Math.ceil(diffMs / 1000);
            this.endTime = saved.endTime;
            this.start();
          } else {
            this.remainingSeconds = this.durations[this.currentMode];
            this.isRunning = false;
            this.endTime = null;
            this._persistSession();
          }
        } else {
          this.remainingSeconds = typeof saved.remainingSeconds === 'number' 
            ? saved.remainingSeconds 
            : this.durations[this.currentMode];
          this.isRunning = false;
          this.endTime = null;
        }
      }
    } catch (e) {
      console.warn('[PomodoroTimer] Error cargando sesión persistente:', e);
    }
  }

  _persistSession() {
    try {
      localStorage.setItem('focusflow_pomodoro_session', JSON.stringify({
        currentMode: this.currentMode,
        remainingSeconds: this.remainingSeconds,
        totalDurationSeconds: this.totalDurationSeconds,
        isRunning: this.isRunning,
        endTime: this.endTime
      }));
    } catch (e) {}
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
      currentMode: this.currentMode,
      remainingSeconds: seconds,
      totalDurationSeconds: this.totalDurationSeconds,
      isRunning: this.isRunning,
      activeTask: store.getActiveFocusTask()
    };
  }

  start() {
    if (this.isRunning && this.timerInterval) return;

    this.isRunning = true;
    if (!this.endTime) {
      this.endTime = Date.now() + (this.remainingSeconds * 1000);
    }

    this._persistSession();

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (!this.isRunning) return;

      const now = Date.now();
      const diffMs = this.endTime - now;
      const secondsLeft = Math.max(0, Math.ceil(diffMs / 1000));

      this.remainingSeconds = secondsLeft;
      this._persistSession();
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

    this._persistSession();
    eventBus.emit('pomodoro:paused', this.getState());
  }

  reset() {
    this.pause();
    this.remainingSeconds = this.durations[this.currentMode] || (25 * 60);
    this.totalDurationSeconds = this.durations[this.currentMode] || (25 * 60);
    this.endTime = null;
    this._persistSession();
    eventBus.emit('pomodoro:reset', this.getState());
  }

  /**
   * Cambia de modo limpiamente (Enfoque, Descanso Corto, Descanso Largo)
   */
  setMode(mode) {
    if (!this.durations[mode]) mode = 'focus';

    this.pause();
    this.currentMode = mode;
    this.totalDurationSeconds = this.durations[mode];
    this.remainingSeconds = this.durations[mode];
    this.endTime = null;

    this._persistSession();
    eventBus.emit('pomodoro:modeChanged', this.getState());
  }

  skip() {
    this._handleComplete();
  }

  _handleComplete() {
    this.pause();
    soundService.playCelebration();

    if (this.currentMode === 'focus') {
      const pomodoroState = store.getState().pomodoro;
      pomodoroState.cyclesCompletedToday = (pomodoroState.cyclesCompletedToday || 0) + 1;
      pomodoroState.totalFocusMinutes = (pomodoroState.totalFocusMinutes || 0) + Math.round(this.totalDurationSeconds / 60);
      store._persistAndNotify('pomodoro', pomodoroState, 'pomodoro:updated');

      notificationScheduler.addNotification({
        title: '¡Sesión de Enfoque Completada!',
        description: 'Has completado 25 minutos de concentración. Tómate un descanso corto de 5 minutos.',
        priority: 'high',
        type: 'pomodoro'
      });

      this.currentMode = 'shortBreak';
      this.totalDurationSeconds = this.durations.shortBreak;
      this.remainingSeconds = this.durations.shortBreak;
    } else {
      notificationScheduler.addNotification({
        title: 'Descanso Finalizado',
        description: 'Tu tiempo de descanso terminó. ¿Listo para una nueva sesión de enfoque?',
        priority: 'medium',
        type: 'pomodoro'
      });

      this.currentMode = 'focus';
      this.totalDurationSeconds = this.durations.focus;
      this.remainingSeconds = this.durations.focus;
    }

    this.endTime = null;
    this._persistSession();
    eventBus.emit('pomodoro:completed', this.getState());
    eventBus.emit('pomodoro:modeChanged', this.getState());
  }
}

export const pomodoroTimerService = new PomodoroTimerService();
