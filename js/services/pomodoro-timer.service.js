/**
 * FocusFlow Web - Services: Global Background Pomodoro Timer Service
 * Mantiene el progreso y estado individual de cada modo (Enfoque, Descanso Corto, Descanso Largo)
 * de manera independiente. Cambiar entre modos preserva el tiempo restante de cada uno sin reiniciarse.
 * Solo el botón explícito de Reiniciar (🔄) vuelve el modo a su tiempo inicial.
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

    this.modes = {
      focus: {
        remainingSeconds: 25 * 60,
        totalDurationSeconds: 25 * 60,
        isRunning: false,
        endTime: null
      },
      shortBreak: {
        remainingSeconds: 5 * 60,
        totalDurationSeconds: 5 * 60,
        isRunning: false,
        endTime: null
      },
      longBreak: {
        remainingSeconds: 15 * 60,
        totalDurationSeconds: 15 * 60,
        isRunning: false,
        endTime: null
      }
    };

    this.currentMode = 'focus';
    this.timerInterval = null;

    this._loadSession();
  }

  _loadSession() {
    try {
      const raw = localStorage.getItem('focusflow_pomodoro_session');
      if (raw) {
        const saved = JSON.parse(raw);
        
        if (saved.modes) {
          ['focus', 'shortBreak', 'longBreak'].forEach(m => {
            if (saved.modes[m]) {
              const defaultDuration = this.durations[m] || (25 * 60);
              this.modes[m] = {
                totalDurationSeconds: saved.modes[m].totalDurationSeconds || defaultDuration,
                remainingSeconds: typeof saved.modes[m].remainingSeconds === 'number' 
                  ? saved.modes[m].remainingSeconds 
                  : defaultDuration,
                isRunning: !!saved.modes[m].isRunning,
                endTime: saved.modes[m].endTime || null
              };
            }
          });
        }

        if (saved.currentMode && this.modes[saved.currentMode]) {
          this.currentMode = saved.currentMode;
        }

        // Si el modo actual estaba corriendo antes de recargar
        const active = this.modes[this.currentMode];
        if (active && active.isRunning && active.endTime) {
          const now = Date.now();
          const diffMs = active.endTime - now;
          if (diffMs > 0) {
            active.remainingSeconds = Math.ceil(diffMs / 1000);
            this.start();
          } else {
            active.remainingSeconds = active.totalDurationSeconds;
            active.isRunning = false;
            active.endTime = null;
            this._persistSession();
          }
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
        modes: this.modes
      }));
    } catch (e) {}
  }

  getState() {
    const active = this.modes[this.currentMode] || this.modes.focus;
    let seconds = active.remainingSeconds;

    if (active.isRunning && active.endTime) {
      const now = Date.now();
      const diffMs = active.endTime - now;
      seconds = Math.max(0, Math.ceil(diffMs / 1000));
      active.remainingSeconds = seconds;
    }

    return {
      currentMode: this.currentMode,
      remainingSeconds: seconds,
      totalDurationSeconds: active.totalDurationSeconds,
      isRunning: active.isRunning,
      activeTask: store.getActiveFocusTask()
    };
  }

  start() {
    const active = this.modes[this.currentMode];
    if (!active) return;

    if (active.isRunning && this.timerInterval) return;

    active.isRunning = true;
    if (!active.endTime) {
      active.endTime = Date.now() + (active.remainingSeconds * 1000);
    }

    this._persistSession();

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      const currentActive = this.modes[this.currentMode];
      if (!currentActive || !currentActive.isRunning) return;

      const now = Date.now();
      const diffMs = currentActive.endTime - now;
      const secondsLeft = Math.max(0, Math.ceil(diffMs / 1000));

      currentActive.remainingSeconds = secondsLeft;
      this._persistSession();
      eventBus.emit('pomodoro:tick', this.getState());

      if (secondsLeft <= 0) {
        this._handleComplete();
      }
    }, 1000);

    eventBus.emit('pomodoro:started', this.getState());
  }

  pause() {
    const active = this.modes[this.currentMode];
    if (!active) return;

    active.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (active.endTime) {
      const now = Date.now();
      active.remainingSeconds = Math.max(0, Math.ceil((active.endTime - now) / 1000));
      active.endTime = null;
    }

    this._persistSession();
    eventBus.emit('pomodoro:paused', this.getState());
  }

  /**
   * Reinicia EXCLUSIVAMENTE el modo actual a su duración inicial
   */
  reset() {
    this.pause();
    const active = this.modes[this.currentMode];
    if (active) {
      active.remainingSeconds = active.totalDurationSeconds;
      active.endTime = null;
      active.isRunning = false;
    }
    this._persistSession();
    eventBus.emit('pomodoro:reset', this.getState());
  }

  /**
   * Cambia de modo guardando el progreso previo del modo anterior
   */
  setMode(mode) {
    if (!this.modes[mode]) return;
    if (this.currentMode === mode) return;

    // Pausar el modo anterior preservando sus segundos restantes
    const prev = this.modes[this.currentMode];
    if (prev && prev.isRunning) {
      if (prev.endTime) {
        prev.remainingSeconds = Math.max(0, Math.ceil((prev.endTime - Date.now()) / 1000));
        prev.endTime = null;
      }
      prev.isRunning = false;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Cambiar al nuevo modo (mantiene sus propios segundos restantes)
    this.currentMode = mode;
    this._persistSession();
    eventBus.emit('pomodoro:modeChanged', this.getState());
  }

  skip() {
    this._handleComplete();
  }

  _handleComplete() {
    this.pause();
    soundService.playCelebration();

    const active = this.modes[this.currentMode];
    if (active) {
      active.remainingSeconds = active.totalDurationSeconds;
      active.endTime = null;
      active.isRunning = false;
    }

    if (this.currentMode === 'focus') {
      const pomodoroState = store.getState().pomodoro;
      pomodoroState.cyclesCompletedToday = (pomodoroState.cyclesCompletedToday || 0) + 1;
      pomodoroState.totalFocusMinutes = (pomodoroState.totalFocusMinutes || 0) + Math.round((active?.totalDurationSeconds || 1500) / 60);
      store._persistAndNotify('pomodoro', pomodoroState, 'pomodoro:updated');

      notificationScheduler.addNotification({
        title: '¡Sesión de Enfoque Completada!',
        description: 'Has completado 25 minutos de concentración. Tómate un descanso corto de 5 minutos.',
        priority: 'high',
        type: 'pomodoro'
      });

      this.currentMode = 'shortBreak';
    } else {
      notificationScheduler.addNotification({
        title: 'Descanso Finalizado',
        description: 'Tu tiempo de descanso terminó. ¿Listo para una nueva sesión de enfoque?',
        priority: 'medium',
        type: 'pomodoro'
      });

      this.currentMode = 'focus';
    }

    this._persistSession();
    eventBus.emit('pomodoro:completed', this.getState());
    eventBus.emit('pomodoro:modeChanged', this.getState());
  }
}

export const pomodoroTimerService = new PomodoroTimerService();
