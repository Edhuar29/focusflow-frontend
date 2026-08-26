/**
 * FocusFlow Web - Views: Executive Dashboard Controller
 * Diseño corporativo limpio, ultra reactivo y sin fugas de memoria.
 */

import { BaseView } from './base.view.js';
import { store } from '../core/store.js';
import { eventBus } from '../core/event-bus.js';
import { soundService } from '../services/sound.service.js';
import { toast } from '../components/toast.component.js';
import { getGreetingForNow, formatCleanTime, getTodayISO } from '../utils/date.utils.js';
import { $, $$, escapeHTML } from '../utils/dom.utils.js';

export class DashboardView extends BaseView {
  constructor() {
    super('dashboard-view');
    this.unsubscribers = [];
  }

  mount() {
    super.mount();
    if (store.isAuthenticated()) {
      store.syncWaterLogsFromCloud().then(() => {
        if (this.isMounted && this.container) {
          this.render();
          this.bindEvents();
        }
      }).catch(() => {});
    }
  }

  render() {
    if (!this.container) return;

    const todayISO = getTodayISO();
    const tasks = store.getTasks().filter(t => {
      const d = (t.date || '').trim().split('T')[0];
      return d === todayISO || !d;
    });
    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;
    const taskPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const pomodoro = store.getState().pomodoro || {};
    const hydration = store.getState().hydration || { currentMl: 0, goalMl: 2000 };
    const goal = hydration.goalMl || 2000;
    const currentWater = hydration.currentMl || 0;
    const waterPercentage = Math.min(100, Math.round((currentWater / goal) * 100));

    const greeting = getGreetingForNow();
    const currentUser = store.getUser();
    const userName = currentUser && currentUser.name ? currentUser.name.split(' ')[0] : 'Danny';

    this.container.innerHTML = `
      <div class="dashboard-container">
        
        <!-- Welcome Hero Banner -->
        <div class="dashboard-hero">
          <div>
            <h2 class="dashboard-hero-title">${greeting}, ${escapeHTML(userName)}</h2>
            <p class="dashboard-hero-subtitle">
              Tienes <strong>${totalTasks - completedTasks} tareas pendientes</strong> para hoy.
            </p>
          </div>
          <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
            <a href="#/pomodoro" class="btn btn-primary" style="box-shadow: 0 4px 14px rgba(var(--accent-primary-rgb), 0.4);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px;">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Iniciar Enfoque</span>
            </a>
            <a href="#/tasks" class="btn btn-secondary" id="btn-dash-agenda">
              <span>Ver Agenda Completa</span>
            </a>
          </div>
        </div>

        <!-- 4 Key Metrics Cards with Clean SVGs -->
        <div class="dashboard-metrics-grid">
          
          <div class="dashboard-metric-card">
            <div class="metric-header">
              <span class="stat-label">Tareas de Hoy</span>
              <div class="metric-icon-badge" style="color: var(--accent-primary);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            <div class="metric-number" id="dash-tasks-stat">${completedTasks} / ${totalTasks}</div>
            <div class="metric-desc" id="dash-tasks-desc">${taskPercentage}% de cumplimiento diario</div>
          </div>

          <div class="dashboard-metric-card">
            <div class="metric-header">
              <span class="stat-label">Tiempo de Enfoque</span>
              <div class="metric-icon-badge" style="color: var(--color-warning);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
            </div>
            <div class="metric-number">${pomodoro.totalFocusMinutes || 100} min</div>
            <div class="metric-desc">${pomodoro.cyclesCompletedToday || 4} ciclos completados hoy</div>
          </div>

          <div class="dashboard-metric-card">
            <div class="metric-header">
              <span class="stat-label">Hidratación</span>
              <div class="metric-icon-badge" style="color: #38BDF8;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                </svg>
              </div>
            </div>
            <div class="metric-number" id="dash-water-stat">${hydration.currentMl} ml</div>
            <div class="metric-desc" id="dash-water-desc">${waterPercentage}% de la meta (${hydration.goalMl} ml)</div>
          </div>

          <div class="dashboard-metric-card">
            <div class="metric-header">
              <span class="stat-label">Racha Productiva</span>
              <div class="metric-icon-badge" style="color: #EC4899;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
                </svg>
              </div>
            </div>
            <div class="metric-number">5 Días</div>
            <div class="metric-desc">Objetivos diarios consecutivos</div>
          </div>

        </div>

        <!-- Content Grid: Today's Timeline & Quick Actions -->
        <div class="dashboard-content-grid">
          
          <!-- Today's Priority Timeline -->
          <div class="dashboard-section">
            <div class="dashboard-section-header">
              <h3 class="section-title">Prioridades de Hoy</h3>
              <a href="#/tasks" class="btn btn-ghost" style="font-size: var(--text-xs);">+ Ver Tareas</a>
            </div>

            <div class="dashboard-timeline" id="dash-timeline-container">
              ${this._renderTimelineHTML(tasks)}
            </div>
          </div>

          <!-- Quick Actions & Wellness Summary -->
          <div class="dashboard-section">
            <h3 class="section-title">Acciones Rápidas</h3>
            
            <div style="display: flex; flex-direction: column; gap: var(--space-3);">
              <button class="btn btn-secondary" id="btn-dash-water" style="justify-content: flex-start; padding: 0.875rem 1rem;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; color: #38BDF8;">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                </svg>
                <span>Tomar Agua (+250 ml)</span>
              </button>

              <a href="#/pomodoro" class="btn btn-secondary" style="justify-content: flex-start; padding: 0.875rem 1rem;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; color: var(--color-warning);">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Temporizador Pomodoro</span>
              </a>

              <a href="#/assistant" class="btn btn-secondary" style="justify-content: flex-start; padding: 0.875rem 1rem;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; color: var(--accent-primary);">
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a10 10 0 0 1-10-10c0-5.523 4.477-10 10-10z"></path>
                  <path d="M12 8v8"></path>
                  <path d="M8 12h8"></path>
                </svg>
                <span>Dictar Tarea con Asistente</span>
              </a>
            </div>

            <div style="margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--border-subtle);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Progreso de Hidratación</span>
                <span style="font-size: 11.5px; font-weight: 700; color: #38BDF8;">${waterPercentage}%</span>
              </div>
              <div style="height: 8px; background: var(--bg-input); border-radius: 999px; overflow: hidden; margin-bottom: 6px;">
                <div id="dash-water-fill" style="width: ${waterPercentage}%; height: 100%; background: linear-gradient(90deg, #0284C7, #38BDF8); border-radius: 999px; transition: width 0.4s ease;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: var(--text-secondary); padding-bottom: 2px;">
                <span id="dash-water-current" style="color: var(--text-primary);">${hydration.currentMl} ml</span>
                <span>Meta: ${hydration.goalMl} ml</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;
  }

  _renderTimelineHTML(tasks) {
    if (tasks.length === 0) {
      return `
        <div style="text-align: center; color: var(--text-secondary); padding: var(--space-8); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" style="color: var(--text-muted);">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <span style="font-size: var(--text-sm); font-weight: 500;">No tienes tareas pendientes para hoy</span>
          <a href="#/tasks" class="btn btn-secondary" style="font-size: 11px; padding: 4px 10px; margin-top: 2px;">
            Crear Primera Tarea
          </a>
        </div>
      `;
    }

    return tasks.map(t => `
      <div class="timeline-item ${t.completed ? 'completed' : ''}" data-task-id="${t.id}">
        <div class="timeline-left">
          <label class="custom-checkbox" aria-label="Completar ${escapeHTML(t.title)}">
            <input type="checkbox" ${t.completed ? 'checked' : ''} data-toggle-dash="${t.id}" />
            <span class="checkbox-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </label>
          <div>
            <div class="timeline-title">${escapeHTML(t.title)}</div>
            <small style="color: var(--text-muted);">${escapeHTML(t.category || 'General')}</small>
          </div>
        </div>
        <div class="timeline-right">
          <span class="badge badge-priority-${(t.priorities && t.priorities[0]) || t.priority || 'medium'}">${(t.priorities && t.priorities[0]) || t.priority || 'medium'}</span>
          <span class="timeline-time">${formatCleanTime(t.time)}</span>
          <button class="quick-action-btn btn-focus" data-focus-dash="${t.id}" title="Iniciar Pomodoro">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  bindEvents() {
    if (!this.container) return;

    // Delegación de eventos en timeline
    const timeline = $('#dash-timeline-container', this.container);
    if (timeline) {
      timeline.onchange = (e) => {
        const chk = e.target.closest('[data-toggle-dash]');
        if (chk) {
          const id = chk.getAttribute('data-toggle-dash');
          if (chk.checked) {
            soundService.playTaskComplete();
            toast.success('Tarea completada');
          } else {
            soundService.playClick();
          }
          store.toggleTaskCompletion(id);
        }
      };

      timeline.onclick = (e) => {
        const btn = e.target.closest('[data-focus-dash]');
        if (btn) {
          e.stopPropagation();
          const id = btn.getAttribute('data-focus-dash');
          soundService.playClick();
          store.startFocusOnTask(id);
        }
      };
    }

    // Navegar a la agenda posicionado en el día actual
    const agendaBtn = $('#btn-dash-agenda', this.container);
    if (agendaBtn) {
      agendaBtn.onclick = () => {
        soundService.playClick();
        store.setWeekOffset(0);
        store.setSelectedDate(getTodayISO());
      };
    }

    // Registrar agua rápido desde el Dashboard con sincronización en la nube
    const waterBtn = $('#btn-dash-water', this.container);
    if (waterBtn) {
      waterBtn.onclick = () => {
        soundService.playTaskComplete();
        const data = store.logWater(250);
        toast.success(`+250 ml registrados (Total: ${data.currentMl} ml)`);
      };
    }

    // Suscripciones reactivas
    this._cleanupSubscriptions();
    
    const unsubTasks = eventBus.on('tasks:updated', () => {
      this._updateDashboardUI();
    });
    this.unsubscribers.push(unsubTasks);

    const unsubHydration = eventBus.on('hydration:updated', () => {
      this._updateDashboardUI();
    });
    this.unsubscribers.push(unsubHydration);
  }

  _updateDashboardUI() {
    if (!this.container) return;

    const todayISO = getTodayISO();
    const tasks = store.getTasks().filter(t => {
      const d = (t.date || '').trim().split('T')[0];
      return d === todayISO || !d;
    });
    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;
    const taskPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const hydration = store.getState().hydration || { currentMl: 0, goalMl: 2000 };
    const goal = hydration.goalMl || 2000;
    const currentWater = hydration.currentMl || 0;
    const waterPercentage = Math.min(100, Math.round((currentWater / goal) * 100));

    // Actualizar timeline
    const timeline = $('#dash-timeline-container', this.container);
    if (timeline) timeline.innerHTML = this._renderTimelineHTML(tasks);

    // Actualizar números de métricas
    const taskStat = $('#dash-tasks-stat', this.container);
    if (taskStat) taskStat.textContent = `${completedTasks} / ${totalTasks}`;

    const taskDesc = $('#dash-tasks-desc', this.container);
    if (taskDesc) taskDesc.textContent = `${taskPercentage}% de cumplimiento diario`;

    const waterStat = $('#dash-water-stat', this.container);
    if (waterStat) waterStat.textContent = `${currentWater} ml`;

    const waterDesc = $('#dash-water-desc', this.container);
    if (waterDesc) waterDesc.textContent = `${waterPercentage}% de la meta (${goal} ml)`;

    const waterFill = $('#dash-water-fill', this.container);
    if (waterFill) waterFill.style.width = `${waterPercentage}%`;

    const waterCurr = $('#dash-water-current', this.container);
    if (waterCurr) waterCurr.textContent = `${currentWater} ml`;
  }

  _cleanupSubscriptions() {
    this.unsubscribers.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this.unsubscribers = [];
  }

  unmount() {
    this._cleanupSubscriptions();
    super.unmount();
  }
}
