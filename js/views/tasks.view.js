/**
 * FocusFlow Web - Views: Tasks & Schedule View
 * Incluye Orden Inteligente, Calendario Visual Interactivo (Mes/Día), Selector de Prioridades Unificado y Reloj de Celular.
 */

import { BaseView } from './base.view.js';
import { store } from '../core/store.js';
import { eventBus } from '../core/event-bus.js';
import { soundService } from '../services/sound.service.js';
import { toast } from '../components/toast.component.js';
import { getWeekDays, getWeekRangeTitle, formatCleanTime, getTodayISO } from '../utils/date.utils.js';
import { $, $$, escapeHTML } from '../utils/dom.utils.js';
import { ModalComponent } from '../components/modal.component.js';

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES_FULL_ES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

export class TasksView extends BaseView {
  constructor() {
    super('tasks-view');
    this.createModal = null;
    this.editModal = null;
    this.editingTaskId = null;
    this.unsubscribers = [];
    this.calendarStates = {}; // Estado de año/mes por widget
  }

  render() {
    if (!this.container) return;

    const weekOffset = store.getState().weekOffset;
    const days = getWeekDays(weekOffset);
    const weekTitle = getWeekRangeTitle(weekOffset);
    const currentFilter = store.getState().activeFilter;
    const selectedDate = store.getState().selectedDate;
    const counts = store.getFilterCounts();
    const viewMode = store.getState().viewMode;
    const filteredTasks = store.getFilteredTasks();

    this.container.innerHTML = `
      <div class="tasks-container">
        
        <!-- 1. Weekly Horizontal Navigator -->
        <div>
          <div class="weekly-nav-header">
            <span class="weekly-nav-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span id="weekly-nav-title-text">${weekTitle}</span>
            </span>

            <div class="weekly-nav-controls">
              <button class="btn btn-secondary btn-icon" id="btn-prev-week" title="Semana Anterior" aria-label="Previous Week">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <button class="btn btn-secondary" id="btn-today-week" style="padding: 0.35rem 0.75rem; font-size: var(--text-xs);">
                Hoy
              </button>
              <button class="btn btn-secondary btn-icon" id="btn-next-week" title="Semana Siguiente" aria-label="Next Week">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          </div>

          <div class="weekly-nav" id="weekly-nav">
            ${this._renderWeekDaysHTML(days, selectedDate)}
          </div>
        </div>

        <!-- 2. Toolbar: Search, Filter Chips & View Switcher -->
        <div class="tasks-toolbar">
          <div class="search-input-wrapper">
            <span class="search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input 
              type="text" 
              class="search-input" 
              id="tasks-search-input" 
              placeholder="Buscar tareas, categorías..." 
              value="${escapeHTML(store.getState().searchQuery)}"
              autocomplete="off"
            />
          </div>

          <div class="tasks-toolbar-right">
            <div class="filter-chips-group">
              <span class="filter-chip-label">Prioridad:</span>
              <button class="filter-chip ${currentFilter === 'high' ? 'active' : ''}" data-filter="high">
                Alta <span class="filter-chip-count" id="count-high">${counts.high}</span>
              </button>
              <button class="filter-chip ${currentFilter === 'medium' ? 'active' : ''}" data-filter="medium">
                Media <span class="filter-chip-count" id="count-medium">${counts.medium}</span>
              </button>
              <button class="filter-chip ${currentFilter === 'low' ? 'active' : ''}" data-filter="low">
                Baja <span class="filter-chip-count" id="count-low">${counts.low}</span>
              </button>
              <button class="filter-chip ${currentFilter === 'due-today' ? 'active' : ''}" data-filter="due-today">
                Hoy <span class="filter-chip-count" id="count-today">${counts.dueToday}</span>
              </button>
            </div>

            <!-- View Switcher -->
            <div class="view-mode-toggle">
              <button class="view-mode-btn ${viewMode === 'grid' ? 'active' : ''}" data-view-mode="grid" title="Vista Cuadrícula" aria-label="Grid View">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </button>
              <button class="view-mode-btn ${viewMode === 'list' ? 'active' : ''}" data-view-mode="list" title="Vista Lista" aria-label="List View">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Section Header with Subtle & Eye-Catching Add Button -->
        <div class="tasks-section-header">
          <div class="section-title-wrapper">
            <h2 class="section-title">Tareas y Horarios</h2>
            <span class="section-count-badge" id="tasks-header-count">${filteredTasks.length} tareas</span>
          </div>

          <button class="btn-add-task-subtle" id="btn-add-task-header" title="Crear nueva tarea">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Nueva Tarea</span>
          </button>
        </div>

        <!-- 4. Tasks Grid / List (Smart Ordered) -->
        <div class="tasks-grid ${viewMode === 'list' ? 'list-view' : ''}" id="tasks-grid">
          ${this._renderTaskCardsHTML()}
        </div>

      </div>
    `;

    this.createModal = new ModalComponent('create-task-modal');
    this.editModal = new ModalComponent('edit-task-modal');

    // Inicializar relojes digitales de smartphone
    this._initMobileClockEvents('create-mobile-clock');
    this._initMobileClockEvents('edit-mobile-clock');

    // Inicializar selectores de prioridad unificados
    this._initPrioritySelector('create-priority-selector', 'task-priority-select');
    this._initPrioritySelector('edit-priority-selector', 'edit-task-priority-select');

    // Inicializar widgets de calendario interactivo
    this._initVisualCalendar('create-calendar-widget', 'create-task-date-val', selectedDate || getTodayISO());
    this._initVisualCalendar('edit-calendar-widget', 'edit-task-date-val', selectedDate || getTodayISO());

    this._updateDailyProgressUI();
  }

