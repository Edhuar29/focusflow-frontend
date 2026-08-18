/**
 * FocusFlow Web - View: Pomodoro View Controller
 * Conectado al servicio global de segundo plano (sin reseteos al cambiar de pestaña ni en descansos).
 */

import { BaseView } from './base.view.js';
import { pomodoroTimerService } from '../services/pomodoro-timer.service.js';
import { eventBus } from '../core/event-bus.js';
import { soundService } from '../services/sound.service.js';
import { store } from '../core/store.js';
import { $, escapeHTML } from '../utils/dom.utils.js';

export class PomodoroView extends BaseView {
  constructor() {
    super('pomodoro-view');
    this.unsubscribeTick = null;
    this.unsubscribeMode = null;
  }

  render() {
    if (!this.container) return;

    const state = pomodoroTimerService.getState();
    const activeTask = state.activeTask;
    const formattedTime = this._formatSeconds(state.remainingSeconds);
    const circleProgress = ((state.totalDurationSeconds - state.remainingSeconds) / state.totalDurationSeconds) * 100;
    const strokeDashoffset = 754 - (754 * circleProgress) / 100;

    const modeLabels = {
      focus: 'Sesión de Concentración',
      shortBreak: 'Descanso Corto',
      longBreak: 'Descanso Largo'
    };

    this.container.innerHTML = `
      <div class="pomodoro-container">
        
        <!-- Active Task Synergy Banner (if launched from a task) -->
        ${activeTask ? `
          <div class="active-focus-task-banner">
            <div class="banner-left">
              <span class="badge badge-priority-${activeTask.priorities[0] || 'medium'}">Enfoque Activo</span>
              <span class="active-task-title">${escapeHTML(activeTask.title)}</span>
            </div>
            <button class="btn btn-ghost" id="btn-clear-active-task" style="font-size: var(--text-xs); color: var(--text-muted);">
              Desvincular Tarea ✕
            </button>
          </div>
        ` : ''}

        <!-- Mode Selector Chips -->
        <div class="pomodoro-modes">
          <button class="pomodoro-mode-btn ${state.currentMode === 'focus' ? 'active' : ''}" data-mode="focus">
            Enfoque (25m)
          </button>
          <button class="pomodoro-mode-btn ${state.currentMode === 'shortBreak' ? 'active' : ''}" data-mode="shortBreak">
            Descanso Corto (5m)
          </button>
          <button class="pomodoro-mode-btn ${state.currentMode === 'longBreak' ? 'active' : ''}" data-mode="longBreak">
            Descanso Largo (15m)
          </button>
        </div>

        <!-- Circular Clock Display -->
        <div class="pomodoro-clock-card">
          <div class="clock-svg-wrapper">
            <svg class="pomodoro-svg" viewBox="0 0 260 260">
              <!-- Background Track -->
              <circle cx="130" cy="130" r="120" stroke="rgba(255,255,255,0.06)" stroke-width="12" fill="none" />
              <!-- Animated Progress -->
              <circle 
                id="pomodoro-circle-fill"
                cx="130" 
                cy="130" 
                r="120" 
                stroke="var(--accent-primary)" 
                stroke-width="12" 
                fill="none" 
                stroke-dasharray="754" 
                stroke-dashoffset="${strokeDashoffset}" 
                stroke-linecap="round"
                transform="rotate(-90 130 130)"
                style="transition: stroke-dashoffset 0.8s ease;"
              />
            </svg>
            
            <div class="clock-content">
              <span class="clock-time" id="clock-time-display">${formattedTime}</span>
              <span class="clock-state-label" id="clock-mode-label">
                ${modeLabels[state.currentMode] || 'Enfoque'}
              </span>
            </div>
          </div>

          <!-- Timer Controls -->
          <div class="pomodoro-controls">
            <button class="btn btn-secondary btn-icon" id="btn-reset-timer" title="Reiniciar temporizador" aria-label="Reset Timer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
            </button>

            <button class="btn btn-primary btn-play-pause" id="btn-toggle-timer">
              ${state.isRunning ? `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                <span>Pausar</span>
              ` : `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Iniciar</span>
              `}
            </button>

            <button class="btn btn-secondary btn-icon" id="btn-skip-timer" title="Saltar sesión" aria-label="Skip Session">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
              </svg>
            </button>
          </div>
        </div>

      </div>
    `;
  }

  bindEvents() {
    if (!this.container) return;

    // 1. Play / Pause
    const toggleBtn = $('#btn-toggle-timer', this.container);
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        soundService.playClick();
        const state = pomodoroTimerService.getState();
        if (state.isRunning) {
          pomodoroTimerService.pause();
        } else {
          pomodoroTimerService.start();
        }
        this.render();
        this.bindEvents();
      });
    }

    // 2. Reset
    const resetBtn = $('#btn-reset-timer', this.container);
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        soundService.playClick();
        pomodoroTimerService.reset();
        this.render();
        this.bindEvents();
      });
    }

    // 3. Skip
    const skipBtn = $('#btn-skip-timer', this.container);
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        soundService.playClick();
        pomodoroTimerService.skip();
        this.render();
        this.bindEvents();
      });
    }

    // 4. Mode Buttons (Cambio de modo limpio en standby)
    const modeBtns = this.container.querySelectorAll('.pomodoro-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        soundService.playClick();
        const mode = btn.getAttribute('data-mode');
        pomodoroTimerService.setMode(mode);
        this.render();
        this.bindEvents();
      });
    });

    // 5. Clear Active Focus Task
    const clearTaskBtn = $('#btn-clear-active-task', this.container);
    if (clearTaskBtn) {
      clearTaskBtn.addEventListener('click', () => {
        soundService.playClick();
        store.clearActiveFocusTask();
        this.render();
        this.bindEvents();
      });
    }

    // 6. Suscripciones en tiempo real
    if (this.unsubscribeTick) this.unsubscribeTick();
    this.unsubscribeTick = eventBus.on('pomodoro:tick', (state) => {
      this._updateVisualClock(state);
    });

    if (this.unsubscribeMode) this.unsubscribeMode();
    this.unsubscribeMode = eventBus.on('pomodoro:modeChanged', () => {
      this.render();
      this.bindEvents();
    });
  }

  _updateVisualClock(state) {
    const timeDisplay = $('#clock-time-display', this.container);
    const circleFill = $('#pomodoro-circle-fill', this.container);

    if (timeDisplay) {
      timeDisplay.textContent = this._formatSeconds(state.remainingSeconds);
    }

    if (circleFill) {
      const circleProgress = ((state.totalDurationSeconds - state.remainingSeconds) / state.totalDurationSeconds) * 100;
      const strokeDashoffset = 754 - (754 * circleProgress) / 100;
      circleFill.style.strokeDashoffset = strokeDashoffset;
    }
  }

  _formatSeconds(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  unmount() {
    if (this.unsubscribeTick) this.unsubscribeTick();
    if (this.unsubscribeMode) this.unsubscribeMode();
    super.unmount();
  }
}
