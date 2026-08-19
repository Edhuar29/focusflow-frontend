/**
 * FocusFlow Web - Services: Global Background Pomodoro Timer Service
 * Sistema de temporizador determinista, robusto y limpio.
 * - Modo por defecto: Enfoque (25:00) en pausa (standby).
 * - NUNCA inicia solo: solo corre cuando el usuario presiona "Iniciar".
 * - Cambiar de modo (Enfoque, Descanso Corto, Descanso Largo) calibra el reloj y espera al usuario.
 * - Persistencia limpia en segundo plano mientras corre sin descalibraciones.
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

    this._initSession();
  }

  _initSession() {
    // Al abrir la app, siempre inicia en standby limpio y seguro
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
      currentMode: this.currentMode,
      remainingSeconds: seconds,
      totalDurationSeconds: this.totalDurationSeconds,
      isRunning: this.isRunning,
      activeTask: store.getActiveFocusTask()
    };
  }

  start() {
    if (this.isRunning) return;

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

  /**
   * Reinicia el modo actual a su duración inicial en estado de pausa (standby)
   */
  reset() {
    this.pause();
    this.remainingSeconds = this.durations[this.currentMode] || (25 * 60);
    this.totalDurationSeconds = this.durations[this.currentMode] || (25 * 60);
    this.endTime = null;
    eventBus.emit('pomodoro:reset', this.getState());
  }

  /**
   * Cambia de modo (Enfoque 25m, Descanso Corto 5m, Descanso Largo 15m)
   * Siempre queda en standby pausado esperando a que el usuario presione "Iniciar".
   */
  setMode(mode) {
    if (!this.durations[mode]) mode = 'focus';

    // Detener cualquier temporizador activo previo
    this.pause();

    this.currentMode = mode;
    this.totalDurationSeconds = this.durations[mode];
    this.remainingSeconds = this.durations[mode];
    this.endTime = null;

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

      // Pasar al modo descanso corto en standby
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

      // Volver a modo enfoque en standby
      this.currentMode = 'focus';
      this.totalDurationSeconds = this.durations.focus;
      this.remainingSeconds = this.durations.focus;
    }

    this.endTime = null;
    eventBus.emit('pomodoro:completed', this.getState());
    eventBus.emit('pomodoro:modeChanged', this.getState());
  }
}

export const pomodoroTimerService = new PomodoroTimerService();
