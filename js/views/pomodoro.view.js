/**
 * FocusFlow Web - View: Pomodoro View Controller
 * Actualizaciones reactivas en el lugar (In-Place DOM Updates) para alternar
 * entre Enfoque (25m), Descanso Corto (5m) y Descanso Largo (15m) con 60 FPS y 0 bloqueos.
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
    this.unsubscribeStarted = null;
    this.unsubscribePaused = null;
    this.unsubscribeReset = null;
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
        
        <!-- Banner de Tarea Activa (si fue iniciada desde una tarea) -->
        <div id="active-task-banner-container">
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
        </div>

        <!-- Selector de Modos (Chips) -->
        <div class="pomodoro-modes" id="pomodoro-modes-wrapper">
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

        <!-- Reloj Circular SVG -->
        <div class="pomodoro-clock-card">
          <div class="clock-svg-wrapper">
            <svg class="pomodoro-svg" viewBox="0 0 260 260">
              <!-- Pista de fondo -->
              <circle cx="130" cy="130" r="120" stroke="rgba(255,255,255,0.06)" stroke-width="12" fill="none" />
              <!-- Barra de Progreso Circular -->
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
                style="transition: stroke-dashoffset 0.5s ease;"
              />
            </svg>
            
            <div class="clock-content">
              <span class="clock-time" id="clock-time-display">${formattedTime}</span>
              <span class="clock-state-label" id="clock-mode-label">
                ${modeLabels[state.currentMode] || 'Sesión de Concentración'}
              </span>
            </div>
          </div>

          <!-- Controles del Temporizador -->
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
      toggleBtn.onclick = () => {
        soundService.playClick();
        const state = pomodoroTimerService.getState();
        if (state.isRunning) {
          pomodoroTimerService.pause();
        } else {
          pomodoroTimerService.start();
        }
      };
    }

    // 2. Reset
    const resetBtn = $('#btn-reset-timer', this.container);
    if (resetBtn) {
      resetBtn.onclick = () => {
        soundService.playClick();
        pomodoroTimerService.reset();
      };
    }

    // 3. Skip
    const skipBtn = $('#btn-skip-timer', this.container);
    if (skipBtn) {
      skipBtn.onclick = () => {
        soundService.playClick();
        pomodoroTimerService.skip();
      };
    }

    // 4. Selector de Modos (Delegación de eventos limpia y sin clonación de listeners)
    const modesWrapper = $('#pomodoro-modes-wrapper', this.container);
    if (modesWrapper) {
      modesWrapper.onclick = (e) => {
        const btn = e.target.closest('.pomodoro-mode-btn');
        if (!btn) return;
        soundService.playClick();
        const mode = btn.getAttribute('data-mode');
        if (mode) {
          pomodoroTimerService.setMode(mode);
        }
      };
    }

    // 5. Desvincular Tarea
    const bannerContainer = $('#active-task-banner-container', this.container);
    if (bannerContainer) {
      bannerContainer.onclick = (e) => {
        const clearBtn = e.target.closest('#btn-clear-active-task');
        if (clearBtn) {
          soundService.playClick();
          store.clearActiveFocusTask();
          bannerContainer.innerHTML = '';
        }
      };
    }

    // 6. Suscripciones Reactivas al Bus de Eventos (Una sola suscripción por ciclo de vida)
    this._cleanupSubscriptions();

    this.unsubscribeTick = eventBus.on('pomodoro:tick', (state) => {
      this._updateStateUI(state);
    });

    this.unsubscribeMode = eventBus.on('pomodoro:modeChanged', (state) => {
      this._updateStateUI(state || pomodoroTimerService.getState());
    });

    this.unsubscribeStarted = eventBus.on('pomodoro:started', (state) => {
      this._updateStateUI(state || pomodoroTimerService.getState());
    });

    this.unsubscribePaused = eventBus.on('pomodoro:paused', (state) => {
      this._updateStateUI(state || pomodoroTimerService.getState());
    });

    this.unsubscribeReset = eventBus.on('pomodoro:reset', (state) => {
      this._updateStateUI(state || pomodoroTimerService.getState());
    });
  }

  /**
   * Actualización in-place ultra rápida de la interfaz sin re-renderizar el DOM
   */
  _updateStateUI(state) {
    if (!this.container) return;

    const modeLabels = {
      focus: 'Sesión de Concentración',
      shortBreak: 'Descanso Corto',
      longBreak: 'Descanso Largo'
    };

    // 1. Reloj de texto
    const timeDisplay = $('#clock-time-display', this.container);
    if (timeDisplay) {
      timeDisplay.textContent = this._formatSeconds(state.remainingSeconds);
    }

    // 2. Etiqueta de modo
    const modeLabel = $('#clock-mode-label', this.container);
    if (modeLabel) {
      modeLabel.textContent = modeLabels[state.currentMode] || 'Sesión de Concentración';
    }

    // 3. Progreso circular SVG
    const circleFill = $('#pomodoro-circle-fill', this.container);
    if (circleFill) {
      const total = state.totalDurationSeconds || 1;
      const circleProgress = ((total - state.remainingSeconds) / total) * 100;
      const strokeDashoffset = Math.max(0, 754 - (754 * circleProgress) / 100);
      circleFill.style.strokeDashoffset = strokeDashoffset;
      
      // Color distintivo: Azul para concentración, Esmeralda para descansos
      if (state.currentMode === 'focus') {
        circleFill.style.stroke = 'var(--accent-primary)';
      } else {
        circleFill.style.stroke = '#10B981';
      }
    }

    // 4. Botones de Modo (Active Chip)
    const modeBtns = this.container.querySelectorAll('.pomodoro-mode-btn');
    modeBtns.forEach(btn => {
      if (btn.getAttribute('data-mode') === state.currentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 5. Botón Play / Pause
    const toggleBtn = $('#btn-toggle-timer', this.container);
    if (toggleBtn) {
      if (state.isRunning) {
        toggleBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
          <span>Pausar</span>
        `;
      } else {
        toggleBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Iniciar</span>
        `;
      }
    }
  }

  _formatSeconds(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  _cleanupSubscriptions() {
    if (this.unsubscribeTick) { this.unsubscribeTick(); this.unsubscribeTick = null; }
    if (this.unsubscribeMode) { this.unsubscribeMode(); this.unsubscribeMode = null; }
    if (this.unsubscribeStarted) { this.unsubscribeStarted(); this.unsubscribeStarted = null; }
    if (this.unsubscribePaused) { this.unsubscribePaused(); this.unsubscribePaused = null; }
    if (this.unsubscribeReset) { this.unsubscribeReset(); this.unsubscribeReset = null; }
  }

  unmount() {
    this._cleanupSubscriptions();
    super.unmount();
  }
}
