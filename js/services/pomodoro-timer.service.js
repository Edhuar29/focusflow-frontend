/**
 * FocusFlow Web - Services: Global Background Pomodoro Timer Service
 * Mantiene el tiempo y ciclo de concentración activo en segundo plano sin reiniciarse al cambiar de pestaña.
 */

import { eventBus } from '../core/event-bus.js';
import { store } from '../core/store.js';
import { soundService } from './sound.service.js';
import { toast } from '../components/toast.component.js';
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
  }

  getState() {
    return {
      currentMode: this.currentMode,
      remainingSeconds: this.remainingSeconds,
      totalDurationSeconds: this.totalDurationSeconds,
      isRunning: this.isRunning,
      activeTask: store.getActiveFocusTask()
    };
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.endTime = Date.now() + (this.remainingSeconds * 1000);

    // Iniciar intervalo persistente en segundo plano
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
    if (!this.isRunning) return;

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
    this.remainingSeconds = this.durations[this.currentMode];
    this.totalDurationSeconds = this.durations[this.currentMode];
    eventBus.emit('pomodoro:reset', this.getState());
  }

  /**
   * Cambia de modo solo si el usuario lo solicita explícitamente
   */
  setMode(mode) {
    if (this.currentMode === mode) return;

    this.pause();
    this.currentMode = mode;
    this.totalDurationSeconds = this.durations[mode] || (25 * 60);
    this.remainingSeconds = this.totalDurationSeconds;
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
        description: 'Has completado 25 minutos de concentración. Tómate un descanso corto.',
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

    eventBus.emit('pomodoro:completed', this.getState());
  }
}

export const pomodoroTimerService = new PomodoroTimerService();