  _renderWeekDaysHTML(days, selectedDate) {
    return days.map(d => {
      const stats = store.getTaskStatsForDate(d.fullDate);
      const isActive = d.fullDate === selectedDate;
      return `
        <div class="day-card ${isActive ? 'active' : ''}" data-date="${d.fullDate}">
          <span class="day-name">${d.dayName}</span>
          <span class="day-date">${d.dateLabel}</span>
          <div class="day-dots">
            ${Array.from({ length: Math.min(4, stats.completed) }).map(() => `<span class="day-dot completed"></span>`).join('')}
            ${Array.from({ length: Math.min(4, stats.pending) }).map(() => `<span class="day-dot pending"></span>`).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  _renderTaskCardsHTML() {
    const tasks = store.getFilteredTasks();

    if (tasks.length === 0) {
      return `
        <div style="grid-column: 1 / -1; padding: var(--space-8); text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          <p style="margin-bottom: var(--space-2); font-size: var(--text-sm);">No hay tareas para este filtro o fecha.</p>
          <button class="btn btn-secondary" id="btn-empty-add-task" style="font-size: var(--text-xs);">
            + Crear una tarea
          </button>
        </div>
      `;
    }

    return tasks.map(task => {
      const isChecked = task.completed ? 'checked' : '';
      const completedClass = task.completed ? 'completed' : '';

      const priorityBadgesHTML = task.priorities.map(p => {
        return `<span class="badge badge-priority-${p}">${p}</span>`;
      }).join(' ');

      const categoryBadgeHTML = task.category ? `
        <span class="badge badge-category">${escapeHTML(task.category)}</span>
      ` : '';

      const cleanTime = formatCleanTime(task.time);

      return `
        <div class="task-card ${completedClass}" data-task-id="${task.id}">
          <div class="task-quick-actions">
            <button class="quick-action-btn btn-focus" data-action="focus" data-task-id="${task.id}" title="Iniciar Sesión Pomodoro">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
            <button class="quick-action-btn" data-action="postpone" data-task-id="${task.id}" title="Posponer para mañana (+1d)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </button>
            <button class="quick-action-btn" data-action="edit" data-task-id="${task.id}" title="Editar tarea">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <button class="quick-action-btn btn-delete" data-action="delete" data-task-id="${task.id}" title="Eliminar tarea">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>

          <div class="task-card-header">
            <label class="custom-checkbox" aria-label="Marcar ${escapeHTML(task.title)}">
              <input type="checkbox" ${isChecked} data-toggle-id="${task.id}" />
              <span class="checkbox-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
            </label>
            <span class="task-card-title">${escapeHTML(task.title)}</span>
          </div>

          <div class="task-card-footer">
            <div class="task-card-badges">
              ${priorityBadgesHTML}
              ${categoryBadgeHTML}
            </div>
            <span class="task-card-time">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              ${escapeHTML(cleanTime)}
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  bindEvents() {
    if (!this.container) return;

    // 1. Navegación Semanal
    const prevWeekBtn = $('#btn-prev-week', this.container);
    const nextWeekBtn = $('#btn-next-week', this.container);
    const todayWeekBtn = $('#btn-today-week', this.container);

    if (prevWeekBtn) {
      prevWeekBtn.onclick = () => {
        soundService.playClick();
        store.setWeekOffset(store.getState().weekOffset - 1);
        this._updateWeeklyNav();
        this._updateGrid();
      };
    }

    if (nextWeekBtn) {
      nextWeekBtn.onclick = () => {
        soundService.playClick();
        store.setWeekOffset(store.getState().weekOffset + 1);
        this._updateWeeklyNav();
        this._updateGrid();
      };
    }

    if (todayWeekBtn) {
      todayWeekBtn.onclick = () => {
        soundService.playClick();
        store.setWeekOffset(0);
        store.setSelectedDate(getTodayISO());
        this._updateWeeklyNav();
        this._updateGrid();
      };
    }

    const weeklyNav = $('#weekly-nav', this.container);
    if (weeklyNav) {
      weeklyNav.onclick = (e) => {
        const card = e.target.closest('.day-card');
        if (!card) return;
        soundService.playClick();
        const date = card.getAttribute('data-date');
        $$('.day-card', weeklyNav).forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        store.setSelectedDate(date);
        this._updateGrid();
      };
    }

    // 2. Alternador de vista (Grid / List)
    const viewButtons = $$('.view-mode-btn', this.container);
    viewButtons.forEach(btn => {
      btn.onclick = () => {
        soundService.playClick();
        const mode = btn.getAttribute('data-view-mode');
        store.setViewMode(mode);
        viewButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const grid = $('#tasks-grid', this.container);
        if (grid) {
          if (mode === 'list') grid.classList.add('list-view');
          else grid.classList.remove('list-view');
        }
      };
    });

    // 3. Buscador
    const searchInput = $('#tasks-search-input', this.container);
    if (searchInput) {
      searchInput.oninput = (e) => {
        store.setSearchQuery(e.target.value);
        this._updateGrid();
      };
    }

    // 4. Chips de filtro
    const filterChips = $$('.filter-chip', this.container);
    filterChips.forEach(chip => {
      chip.onclick = () => {
        soundService.playClick();
        const filter = chip.getAttribute('data-filter');
        filterChips.forEach(c => c.classList.remove('active'));
        
        if (store.getState().activeFilter === filter) {
          store.setFilter('all');
        } else {
          chip.classList.add('active');
          store.setFilter(filter);
        }
        this._updateGrid();
      };
    });

    // 5. Delegación de eventos en rejilla de tareas
    const grid = $('#tasks-grid', this.container);
    if (grid) {
      grid.onchange = (e) => {
        const toggleInput = e.target.closest('[data-toggle-id]');
        if (toggleInput) {
          const taskId = toggleInput.getAttribute('data-toggle-id');
          if (toggleInput.checked) {
            soundService.playTaskComplete();
            store.toggleTaskCompletion(taskId);
            this._checkDayCelebration();
          } else {
            soundService.playClick();
            store.toggleTaskCompletion(taskId);
          }
        }
      };

      grid.onclick = (e) => {
        const emptyAddBtn = e.target.closest('#btn-empty-add-task');
        if (emptyAddBtn) {
          this._openCreateModal();
          return;
        }

        const focusBtn = e.target.closest('[data-action="focus"]');
        if (focusBtn) {
          e.stopPropagation();
          const taskId = focusBtn.getAttribute('data-task-id');
          soundService.playClick();
          store.startFocusOnTask(taskId);
          return;
        }

        const postponeBtn = e.target.closest('[data-action="postpone"]');
        if (postponeBtn) {
          e.stopPropagation();
          const taskId = postponeBtn.getAttribute('data-task-id');
          soundService.playClick();
          store.postponeTask(taskId);
          toast.info('Tarea pospuesta para mañana (+1 día)');
          return;
        }

        const editBtn = e.target.closest('[data-action="edit"]');
        if (editBtn) {
          e.stopPropagation();
          const taskId = editBtn.getAttribute('data-task-id');
          this._openEditModal(taskId);
          return;
        }

        const deleteBtn = e.target.closest('[data-action="delete"]');
        if (deleteBtn) {
          e.stopPropagation();
          const taskId = deleteBtn.getAttribute('data-task-id');
          soundService.playClick();
          store.deleteTask(taskId);
          toast.warning('Tarea eliminada');
          return;
        }
      };
    }

    // 6. Botón sutil en cabecera
    const headerAddBtn = $('#btn-add-task-header', this.container);
    if (headerAddBtn) {
      headerAddBtn.onclick = () => {
        soundService.playClick();
        this._openCreateModal();
      };
    }

    // 7. Enlazar formularios de modales
    const createForm = $('#create-task-form');
    if (createForm) {
      createForm.onsubmit = (e) => {
        e.preventDefault();
        this._handleCreateTask(createForm);
      };
    }

    const editForm = $('#edit-task-form');
    if (editForm) {
      editForm.onsubmit = (e) => {
        e.preventDefault();
        this._handleEditTask(editForm);
      };
    }

    // Suscripciones reactivas únicas
    this._cleanupSubscriptions();
    const unsub1 = eventBus.on('tasks:updated', () => {
      this._updateGrid();
      this._updateDailyProgressUI();
      this._updateWeeklyNav();
    });
    this.unsubscribers.push(unsub1);
  }

  /**
   * Inicializa el widget de calendario visual interactivo (Mes, Día y Año)
   */
  _initVisualCalendar(widgetId, inputId, initialDateStr) {
    const widget = $(`#${widgetId}`);
    if (!widget) return;

    let currentDate = initialDateStr ? new Date(initialDateStr + 'T00:00:00') : new Date();
    if (isNaN(currentDate.getTime())) currentDate = new Date();

    this.calendarStates[widgetId] = {
      viewYear: currentDate.getFullYear(),
      viewMonth: currentDate.getMonth(),
      selectedDate: initialDateStr || getTodayISO()
    };

    const prevBtn = $('.cal-prev-btn', widget);
    const nextBtn = $('.cal-next-btn', widget);

    if (prevBtn) {
      prevBtn.onclick = () => {
        soundService.playClick();
        const state = this.calendarStates[widgetId];
        state.viewMonth -= 1;
        if (state.viewMonth < 0) {
          state.viewMonth = 11;
          state.viewYear -= 1;
        }
        this._renderCalendarWidgetGrid(widgetId, inputId);
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        soundService.playClick();
        const state = this.calendarStates[widgetId];
        state.viewMonth += 1;
        if (state.viewMonth > 11) {
          state.viewMonth = 0;
          state.viewYear += 1;
        }
        this._renderCalendarWidgetGrid(widgetId, inputId);
      };
    }

    this._renderCalendarWidgetGrid(widgetId, inputId);
  }

  _renderCalendarWidgetGrid(widgetId, inputId) {
    const widget = $(`#${widgetId}`);
    if (!widget) return;

    const state = this.calendarStates[widgetId];
    const year = state.viewYear;
    const month = state.viewMonth;

    const monthTitle = $('.cal-month-title', widget);
    if (monthTitle) {
      monthTitle.textContent = `${MONTH_NAMES_ES[month]} ${year}`;
    }

    const grid = $('.calendar-days-grid', widget);
    if (!grid) return;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Lunes = 0, Domingo = 6
    let startingDay = firstDay.getDay() - 1;
    if (startingDay === -1) startingDay = 6;

    const todayISO = getTodayISO();
    let daysHTML = '';

    // Días del mes anterior (vacíos)
    for (let i = 0; i < startingDay; i++) {
      daysHTML += `<span class="cal-day-btn other-month"></span>`;
    }

    // Días del mes actual
    for (let day = 1; day <= totalDays; day++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const iso = `${year}-${mStr}-${dStr}`;

      const isSelected = iso === state.selectedDate;
      const isToday = iso === todayISO;

      daysHTML += `
        <button 
          type="button" 
          class="cal-day-btn ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" 
          data-cal-date="${iso}"
        >
          ${day}
        </button>
      `;
    }

    grid.innerHTML = daysHTML;

    // Delegación de clic en los días del calendario
    grid.onclick = (e) => {
      const btn = e.target.closest('[data-cal-date]');
      if (!btn) return;
      soundService.playClick();
      const chosenISO = btn.getAttribute('data-cal-date');
      state.selectedDate = chosenISO;

      $$('.cal-day-btn', grid).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      const input = $(`#${inputId}`);
      if (input) input.value = chosenISO;

      this._updateCalendarLabel(widget, chosenISO);
    };

    // Actualizar input oculto y etiqueta
    const input = $(`#${inputId}`);
    if (input) input.value = state.selectedDate;

    this._updateCalendarLabel(widget, state.selectedDate);
  }

  _updateCalendarLabel(widget, isoStr) {
    const label = $('.calendar-selected-label', widget);
    if (!label || !isoStr) return;

    const parts = isoStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const dayName = DAY_NAMES_FULL_ES[d.getDay()];
      const monthName = MONTH_NAMES_ES[d.getMonth()];
      label.textContent = `${dayName}, ${parts[2]} de ${monthName} de ${parts[0]}`;
    }
  }

  _setCalendarWidgetDate(widgetId, inputId, dateStr) {
    const validISO = dateStr || getTodayISO();
    const parts = validISO.split('-');
    if (parts.length === 3) {
      this.calendarStates[widgetId] = {
        viewYear: parseInt(parts[0], 10),
        viewMonth: parseInt(parts[1], 10) - 1,
        selectedDate: validISO
      };
      this._renderCalendarWidgetGrid(widgetId, inputId);
    }
  }

  /**
   * Inicializa el selector interactivo de prioridades unificado (Alta, Media, Baja)
   */
  _initPrioritySelector(containerId, inputId) {
    const container = $(`#${containerId}`);
    const input = $(`#${inputId}`);
    if (!container || !input) return;

    container.onclick = (e) => {
      const btn = e.target.closest('.priority-card-btn');
      if (!btn) return;
      soundService.playClick();
      const val = btn.getAttribute('data-val');
      input.value = val;

      $$('.priority-card-btn', container).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
  }

  _setPriorityValue(containerId, inputId, priorityVal) {
    const container = $(`#${containerId}`);
    const input = $(`#${inputId}`);
    if (!container || !input) return;

    const targetVal = priorityVal || 'medium';
    input.value = targetVal;

    $$('.priority-card-btn', container).forEach(btn => {
      if (btn.getAttribute('data-val') === targetVal) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  /**
   * Inicializa el reloj digital de celular
   */
  _initMobileClockEvents(containerId) {
    const container = $(`#${containerId}`);
    if (!container) return;

    const ampmBtns = $$('.ampm-btn', container);
    ampmBtns.forEach(btn => {
      btn.onclick = () => {
        soundService.playClick();
        ampmBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    const chips = $$('.clock-quick-chip', container);
    chips.forEach(chip => {
      chip.onclick = () => {
        soundService.playClick();
        const action = chip.getAttribute('data-quick-time');
        const now = new Date();

        if (action === '+30') {
          now.setMinutes(now.getMinutes() + 30);
        } else if (action === '+60') {
          now.setHours(now.getHours() + 1);
        }

        let hours = now.getHours();
        const minutes = now.getMinutes();
        const isPM = hours >= 12;

        hours = hours % 12;
        if (hours === 0) hours = 12;

        const finalMinStr = String(minutes).padStart(2, '0');

        const hourSelect = $('.clock-hour-select', container);
        const minSelect = $('.clock-min-select', container);

        if (hourSelect) hourSelect.value = String(hours);
        if (minSelect) minSelect.value = finalMinStr;

        ampmBtns.forEach(b => {
          if ((isPM && b.getAttribute('data-ampm') === 'PM') || (!isPM && b.getAttribute('data-ampm') === 'AM')) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
      };
    });
  }

  _getMobilePickerTime(form) {
    const hourSelect = form.querySelector('.clock-hour-select');
    const minSelect = form.querySelector('.clock-min-select');
    const activeAmpm = form.querySelector('.ampm-btn.active');

    const h = hourSelect ? hourSelect.value : '12';
    const m = minSelect ? minSelect.value : '00';
    const p = activeAmpm ? activeAmpm.getAttribute('data-ampm') : 'PM';

    return `${h}:${m} ${p}`;
  }

  _setMobilePickerTime(form, timeStr) {
    if (!timeStr) return;
    const clean = formatCleanTime(timeStr);
    const match = clean.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return;

    const hour = parseInt(match[1], 10);
    const minute = match[2].padStart(2, '0');
    const ampm = (match[3] || 'PM').toUpperCase();

    const hourSelect = form.querySelector('.clock-hour-select');
    const minSelect = form.querySelector('.clock-min-select');
    const ampmBtns = form.querySelectorAll('.ampm-btn');

    if (hourSelect) hourSelect.value = String(hour);
    if (minSelect) minSelect.value = minute;

    ampmBtns.forEach(btn => {
      if (btn.getAttribute('data-ampm') === ampm) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  _updateWeeklyNav() {
    const weekOffset = store.getState().weekOffset;
    const days = getWeekDays(weekOffset);
    const weekTitle = getWeekRangeTitle(weekOffset);
    const selectedDate = store.getState().selectedDate;

    const titleEl = $('#weekly-nav-title-text', this.container);
    if (titleEl) titleEl.textContent = weekTitle;

    const nav = $('#weekly-nav', this.container);
    if (nav) {
      nav.innerHTML = this._renderWeekDaysHTML(days, selectedDate);
    }
  }

  _updateGrid() {
    const grid = $('#tasks-grid', this.container);
    if (grid) {
      grid.innerHTML = this._renderTaskCardsHTML();
    }

    const counts = store.getFilterCounts();
    const filteredTasks = store.getFilteredTasks();

    const countHeader = $('#tasks-header-count', this.container);
    if (countHeader) countHeader.textContent = `${filteredTasks.length} tareas`;

    const cHigh = $('#count-high', this.container);
    if (cHigh) cHigh.textContent = counts.high;

    const cMed = $('#count-medium', this.container);
    if (cMed) cMed.textContent = counts.medium;

    const cLow = $('#count-low', this.container);
    if (cLow) cLow.textContent = counts.low;

    const cToday = $('#count-today', this.container);
    if (cToday) cToday.textContent = counts.dueToday;
  }

  _openCreateModal() {
    const form = $('#create-task-form');
    const activeDate = store.getState().selectedDate || getTodayISO();

    if (form) {
      this._setMobilePickerTime(form, '12:00 PM');
      this._setPriorityValue('create-priority-selector', 'task-priority-select', 'medium');
      this._setCalendarWidgetDate('create-calendar-widget', 'create-task-date-val', activeDate);
    }

    if (this.createModal) {
      this.createModal.open();
    }
  }

  _openEditModal(taskId) {
    const task = store.getTasks().find(t => t.id === taskId);
    if (!task) return;

    this.editingTaskId = taskId;
    const form = $('#edit-task-form');
    if (form) {
      form.querySelector('#edit-task-title-input').value = task.title;
      form.querySelector('#edit-task-category-select').value = task.category || 'General';

      this._setPriorityValue('edit-priority-selector', 'edit-task-priority-select', task.priorities[0] || 'medium');
      this._setCalendarWidgetDate('edit-calendar-widget', 'edit-task-date-val', task.date || getTodayISO());
      this._setMobilePickerTime(form, task.time);
    }

    if (this.editModal) {
      this.editModal.open();
    }
  }

  _handleCreateTask(form) {
    const titleInput = form.querySelector('#task-title-input');
    const prioritySelect = form.querySelector('#task-priority-select');
    const categorySelect = form.querySelector('#task-category-select');
    const dateInput = form.querySelector('#create-task-date-val');
    const emailReminderToggle = form.querySelector('#task-email-reminder-toggle');

    if (!titleInput || !titleInput.value.trim()) {
      toast.warning('Por favor ingresa un título para la tarea');
      return;
    }

    const priority = prioritySelect ? prioritySelect.value : 'medium';
    const isEmailEnabled = emailReminderToggle ? emailReminderToggle.checked : false;
    const formattedTime = this._getMobilePickerTime(form);
    const chosenDate = dateInput ? dateInput.value : (store.getState().selectedDate || getTodayISO());

    store.addTask({
      title: titleInput.value.trim(),
      priorities: [priority],
      time: formattedTime,
      date: chosenDate,
      category: categorySelect ? categorySelect.value : 'General',
      alarm: priority === 'high'
    });

    soundService.playTaskComplete();
    toast.success(`Tarea guardada (Programada para el ${chosenDate} a las ${formattedTime})`);

    form.reset();
    if (this.createModal) this.createModal.close();
  }

  _handleEditTask(form) {
    if (!this.editingTaskId) return;

    const titleInput = form.querySelector('#edit-task-title-input');
    const priorityInput = form.querySelector('#edit-task-priority-select');
    const categorySelect = form.querySelector('#edit-task-category-select');
    const dateInput = form.querySelector('#edit-task-date-val');

    const formattedTime = this._getMobilePickerTime(form);
    const chosenDate = dateInput ? dateInput.value : getTodayISO();
    const priority = priorityInput ? priorityInput.value : 'medium';

    store.editTask(this.editingTaskId, {
      title: titleInput.value.trim(),
      priorities: [priority],
      time: formattedTime,
      date: chosenDate,
      category: categorySelect.value,
      alarm: priority === 'high'
    });

    toast.success('Tarea actualizada exitosamente');
    if (this.editModal) this.editModal.close();
    this.editingTaskId = null;
  }

  _checkDayCelebration() {
    const progress = store.getDailyProgress();
    if (progress.total > 0 && progress.completed === progress.total) {
      soundService.playCelebration();
      toast.success('¡Increíble! Has completado todas las tareas de hoy.');
    }
  }

  _updateDailyProgressUI() {
    const progress = store.getDailyProgress();
    const fill = $('.topbar-progress-fill');
    const text = $('.topbar-progress-text');

    if (fill) fill.style.width = `${progress.percentage}%`;
    if (text) text.textContent = `${progress.completed}/${progress.total} completadas (${progress.percentage}%)`;
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
