/**
 * FocusFlow Web - View: Customizable Focus Timer View Controller
 * Vista de temporizador 100% personalizable por el usuario con chips de tiempo rápido,
 * ajuste fino en minutos y segundos, controles atómicos y actualizaciones a 60 FPS.
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
    this.unsubscribeStarted = null;
    this.unsubscribePaused = null;
    this.unsubscribeReset = null;
    this.unsubscribeDuration = null;
    this.unsubscribeCompleted = null;
  }

  render() {
    if (!this.container) return;

    const state = pomodoroTimerService.getState();
    const activeTask = state.activeTask;
    const formattedTime = this._formatSeconds(state.remainingSeconds);
    const total = state.totalDurationSeconds || 1;
    const circleProgress = ((total - state.remainingSeconds) / total) * 100;
    const strokeDashoffset = Math.max(0, 754 - (754 * circleProgress) / 100);

    const currentMinutes = Math.floor(state.totalDurationSeconds / 60);
    const currentSeconds = state.totalDurationSeconds % 60;

    const presets = [5, 10, 15, 25, 45, 60, 90];

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

        <!-- Presets Rápidos de Tiempo -->
        <div class="timer-preset-chips" id="timer-presets-wrapper">
          ${presets.map(min => `
            <button class="timer-preset-btn ${currentMinutes === min && currentSeconds === 0 ? 'active' : ''}" data-minutes="${min}">
              ${min} min
            </button>
          `).join('')}
        </div>

        <!-- Reloj Circular SVG Principal -->
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
                ${state.isRunning ? 'EN PROGRESO' : 'TEMPORIZADOR'}
              </span>
            </div>
          </div>

          <!-- Ajuste Personalizado de Minutos y Segundos -->
          <div class="custom-timer-adjuster" id="custom-timer-adjuster-box">
            <button type="button" class="btn-time-adjust" data-delta="-300" title="Restar 5 minutos" ${state.isRunning ? 'disabled' : ''}>-5m</button>
            <button type="button" class="btn-time-adjust" data-delta="-60" title="Restar 1 minuto" ${state.isRunning ? 'disabled' : ''}>-1m</button>
            
            <div class="custom-time-inputs">
              <input type="number" id="input-custom-minutes" min="1" max="240" value="${currentMinutes}" class="custom-time-input" title="Minutos" ${state.isRunning ? 'disabled' : ''} />
              <span class="custom-time-sep">:</span>
              <input type="number" id="input-custom-seconds" min="0" max="59" value="${currentSeconds.toString().padStart(2, '0')}" class="custom-time-input" title="Segundos" ${state.isRunning ? 'disabled' : ''} />
            </div>

            <button type="button" class="btn-time-adjust" data-delta="60" title="Sumar 1 minuto" ${state.isRunning ? 'disabled' : ''}>+1m</button>
            <button type="button" class="btn-time-adjust" data-delta="300" title="Sumar 5 minutos" ${state.isRunning ? 'disabled' : ''}>+5m</button>
          </div>

          <!-- Controles del Temporizador -->
          <div class="pomodoro-controls">
            <button class="btn btn-secondary btn-icon" id="btn-reset-timer" title="Reiniciar tiempo" aria-label="Reset Timer">
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

            <button class="btn btn-secondary btn-icon" id="btn-skip-timer" title="Finalizar sesión" aria-label="Skip Session">
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

    // 4. Presets rápidos de tiempo (5m, 10m, 15m, 25m, 45m, 60m, 90m)
    const presetsWrapper = $('#timer-presets-wrapper', this.container);
    if (presetsWrapper) {
      presetsWrapper.onclick = (e) => {
        const btn = e.target.closest('.timer-preset-btn');
        if (!btn) return;
        soundService.playClick();
        const minutes = parseInt(btn.getAttribute('data-minutes'), 10);
        if (!isNaN(minutes) && minutes > 0) {
          pomodoroTimerService.setDuration(minutes * 60);
        }
      };
    }

    // 5. Botones de ajuste fino (+1m, +5m, -1m, -5m)
    const adjusterBox = $('#custom-timer-adjuster-box', this.container);
    if (adjusterBox) {
      adjusterBox.onclick = (e) => {
        const btn = e.target.closest('.btn-time-adjust');
        if (!btn || btn.disabled) return;
        soundService.playClick();
        const delta = parseInt(btn.getAttribute('data-delta'), 10);
        if (!isNaN(delta)) {
          pomodoroTimerService.adjustTime(delta);
        }
      };
    }

    // 6. Inputs directos de minutos y segundos
    const minInput = $('#input-custom-minutes', this.container);
    const secInput = $('#input-custom-seconds', this.container);

    const applyInputsChange = () => {
      const m = Math.max(0, parseInt(minInput?.value, 10) || 0);
      const s = Math.max(0, Math.min(59, parseInt(secInput?.value, 10) || 0));
      const totalSecs = (m * 60) + s;
      if (totalSecs >= 10) {
        pomodoroTimerService.setDuration(totalSecs);
      }
    };

    if (minInput) minInput.onchange = applyInputsChange;
    if (secInput) secInput.onchange = applyInputsChange;

    // 7. Desvincular Tarea
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

    // 8. Suscripciones Reactivas
    this._cleanupSubscriptions();

    this.unsubscribeTick = eventBus.on('pomodoro:tick', (state) => {
      this._updateStateUI(state);
    });

    this.unsubscribeDuration = eventBus.on('pomodoro:durationChanged', (state) => {
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

    this.unsubscribeCompleted = eventBus.on('pomodoro:completed', (state) => {
      this._updateStateUI(state || pomodoroTimerService.getState());
    });
  }

  /**
   * Actualización in-place en tiempo real
   */
  _updateStateUI(state) {
    if (!this.container) return;

    // 1. Reloj de texto
    const timeDisplay = $('#clock-time-display', this.container);
    if (timeDisplay) {
      timeDisplay.textContent = this._formatSeconds(state.remainingSeconds);
    }

    // 2. Etiqueta de estado
    const modeLabel = $('#clock-mode-label', this.container);
    if (modeLabel) {
      modeLabel.textContent = state.isRunning ? 'EN PROGRESO' : 'TEMPORIZADOR';
    }

    // 3. Progreso circular SVG
    const circleFill = $('#pomodoro-circle-fill', this.container);
    if (circleFill) {
      const total = state.totalDurationSeconds || 1;
      const circleProgress = ((total - state.remainingSeconds) / total) * 100;
      const strokeDashoffset = Math.max(0, 754 - (754 * circleProgress) / 100);
      circleFill.style.strokeDashoffset = strokeDashoffset;
    }

    // 4. Inputs de tiempo (solo actualizados si no están corriendo para no estorbar la edición)
    const minInput = $('#input-custom-minutes', this.container);
    const secInput = $('#input-custom-seconds', this.container);
    const adjustBtns = this.container.querySelectorAll('.btn-time-adjust');

    if (!state.isRunning) {
      const currentMin = Math.floor(state.totalDurationSeconds / 60);
      const currentSec = state.totalDurationSeconds % 60;
      if (minInput && document.activeElement !== minInput) minInput.value = currentMin;
      if (secInput && document.activeElement !== secInput) secInput.value = currentSec.toString().padStart(2, '0');
    }

    // Deshabilitar o habilitar inputs durante la ejecución
    if (minInput) minInput.disabled = state.isRunning;
    if (secInput) secInput.disabled = state.isRunning;
    adjustBtns.forEach(b => b.disabled = state.isRunning);

    // 5. Presets activos
    const currentM = Math.floor(state.totalDurationSeconds / 60);
    const currentS = state.totalDurationSeconds % 60;
    const presetBtns = this.container.querySelectorAll('.timer-preset-btn');
    presetBtns.forEach(btn => {
      const m = parseInt(btn.getAttribute('data-minutes'), 10);
      if (m === currentM && currentS === 0) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 6. Botón Play / Pause
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
    if (this.unsubscribeDuration) { this.unsubscribeDuration(); this.unsubscribeDuration = null; }
    if (this.unsubscribeStarted) { this.unsubscribeStarted(); this.unsubscribeStarted = null; }
    if (this.unsubscribePaused) { this.unsubscribePaused(); this.unsubscribePaused = null; }
    if (this.unsubscribeReset) { this.unsubscribeReset(); this.unsubscribeReset = null; }
    if (this.unsubscribeCompleted) { this.unsubscribeCompleted(); this.unsubscribeCompleted = null; }
  }

  unmount() {
    this._cleanupSubscriptions();
    super.unmount();
  }
}
