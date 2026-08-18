/**
 * FocusFlow Web - Main Application Bootstrap
 * Incluye gestión de Pomodoro en segundo plano, notificaciones dinámicas reales (Web + Desktop) y creación rápida.
 */

import { store } from './core/store.js';
import { Router } from './core/router.js';
import { soundService } from './services/sound.service.js';
import { toast } from './components/toast.component.js';
import { StorageService } from './services/storage.service.js';
import { notificationScheduler } from './services/notification-scheduler.service.js';
import { eventBus } from './core/event-bus.js';
import { DashboardView } from './views/dashboard.view.js';
import { TasksView } from './views/tasks.view.js';
import { PomodoroView } from './views/pomodoro.view.js';
import { HydrationView } from './views/hydration.view.js';
import { AssistantView } from './views/assistant.view.js';
import { AnalyticsView } from './views/analytics.view.js';
import { SettingsView } from './views/settings.view.js';
import { $, $$, escapeHTML } from './utils/dom.utils.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Aplicar tema de acento inicial
  const currentAccent = store.getState().accent || 'cobalt';
  document.documentElement.setAttribute('data-accent', currentAccent);

  // 2. Registrar Rutas de la SPA
  const routes = {
    'dashboard': DashboardView,
    'tasks': TasksView,
    'pomodoro': PomodoroView,
    'hydration': HydrationView,
    'assistant': AssistantView,
    'analytics': AnalyticsView,
    'settings': SettingsView
  };

  // 3. Iniciar Router con Dashboard por defecto
  const router = new Router(routes, 'dashboard');

  // 4. Inicializar Herramientas de la Barra Superior
  initTopBarTools(router);

  // 5. Inicializar Programador de Notificaciones Dinámicas
  notificationScheduler.init();

  // 6. Inicializar selector de prioridades visuales en modal
  initModalPrioritySelector();

  console.log('FocusFlow Web inicializado correctamente con Notificaciones Duales (Web + Desktop OS).');
});

/**
 * Inicializa la funcionalidad interactiva de la Lupa,
 * Campana de Notificaciones (DND & Alertas Reales) y Menú de Perfil.
 */
