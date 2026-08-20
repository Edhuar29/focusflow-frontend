/**
 * FocusFlow Web - Main Application Bootstrap
 * Incluye gestión de Pomodoro en segundo plano, notificaciones dinámicas reales (Web + Desktop),
 * personalización de fotos de perfil de usuario (Google / Archivos Locales / Presets) y búsqueda global.
 */

import { store } from './core/store.js';
import { Router } from './core/router.js';
import { soundService } from './services/sound.service.js';
import { notificationService } from './services/notification.service.js';
import { apiService } from './services/api.service.js';
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
import { AuthModal } from './components/auth.modal.js';
import { $, $$, escapeHTML } from './utils/dom.utils.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Aplicar tema de acento inicial
  const currentAccent = store.getState().accent || 'cobalt';
  document.documentElement.setAttribute('data-accent', currentAccent);

  // 2. Inicializar Pantalla / Modal de Autenticación
  const authModal = new AuthModal();

  // 3. Registrar Rutas de la SPA
  const routes = {
    'dashboard': DashboardView,
    'tasks': TasksView,
    'pomodoro': PomodoroView,
    'hydration': HydrationView,
    'assistant': AssistantView,
    'analytics': AnalyticsView,
    'settings': SettingsView
  };

  // 4. Iniciar Router con Dashboard por defecto
  const router = new Router(routes, 'dashboard');

  // 5. Inicializar Herramientas de la Barra Superior y Perfil
  initTopBarTools(router);

  // 6. Inicializar Sistema de Personalización de Fotos de Perfil y Edición de Datos
  initAvatarCustomization();
  initEditProfileModal();

  // 7. Inicializar Modal de Términos de Servicio y Privacidad Legal
  initLegalDocsModal();

  // 8. Inicializar Programador de Notificaciones Dinámicas
  notificationScheduler.init();

  // 9. Inicializar selector de prioridades visuales en modal
  initModalPrioritySelector();

  console.log('EdhuFlow inicializado correctamente.');
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
        const priority = (t.priorities && t.priorities[0]) || 'medium';
        html += `
          <div class="palette-result-item" data-task-focus="${t.id}">
            <span>${escapeHTML(t.title)}</span>
            <span class="badge badge-priority-${priority}">${priority}</span>
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

  // Control de Notificaciones de Escritorio (Prendidas / Apagadas con Switch)
  const desktopToggle = $('#toggle-desktop-notifs');
  const desktopBadge = $('#desktop-notif-status-badge');
  const desktopSubtext = $('#desktop-notif-subtext');

  const updateDesktopNotifUI = () => {
    const permStatus = notificationService.getPermissionStatus();
    const isExplicitlyEnabled = StorageService.get('edhuflow_desktop_notifs_enabled', true);

    if (permStatus === 'granted') {
      if (isExplicitlyEnabled) {
        if (desktopToggle) desktopToggle.checked = true;
        if (desktopBadge) {
          desktopBadge.textContent = 'PRENDIDAS';
          desktopBadge.style.background = 'rgba(16, 185, 129, 0.18)';
          desktopBadge.style.color = '#10B981';
        }
        if (desktopSubtext) {
          desktopSubtext.textContent = 'Las alertas y alarmas se mostrarán en la pantalla de tu computadora.';
        }
      } else {
        if (desktopToggle) desktopToggle.checked = false;
        if (desktopBadge) {
          desktopBadge.textContent = 'APAGADAS';
          desktopBadge.style.background = 'rgba(255, 255, 255, 0.08)';
          desktopBadge.style.color = 'var(--text-muted)';
        }
        if (desktopSubtext) {
          desktopSubtext.textContent = 'Alertas en pantalla desactivadas. Enciende el interruptor para activarlas.';
        }
      }
    } else if (permStatus === 'denied') {
      if (desktopToggle) desktopToggle.checked = false;
      if (desktopBadge) {
        desktopBadge.textContent = 'BLOQUEADAS';
        desktopBadge.style.background = 'rgba(239, 68, 68, 0.18)';
        desktopBadge.style.color = '#EF4444';
      }
      if (desktopSubtext) {
        desktopSubtext.textContent = 'Permiso denegado en el navegador. Haz clic en el icono del candado arriba para permitir.';
      }
    } else {
      // 'default'
      if (desktopToggle) desktopToggle.checked = false;
      if (desktopBadge) {
        desktopBadge.textContent = 'APAGADAS';
        desktopBadge.style.background = 'rgba(255, 255, 255, 0.08)';
        desktopBadge.style.color = 'var(--text-muted)';
      }
      if (desktopSubtext) {
        desktopSubtext.textContent = 'Haz clic en el interruptor para solicitar permiso y prender las alertas de tu computadora.';
      }
    }
  };

  updateDesktopNotifUI();

  if (desktopToggle) {
    desktopToggle.addEventListener('change', async () => {
      if (desktopToggle.checked) {
        soundService.playClick();
        const granted = await notificationService.requestPermission();
        if (granted) {
          StorageService.set('edhuflow_desktop_notifs_enabled', true);
          updateDesktopNotifUI();
          soundService.playSoftChime();
          toast.success('Notificaciones en tu computadora PRENDIDAS.');
          notificationService.send('EdhuFlow — Alertas Prendidas', {
            body: 'Las notificaciones en tu computadora están prendidas y activas.',
            tag: 'edhuflow-enabled-alert'
          });
        } else {
          StorageService.set('edhuflow_desktop_notifs_enabled', false);
          desktopToggle.checked = false;
          updateDesktopNotifUI();
          toast.warning('Permiso requerido. Habilita las notificaciones en tu navegador.');
        }
      } else {
        soundService.playClick();
        StorageService.set('edhuflow_desktop_notifs_enabled', false);
        updateDesktopNotifUI();
        toast.info('Notificaciones en tu computadora APAGADAS.');
      }
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

  // Carga y sincronización del estado de presencia persistente
  const savedPresence = StorageService.get('presence_status', 'available');
  if (headerPresenceDot) {
    headerPresenceDot.className = `presence-dot ${savedPresence}`;
  }

  const presenceButtons = $$('.presence-option-btn', profilePopover);
  presenceButtons.forEach(btn => {
    const status = btn.getAttribute('data-status');
    if (status === savedPresence) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    btn.addEventListener('click', () => {
      soundService.playClick();
      const newStatus = btn.getAttribute('data-status');
      
      presenceButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (headerPresenceDot) {
        headerPresenceDot.className = `presence-dot ${newStatus}`;
      }

      StorageService.set('presence_status', newStatus);

      const statusLabels = {
        available: 'Disponible',
        focus: 'En Modo Enfoque (Pomodoro)',
        break: 'En Pausa / Descanso'
      };

      toast.info(`Estado: ${statusLabels[newStatus] || newStatus}`);
    });
  });

  const authSwitchBtn = $('#btn-profile-auth-switch');
  
  const updateProfilePopoverAuthButtons = () => {
    const isAuth = store.isAuthenticated();
    if (authSwitchBtn) {
      authSwitchBtn.style.display = isAuth ? 'none' : 'block';
    }
    if (profileLogoutBtn) {
      profileLogoutBtn.style.display = isAuth ? 'block' : 'none';
    }
  };

  updateProfilePopoverAuthButtons();
  eventBus.on('auth:changed', updateProfilePopoverAuthButtons);
  eventBus.on('store:userUpdated', updateProfilePopoverAuthButtons);

  if (authSwitchBtn) {
    authSwitchBtn.addEventListener('click', () => {
      soundService.playClick();
      if (profilePopover) profilePopover.classList.remove('open');
      eventBus.emit('auth:open');
    });
  }

  // Modal de confirmación elegante para cerrar sesión
  const logoutModal = $('#logout-confirm-modal');
  const cancelLogoutBtn = $('#btn-cancel-logout');
  const confirmLogoutBtn = $('#btn-confirm-logout');

  const openLogoutModal = () => {
    soundService.playClick();
    if (profilePopover) profilePopover.classList.remove('open');
    if (logoutModal) {
      logoutModal.classList.add('open');
      logoutModal.setAttribute('aria-hidden', 'false');
    }
  };

  const closeLogoutModal = () => {
    if (logoutModal) {
      logoutModal.classList.remove('open');
      logoutModal.setAttribute('aria-hidden', 'true');
    }
  };

  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', openLogoutModal);
  }

  if (cancelLogoutBtn) {
    cancelLogoutBtn.addEventListener('click', closeLogoutModal);
  }

  if (logoutModal) {
    logoutModal.addEventListener('click', (e) => {
      if (e.target === logoutModal) closeLogoutModal();
    });
  }

  if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener('click', () => {
      soundService.playClick();
      closeLogoutModal();
      store.logout();
      toast.info('Has cerrado sesión correctamente.');
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
 * Inicializa la personalización y carga de fotos de perfil (Google, Subida de Archivos y Presets)
 */
function initAvatarCustomization() {
  const avatarModal = $('#avatar-picker-modal');
  const closeAvatarBtn = $('#btn-close-avatar-modal');
  const openAvatarPickerBtn = $('#btn-open-avatar-picker');
  const editProfilePhotoBtn = $('#btn-edit-profile-photo');
  const uploadFileInput = $('#input-avatar-upload');
  const triggerUploadBtn = $('#btn-trigger-upload-file');
  const previewImg = $('#avatar-modal-preview-img');
  const userLabel = $('#avatar-modal-user-label');
  const presetsContainer = $('#avatar-presets-container');
  const googleAvatarBtn = $('#btn-use-google-avatar-style');
  const resetAvatarBtn = $('#btn-reset-avatar-default');

  const headerAvatarImg = $('#header-avatar-img');
  const popoverAvatarImg = $('#popover-avatar-img');
  const popoverUserName = $('#popover-user-name');
  const popoverUserEmail = $('#popover-user-email');

  // Presets vectoriales elegantes
  const PRESET_AVATARS = [
    {
      id: 'avatar-blue',
      name: 'Cobalto Focus',
      svg: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g1' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%233B82F6'/><stop offset='100%' stop-color='%231D4ED8'/></linearGradient></defs><circle cx='50' cy='50' r='50' fill='url(%23g1)'/><circle cx='50' cy='38' r='18' fill='%23FFFFFF' opacity='0.9'/><path d='M22 84c0-15 13-26 28-26s28 11 28 26' fill='%23FFFFFF' opacity='0.9'/></svg>`
    },
    {
      id: 'avatar-emerald',
      name: 'Esmeralda Zen',
      svg: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g2' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%2310B981'/><stop offset='100%' stop-color='%23047857'/></linearGradient></defs><circle cx='50' cy='50' r='50' fill='url(%23g2)'/><circle cx='50' cy='38' r='18' fill='%23FFFFFF' opacity='0.9'/><path d='M22 84c0-15 13-26 28-26s28 11 28 26' fill='%23FFFFFF' opacity='0.9'/></svg>`
    },
    {
      id: 'avatar-purple',
      name: 'Violeta Pro',
      svg: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g3' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%238B5CF6'/><stop offset='100%' stop-color='%236D28D9'/></linearGradient></defs><circle cx='50' cy='50' r='50' fill='url(%23g3)'/><circle cx='50' cy='38' r='18' fill='%23FFFFFF' opacity='0.9'/><path d='M22 84c0-15 13-26 28-26s28 11 28 26' fill='%23FFFFFF' opacity='0.9'/></svg>`
    },
    {
      id: 'avatar-amber',
      name: 'Ámbar Energía',
      svg: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g4' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23F59E0B'/><stop offset='100%' stop-color='%23B45309'/></linearGradient></defs><circle cx='50' cy='50' r='50' fill='url(%23g4)'/><circle cx='50' cy='38' r='18' fill='%23FFFFFF' opacity='0.9'/><path d='M22 84c0-15 13-26 28-26s28 11 28 26' fill='%23FFFFFF' opacity='0.9'/></svg>`
    },
    {
      id: 'avatar-cyan',
      name: 'Cian Océano',
      svg: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g5' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%2306B6D4'/><stop offset='100%' stop-color='%230E7490'/></linearGradient></defs><circle cx='50' cy='50' r='50' fill='url(%23g5)'/><circle cx='50' cy='38' r='18' fill='%23FFFFFF' opacity='0.9'/><path d='M22 84c0-15 13-26 28-26s28 11 28 26' fill='%23FFFFFF' opacity='0.9'/></svg>`
    },
    {
      id: 'avatar-rose',
      name: 'Rosa Neón',
      svg: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g6' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23EC4899'/><stop offset='100%' stop-color='%23BE185D'/></linearGradient></defs><circle cx='50' cy='50' r='50' fill='url(%23g6)'/><circle cx='50' cy='38' r='18' fill='%23FFFFFF' opacity='0.9'/><path d='M22 84c0-15 13-26 28-26s28 11 28 26' fill='%23FFFFFF' opacity='0.9'/></svg>`
    }
  ];

  const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231e293b'/><circle cx='50' cy='38' r='20' fill='%2394a3b8'/><path d='M20 90c0-18 14-30 30-30s30 12 30 30' fill='%2394a3b8'/></svg>`;

  const getGoogleLetterAvatar = (name = 'Danny', email = 'danny@gmail.com') => {
    const initial = (name.trim()[0] || email.trim()[0] || 'U').toUpperCase();
    const colors = ['%231A73E8', '%23188038', '%23D93025', '%23F29900', '%239334E6', '%2312B5CB'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    const color = colors[Math.abs(hash) % colors.length];

    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='${color}'/><text x='50' y='65' font-family='sans-serif' font-size='44' font-weight='bold' fill='%23FFFFFF' text-anchor='middle'>${initial}</text></svg>`;
  };

  const renderAvatars = () => {
    const user = store.getUser();
    const currentAvatar = store.getUserAvatar() || (user ? getGoogleLetterAvatar(user.name, user.email) : defaultAvatar);

    if (headerAvatarImg) headerAvatarImg.src = currentAvatar;
    if (popoverAvatarImg) popoverAvatarImg.src = currentAvatar;
    if (previewImg) previewImg.src = currentAvatar;

    if (user) {
      if (popoverUserName) popoverUserName.textContent = user.name;
      if (popoverUserEmail) popoverUserEmail.textContent = user.email;
      if (userLabel) userLabel.textContent = user.name;
    }
  };

  // Render inicial
  renderAvatars();

  // Renderizar Presets en el modal
  if (presetsContainer) {
    presetsContainer.innerHTML = PRESET_AVATARS.map(p => `
      <div class="avatar-preset-item" data-preset-svg="${encodeURIComponent(p.svg)}" title="${p.name}">
        <img src="${p.svg}" alt="${p.name}" />
      </div>
    `).join('');

    presetsContainer.onclick = (e) => {
      const item = e.target.closest('.avatar-preset-item');
      if (!item) return;
      soundService.playClick();
      const svg = decodeURIComponent(item.getAttribute('data-preset-svg'));
      store.setUserAvatar(svg);
      toast.success('Foto de perfil actualizada');
      closeModal();
    };
  }

  // Abrir modal
  const openModal = () => {
    soundService.playClick();
    const profilePopover = $('#profile-popover');
    if (profilePopover) profilePopover.classList.remove('open');
    renderAvatars();
    if (avatarModal) {
      avatarModal.classList.add('open');
      avatarModal.setAttribute('aria-hidden', 'false');
    }
  };

  const closeModal = () => {
    if (avatarModal) {
      avatarModal.classList.remove('open');
      avatarModal.setAttribute('aria-hidden', 'true');
    }
  };

  if (openAvatarPickerBtn) openAvatarPickerBtn.addEventListener('click', openModal);
  if (editProfilePhotoBtn) editProfilePhotoBtn.addEventListener('click', openModal);
  if (closeAvatarBtn) closeAvatarBtn.addEventListener('click', closeModal);

  // Cerrar al hacer clic en el backdrop
  if (avatarModal) {
    avatarModal.addEventListener('click', (e) => {
      if (e.target === avatarModal) closeModal();
    });
  }

  // Subir archivo local desde el equipo
  if (triggerUploadBtn && uploadFileInput) {
    triggerUploadBtn.addEventListener('click', () => {
      soundService.playClick();
      uploadFileInput.click();
    });

    uploadFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.warning('Por favor selecciona un archivo de imagen válido');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.warning('La imagen no debe superar los 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        store.setUserAvatar(dataUrl);
        toast.success('¡Foto de perfil actualizada correctamente!');
        closeModal();
      };
      reader.readAsDataURL(file);
    });
  }

  // Usar inicial de Google
  if (googleAvatarBtn) {
    googleAvatarBtn.addEventListener('click', () => {
      soundService.playClick();
      const user = store.getUser();
      const googleSvg = getGoogleLetterAvatar(user ? user.name : 'Danny', user ? user.email : 'danny@gmail.com');
      store.setUserAvatar(googleSvg);
      toast.success('Avatar con inicial de Google aplicado');
      closeModal();
    });
  }

  // Restablecer
  if (resetAvatarBtn) {
    resetAvatarBtn.addEventListener('click', () => {
      soundService.playClick();
      store.setUserAvatar(defaultAvatar);
      toast.info('Foto de perfil restablecida');
      closeModal();
    });
  }

  // Suscribirse a cambios en tiempo real
  eventBus.on('user:avatarChanged', () => renderAvatars());
  eventBus.on('user:changed', () => renderAvatars());
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

/**
 * Inicializa el modal de edición de perfil (Nombre y Apellido por separado, Actualización de Correo y Control Estricto de Errores)
 */
function initEditProfileModal() {
  const modal = $('#edit-profile-modal');
  const openBtn = $('#btn-open-edit-profile');
  const closeBtn = $('#btn-close-edit-profile-modal');
  const cancelBtn = $('#btn-cancel-edit-profile');
  const form = $('#form-edit-profile');
  const firstNameInput = $('#input-profile-firstname');
  const lastNameInput = $('#input-profile-lastname');
  const currentEmailInput = $('#input-profile-current-email');
  const newEmailInput = $('#input-profile-new-email');
  const updateEmailBtn = $('#btn-action-update-email');
  const avatarPreview = $('#edit-profile-avatar-preview');
  const switchToAvatarBtn = $('#btn-switch-to-avatar-modal');

  const errorFirstName = $('#error-profile-firstname');
  const errorLastName = $('#error-profile-lastname');
  const errorNewEmail = $('#error-profile-new-email');

  // Reglas de validación estrictas (solo letras, tildes, espacios y guiones)
  const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const clearErrors = () => {
    [errorFirstName, errorLastName, errorNewEmail].forEach(el => {
      if (el) {
        el.textContent = '';
        el.style.display = 'none';
      }
    });
    [firstNameInput, lastNameInput, newEmailInput].forEach(inp => {
      if (inp) inp.style.borderColor = '';
    });
  };

  const showFieldError = (inputEl, errorEl, message) => {
    if (inputEl) {
      inputEl.style.borderColor = 'var(--color-danger)';
      inputEl.focus();
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  };

  const openModal = () => {
    soundService.playClick();
    const profilePopover = $('#profile-popover');
    if (profilePopover) profilePopover.classList.remove('open');
    clearErrors();

    const user = store.getUser() || {};
    const avatar = store.getUserAvatar();

    // Separar nombres y apellidos inteligentemente si vienen juntos
    let fName = user.firstName || '';
    let lName = user.lastName || '';

    if (!fName && user.name) {
      const parts = user.name.trim().split(' ');
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
    }

    if (firstNameInput) firstNameInput.value = fName;
    if (lastNameInput) lastNameInput.value = lName;
    if (currentEmailInput) currentEmailInput.value = user.email || 'dannyeduardoanasi@gmail.com';
    if (newEmailInput) newEmailInput.value = '';
    if (avatarPreview && avatar) avatarPreview.src = avatar;

    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      if (firstNameInput) setTimeout(() => firstNameInput.focus(), 60);
    }
  };

  const closeModal = () => {
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      clearErrors();
    }
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Limpiar errores en tiempo real mientras el usuario escribe
  if (firstNameInput) {
    firstNameInput.addEventListener('input', () => {
      firstNameInput.style.borderColor = '';
      if (errorFirstName) errorFirstName.style.display = 'none';
    });
  }
  if (lastNameInput) {
    lastNameInput.addEventListener('input', () => {
      lastNameInput.style.borderColor = '';
      if (errorLastName) errorLastName.style.display = 'none';
    });
  }
  if (newEmailInput) {
    newEmailInput.addEventListener('input', () => {
      newEmailInput.style.borderColor = '';
      if (errorNewEmail) errorNewEmail.style.display = 'none';
    });
  }

  // Cambiar foto desde el modal de edición de perfil
  if (switchToAvatarBtn) {
    switchToAvatarBtn.addEventListener('click', () => {
      closeModal();
      const avatarModal = $('#avatar-picker-modal');
      if (avatarModal) {
        avatarModal.classList.add('open');
        avatarModal.setAttribute('aria-hidden', 'false');
      }
    });
  }

  // Botón Dedicado: "Actualizar Correo"
  if (updateEmailBtn && newEmailInput) {
    updateEmailBtn.addEventListener('click', () => {
      if (errorNewEmail) errorNewEmail.style.display = 'none';
      const cleanNewEmail = newEmailInput.value.trim().toLowerCase();
      const user = store.getUser() || {};
      const currentEmail = (user.email || '').toLowerCase();

      if (!cleanNewEmail) {
        showFieldError(newEmailInput, errorNewEmail, 'Por favor escribe el nuevo correo que deseas usar');
        return;
      }

      if (!EMAIL_REGEX.test(cleanNewEmail)) {
        showFieldError(newEmailInput, errorNewEmail, 'Ingresa un correo electrónico válido (ej: usuario@gmail.com)');
        return;
      }

      if (cleanNewEmail === currentEmail) {
        showFieldError(newEmailInput, errorNewEmail, 'El nuevo correo debe ser diferente al actual');
        return;
      }

      soundService.playTaskComplete();

      // Actualizar usuario en Store
      const updatedUser = {
        ...user,
        email: cleanNewEmail
      };
      store.setUser(updatedUser);

      // Sincronizar en preferencias de notificaciones
      store.setEmailPreferences({ notificationEmail: cleanNewEmail });

      // Actualizar campos en el modal
      if (currentEmailInput) currentEmailInput.value = cleanNewEmail;
      newEmailInput.value = '';

      // Actualizar popover
      const popoverUserEmail = $('#popover-user-email');
      if (popoverUserEmail) popoverUserEmail.textContent = cleanNewEmail;

      toast.success(`¡Correo de cuenta actualizado a ${cleanNewEmail}!`);
    });
  }

  // Guardar cambios generales de perfil (Nombre y Apellido)
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearErrors();

      const fName = firstNameInput ? firstNameInput.value.trim() : '';
      const lName = lastNameInput ? lastNameInput.value.trim() : '';
      const optionalNewEmail = newEmailInput ? newEmailInput.value.trim().toLowerCase() : '';

      let hasError = false;

      // 1. Control de errores para Nombre
      if (!fName) {
        showFieldError(firstNameInput, errorFirstName, 'Por favor escribe tu nombre');
        hasError = true;
      } else if (fName.length < 2) {
        showFieldError(firstNameInput, errorFirstName, 'El nombre debe tener al menos 2 caracteres');
        hasError = true;
      } else if (!NAME_REGEX.test(fName)) {
        showFieldError(firstNameInput, errorFirstName, 'El nombre solo puede contener letras (sin números ni símbolos)');
        hasError = true;
      }

      // 2. Control de errores para Apellido
      if (!hasError) {
        if (!lName) {
          showFieldError(lastNameInput, errorLastName, 'Por favor escribe tu apellido');
          hasError = true;
        } else if (lName.length < 2) {
          showFieldError(lastNameInput, errorLastName, 'El apellido debe tener al menos 2 caracteres');
          hasError = true;
        } else if (!NAME_REGEX.test(lName)) {
          showFieldError(lastNameInput, errorLastName, 'El apellido solo puede contener letras (sin números ni símbolos)');
          hasError = true;
        }
      }

      // 3. Si además escribió un nuevo correo, validarlo
      let targetEmail = currentEmailInput ? currentEmailInput.value.trim().toLowerCase() : '';
      if (!hasError && optionalNewEmail) {
        if (!EMAIL_REGEX.test(optionalNewEmail)) {
          showFieldError(newEmailInput, errorNewEmail, 'Ingresa un correo electrónico válido');
          hasError = true;
        } else {
          targetEmail = optionalNewEmail;
        }
      }

      if (hasError) return;

      soundService.playTaskComplete();

      const fullName = `${fName} ${lName}`.trim();
      const currentUser = store.getUser() || {};
      const updatedUser = {
        ...currentUser,
        name: fullName,
        firstName: fName,
        lastName: lName,
        email: targetEmail || currentUser.email
      };

      // Guardar en Store y LocalStorage
      store.setUser(updatedUser);

      // Sincronizar correo principal con las preferencias de notificaciones
      store.setEmailPreferences({ notificationEmail: targetEmail || currentUser.email });

      // Actualizar saludo del topbar y dashboard
      const greetingNameEl = document.querySelector('.welcome-name, .dashboard-greeting strong');
      if (greetingNameEl) {
        greetingNameEl.textContent = fName;
      }

      // Actualizar popover
      const popoverUserName = $('#popover-user-name');
      const popoverUserEmail = $('#popover-user-email');
      if (popoverUserName) popoverUserName.textContent = fullName;
      if (popoverUserEmail) popoverUserEmail.textContent = targetEmail || currentUser.email;

      toast.success('¡Perfil actualizado con éxito!');
      closeModal();
    });
  }
}

/**
 * Inicializa el Modal de Documentos Legales (Términos de Servicio y Política de Privacidad)
 */
function initLegalDocsModal() {
  const modal = $('#legal-docs-modal');
  const closeBtn = $('#btn-close-legal-modal');
  const agreeBtn = $('#btn-agree-legal-modal');
  const openTermsBtns = $$('#btn-open-terms');
  const openPrivacyBtns = $$('#btn-open-privacy');
  const tabTerms = $('#tab-legal-terms');
  const tabPrivacy = $('#tab-legal-privacy');
  const sectionTerms = $('#section-legal-terms');
  const sectionPrivacy = $('#section-legal-privacy');

  if (!modal) return;

  const selectTab = (tabName) => {
    if (tabName === 'terms') {
      if (tabTerms) tabTerms.classList.add('active');
      if (tabPrivacy) tabPrivacy.classList.remove('active');
      if (sectionTerms) sectionTerms.classList.add('active');
      if (sectionPrivacy) sectionPrivacy.classList.remove('active');
    } else {
      if (tabTerms) tabTerms.classList.remove('active');
      if (tabPrivacy) tabPrivacy.classList.add('active');
      if (sectionTerms) sectionTerms.classList.remove('active');
      if (sectionPrivacy) sectionPrivacy.classList.add('active');
    }
  };

  const openModal = (tab = 'terms') => {
    soundService.playClick();
    selectTab(tab);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  };

  const closeModal = () => {
    soundService.playClick();
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  };

  openTermsBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('terms');
    });
  });

  openPrivacyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('privacy');
    });
  });

  if (tabTerms) tabTerms.addEventListener('click', () => selectTab('terms'));
  if (tabPrivacy) tabPrivacy.addEventListener('click', () => selectTab('privacy'));

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (agreeBtn) agreeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