function initTopBarTools(router) {
  const searchBtn = $('#btn-topbar-search');
  const paletteModal = $('#command-palette-modal');
  const paletteInput = $('#command-palette-input');
  const paletteResults = $('#palette-results-list');
  const closePaletteBtn = $('[data-close-palette]');

  const notifBtn = $('#btn-notifications');
  const notifPopover = $('#notifications-popover');
  const notifDot = $('#notification-badge-dot');
  const clearNotifsBtn = $('#btn-clear-notifications');
  const notifsList = $('#notifications-list');
  const dndToggle = $('#toggle-dnd-mode');
  const dndPill = $('#dnd-status-pill');

  const profileBtn = $('#btn-profile-avatar');
  const profilePopover = $('#profile-popover');
  const headerPresenceDot = $('#header-presence-dot');
  const profileLogoutBtn = $('#btn-profile-logout');

  // Renderizador unificado de la lista de notificaciones en la campana
  const renderNotificationsList = (notifs) => {
    if (!notifsList) return;

    const list = notifs || store.getNotifications();

    if (list.length === 0) {
      if (notifDot) notifDot.classList.add('hidden');
      notifsList.innerHTML = `
        <div style="padding: var(--space-6) var(--space-4); text-align: center; color: var(--text-muted); font-size: 11.5px;">
          No tienes notificaciones pendientes
        </div>
      `;
      return;
    }

    if (notifDot) notifDot.classList.remove('hidden');

    notifsList.innerHTML = list.map(n => {
      let priorityBadgeText = 'Recordatorio';
      if (n.priority === 'high') priorityBadgeText = 'Alarma Urgente';
      if (n.priority === 'low') priorityBadgeText = 'Silencioso';

      return `
        <div class="popover-alert-card priority-${n.priority || 'medium'}" data-notif-id="${n.id}">
          <div class="popover-alert-header">
            <strong>${escapeHTML(n.title)}</strong>
            <span class="badge badge-priority-${n.priority || 'medium'}">${priorityBadgeText}</span>
          </div>
          <p style="margin: 4px 0 8px 0; font-size: 11px; color: var(--text-secondary);">
            ${escapeHTML(n.description)}
          </p>
          <div class="popover-alert-actions">
            ${n.type === 'hydration' ? `
              <button class="btn btn-primary btn-notif-action" data-notif-action="drink" data-target="${n.id}" style="width: 100%;">
                Registrar Vaso (+250 ml)
              </button>
            ` : `
              <button class="btn btn-secondary btn-notif-action" data-notif-action="snooze" data-target="${n.id}">
                Posponer 10m
              </button>
              <button class="btn btn-primary btn-notif-action" data-notif-action="done" data-target="${n.id}" data-task-id="${n.taskId || ''}">
                Marcar Hecha
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  };

  // Render inicial al cargar
  renderNotificationsList(store.getNotifications());

  // Suscribirse a cambios en tiempo real
  eventBus.on('notifications:updated', (notifs) => {
    renderNotificationsList(notifs);
  });

  // --- A. COMMAND PALETTE / BUSCADOR GLOBAL ---
  const openPalette = () => {
    soundService.playClick();
    paletteModal.classList.add('open');
    paletteInput.value = '';
    renderPaletteResults('');
    setTimeout(() => paletteInput.focus(), 50);
  };

  const closePalette = () => {
    paletteModal.classList.remove('open');
  };

  if (searchBtn) searchBtn.addEventListener('click', openPalette);
  if (closePaletteBtn) closePaletteBtn.addEventListener('click', closePalette);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (paletteModal.classList.contains('open')) closePalette();
      else openPalette();
    }
    if (e.key === 'Escape' && paletteModal.classList.contains('open')) {
      closePalette();
    }
  });

  const renderPaletteResults = (query) => {
    const q = query.trim().toLowerCase();
    const tasks = store.getTasks();

    const navOptions = [
      { type: 'nav', title: 'Dashboard Principal', route: 'dashboard' },
      { type: 'nav', title: 'Tareas y Horarios', route: 'tasks' },
      { type: 'nav', title: 'Temporizador Pomodoro', route: 'pomodoro' },
      { type: 'nav', title: 'Control de Hidratación', route: 'hydration' },
      { type: 'nav', title: 'Asistente IA Gemini', route: 'assistant' },
      { type: 'nav', title: 'Estadísticas y Analítica', route: 'analytics' },
      { type: 'nav', title: 'Ajustes y Personalización', route: 'settings' },
    ];

    const matchingNav = navOptions.filter(n => n.title.toLowerCase().includes(q));
    const matchingTasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q));

    let html = '';

    if (matchingNav.length > 0) {
      html += `<div style="padding: 4px 8px; font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase;">Navegación</div>`;
      matchingNav.forEach(n => {
        html += `
          <div class="palette-result-item" data-route-action="${n.route}">
            <span>${n.title}</span>
            <span style="font-size: 10px; color: var(--text-muted);">Pestaña</span>
          </div>
        `;
      });
    }

    if (matchingTasks.length > 0) {
      html += `<div style="padding: 8px 8px 4px 8px; font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase;">Tareas</div>`;
      matchingTasks.slice(0, 5).forEach(t => {
        html += `
          <div class="palette-result-item" data-task-focus="${t.id}">
            <span>${escapeHTML(t.title)}</span>
            <span class="badge badge-priority-${t.priorities[0] || 'medium'}">${t.priorities[0] || 'medium'}</span>
          </div>
        `;
      });
    }

    if (!html) {
      html = `<div style="padding: var(--space-4); text-align: center; color: var(--text-muted); font-size: var(--text-sm);">No se encontraron coincidencias para "${escapeHTML(query)}"</div>`;
    }

    paletteResults.innerHTML = html;
  };

  if (paletteInput) {
    paletteInput.addEventListener('input', (e) => renderPaletteResults(e.target.value));
  }

  if (paletteResults) {
    paletteResults.addEventListener('click', (e) => {
      const navItem = e.target.closest('[data-route-action]');
      if (navItem) {
        const route = navItem.getAttribute('data-route-action');
        closePalette();
        router.navigate(route);
        return;
      }

      const taskItem = e.target.closest('[data-task-focus]');
      if (taskItem) {
        const taskId = taskItem.getAttribute('data-task-focus');
        closePalette();
        store.startFocusOnTask(taskId);
        return;
      }
    });
  }

  // --- B. CENTRO DE NOTIFICACIONES DINÁMICAS & MODO NO MOLESTAR ---
  if (notifBtn && notifPopover) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      soundService.playClick();
      if (profilePopover) profilePopover.classList.remove('open');
      
      // Renderizar notificaciones frescas al abrir
      renderNotificationsList(store.getNotifications());
      notifPopover.classList.toggle('open');
    });
  }

  if (dndToggle) {
    dndToggle.addEventListener('change', () => {
      const isDND = dndToggle.checked;
      soundService.setMuted(isDND);

      if (isDND) {
        if (dndPill) dndPill.style.display = 'inline-flex';
        toast.warning('Modo No Molestar activado: sonidos y alertas silenciados');
      } else {
        if (dndPill) dndPill.style.display = 'none';
        soundService.playClick();
        toast.info('Modo No Molestar desactivado');
      }
    });
  }

  // Acciones en tarjetas de notificación dinámicas
  if (notifPopover) {
    notifPopover.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-notif-action]');
      if (!actionBtn) return;

      const action = actionBtn.getAttribute('data-notif-action');
      const notifId = actionBtn.getAttribute('data-target');
      const taskId = actionBtn.getAttribute('data-task-id');

      if (action === 'snooze') {
        soundService.playClick();
        toast.info('Alarma pospuesta 10 minutos');
        store.removeNotification(notifId);
      } else if (action === 'done') {
        soundService.playTaskComplete();
        if (taskId) store.toggleTaskCompletion(taskId);
        toast.success('Tarea marcada como completada');
        store.removeNotification(notifId);
      } else if (action === 'drink') {
        soundService.playTaskComplete();
        const data = store.getState().hydration;
        data.currentMl = (data.currentMl || 0) + 250;
        data.logsToday = (data.logsToday || 0) + 1;
        store._persistAndNotify('hydration', data, 'hydration:updated');
        toast.success(`+250 ml registrados (Total: ${data.currentMl} ml)`);
        store.removeNotification(notifId);
      }
    });
  }

  if (clearNotifsBtn) {
    clearNotifsBtn.addEventListener('click', () => {
      soundService.playClick();
      store.clearNotifications();
      toast.info('Notificaciones limpiadas');
    });
  }

  // --- C. MENÚ DE PERFIL, ESTADO DE PRESENCIA & SESIÓN ---
  if (profileBtn && profilePopover) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      soundService.playClick();
      if (notifPopover) notifPopover.classList.remove('open');
      profilePopover.classList.toggle('open');
    });
  }

  const presenceButtons = $$('.presence-option-btn', profilePopover);
  presenceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      soundService.playClick();
      const status = btn.getAttribute('data-status');
      
      presenceButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (headerPresenceDot) {
        headerPresenceDot.className = `presence-dot ${status}`;
      }

      const statusLabels = {
        available: 'Disponible',
        focus: 'En Modo Enfoque (Pomodoro)',
        break: 'En Pausa / Descanso'
      };

      toast.info(`Estado actualizado: ${statusLabels[status] || status}`);
    });
  });

  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', () => {
      if (confirm('¿Deseas cerrar sesión y reiniciar los datos de prueba a su estado original?')) {
        StorageService.clearAll();
        window.location.reload();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (notifPopover && notifPopover.classList.contains('open') && !notifPopover.contains(e.target) && e.target !== notifBtn) {
      notifPopover.classList.remove('open');
    }
    if (profilePopover && profilePopover.classList.contains('open') && !profilePopover.contains(e.target) && !profileBtn.contains(e.target)) {
      profilePopover.classList.remove('open');
    }
  });
}

/**
 * Inicializa el selector visual de tarjetas de prioridad en el modal de crear tarea
 */
function initModalPrioritySelector() {
  const container = $('#modal-priority-selector');
  const hiddenInput = $('#task-priority-select');
  if (!container || !hiddenInput) return;

  const buttons = $$('.priority-card-btn', container);
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      soundService.playClick();
      const val = btn.getAttribute('data-val');
      buttons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      hiddenInput.value = val;
    });
  });
}
