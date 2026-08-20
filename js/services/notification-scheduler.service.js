/**
 * FocusFlow Web - Services: Real-Time Dynamic Notification & Desktop System Scheduler
 * Gestión precisa segundo a segundo de alarmas, sincronización con modal activo,
 * notificaciones de escritorio (OS) y despacho de correos electrónicos automáticos (Gmail SMTP).
 * Con persistencia exacta de intervalos de hidratación para evitar reinicios al recargar la página.
 */

import { store } from '../core/store.js';
import { soundService } from './sound.service.js';
import { notificationService } from './notification.service.js';
import { apiService } from './api.service.js';
import { StorageService } from './storage.service.js';
import { toast } from '../components/toast.component.js';
import { getTodayISO, formatCleanTime } from '../utils/date.utils.js';
import { $, escapeHTML } from '../utils/dom.utils.js';

class NotificationSchedulerService {
  constructor() {
    this.firedAlarms = new Set();
    this.checkInterval = null;
    this.currentActiveAlarmTaskId = null;
  }

  init() {
    this.requestDesktopPermission();
    this._bindAlarmModalEvents();

    // Inicializar timestamp de hidratación si no existe
    if (!StorageService.get('last_water_check_ts')) {
      StorageService.set('last_water_check_ts', Date.now());
    }

    if (this.checkInterval) clearInterval(this.checkInterval);
    // Verificación precisa cada 1 segundo (1000ms)
    this.checkInterval = setInterval(() => this.checkSchedules(), 1000);
    this.checkSchedules();
  }

  async requestDesktopPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          console.log('[NotificationScheduler] Permisos de notificaciones concedidos.');
        }
      } catch (e) {
        console.warn('Permisos de notificación:', e);
      }
    }
  }

  resetWaterTimer() {
    StorageService.set('last_water_check_ts', Date.now());
  }

  getWaterTimeRemaining() {
    const hydration = store.getState().hydration;
    if (!hydration.reminder || !hydration.reminder.enabled) return null;

    const intervalHours = parseFloat(hydration.reminder.intervalHours) || 1;
    const intervalMs = Math.round(intervalHours * 3600 * 1000);
    const lastCheck = StorageService.get('last_water_check_ts', Date.now());
    const elapsed = Date.now() - lastCheck;
    const remainingMs = Math.max(0, intervalMs - elapsed);

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return {
      minutes,
      seconds,
      totalSeconds,
      remainingMs,
      intervalHours
    };
  }

  getNotifications() {
    return store.getNotifications();
  }

  addNotification(notif) {
    const saved = store.addNotification(notif);
    this._dispatchAlert(saved);
    return saved;
  }

  removeNotification(id) {
    store.removeNotification(id);
  }

  clearAll() {
    store.clearNotifications();
  }

  checkSchedules() {
    const todayISO = getTodayISO();
    const tasks = store.getTasks().filter(t => t.date === todayISO && !t.completed);

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    // 1. Revisión de alarmas de tareas programadas
    tasks.forEach(task => {
      // Si ya sonó esta alarma específica en este minuto, omitir
      const alarmKey = `${task.id}-${task.time}-${todayISO}`;
      if (this.firedAlarms.has(alarmKey)) return;

      const parsed = this._parseTimeString(task.time);
      if (parsed) {
        if (parsed.hours === currentHours && parsed.minutes === currentMinutes) {
          this.firedAlarms.add(alarmKey);
          const priority = (task.priorities && task.priorities[0]) || 'medium';

          const notif = this.addNotification({
            id: `notif-task-${task.id}`,
            taskId: task.id,
            title: task.title,
            description: `Hora programada: ${task.time} (${task.category || 'General'})`,
            priority: priority,
            type: 'task',
            time: task.time
          });

          // Abrir modal destacado en pantalla
          this._showActiveAlarmModal(task, priority);

          // Despacho de Correo Electrónico para Tareas
          const emailPrefs = store.getEmailPreferences() || {};
          const currentUser = store.getUser() || {};
          const targetEmail = (emailPrefs && emailPrefs.notificationEmail) || (currentUser && currentUser.email) || 'dannyeduardoanasi@gmail.com';

          if (targetEmail && (task.emailAlert !== false) && (emailPrefs.emailTaskAlerts !== false)) {
            apiService.sendTaskEmailReminder(targetEmail, task.title, task.time, task.category || 'General')
              .then(() => {
                console.log(`[NotificationScheduler] Correo de tarea enviado exitosamente a ${targetEmail}`);
                toast.info(`Alarma: Correo enviado a ${targetEmail}`);
              })
              .catch(err => console.warn('[NotificationScheduler] Fallo de correo de tarea:', err));
          }
        }
      }
    });

    // 2. Revisión de recordatorio de hidratación con persistencia de tiempo
    const hydration = store.getState().hydration;
    if (hydration.reminder && hydration.reminder.enabled) {
      const intervalHours = parseFloat(hydration.reminder.intervalHours) || 1;
      const intervalMs = intervalHours * 3600 * 1000;
      
      const lastCheck = StorageService.get('last_water_check_ts', Date.now());
      const elapsed = Date.now() - lastCheck;

      if (elapsed >= intervalMs) {
        // Actualizar marca de tiempo persistente
        StorageService.set('last_water_check_ts', Date.now());

        this.addNotification({
          id: `notif-water-${Date.now()}`,
          title: 'Recordatorio de Hidratación',
          description: 'Momento de beber un vaso de agua (+250 ml) para mantener tu concentración.',
          priority: 'medium',
          type: 'hydration',
          time: 'Ahora'
        });

        // Despacho de Correo Electrónico para Hidratación
        const emailPrefs = store.getEmailPreferences() || {};
        const currentUser = store.getUser() || {};
        const targetEmail = (hydration.reminder && hydration.reminder.email) || (emailPrefs && emailPrefs.notificationEmail) || (currentUser && currentUser.email) || 'dannyeduardoanasi@gmail.com';

        if (targetEmail && (hydration.reminder.emailNotification !== false) && (emailPrefs.emailWaterAlerts !== false)) {
          apiService.sendHydrationEmailReminder(targetEmail)
            .then(() => {
              console.log(`[NotificationScheduler] Correo de hidratación enviado a ${targetEmail}`);
              toast.info(`Hidratación: Correo enviado a ${targetEmail}`);
            })
            .catch(err => console.warn('[NotificationScheduler] Fallo de correo de hidratación:', err));
        }
      }
    }
  }

  /**
   * Muestra la ventana emergente de alarma en pantalla completa
   */
  _showActiveAlarmModal(task, priority) {
    const modal = $('#active-alarm-modal');
    if (!modal) return;

    this.currentActiveAlarmTaskId = task.id;

    const timeEl = $('#alarm-display-time');
    const titleEl = $('#alarm-display-title');
    const metaEl = $('#alarm-display-meta');
    const headerTitle = $('#alarm-modal-header-title');

    if (timeEl) timeEl.textContent = formatCleanTime(task.time);
    if (titleEl) titleEl.textContent = task.title;
    if (metaEl) {
      const priorityLabel = priority === 'high' ? 'Alta (Urgente)' : (priority === 'medium' ? 'Media' : 'Baja');
      metaEl.textContent = `Categoría: ${task.category || 'General'} • Prioridad: ${priorityLabel}`;
    }
    if (headerTitle) {
      headerTitle.textContent = priority === 'high' ? 'Alarma Urgente Activada' : 'Recordatorio de Tarea';
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  _closeActiveAlarmModal() {
    const modal = $('#active-alarm-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    this.currentActiveAlarmTaskId = null;
  }

  _bindAlarmModalEvents() {
    const modal = $('#active-alarm-modal');
    if (!modal) return;

    const closeBtn = $('#btn-close-alarm-modal');
    const dismissBtn = $('#btn-alarm-dismiss');
    const snoozeBtn = $('#btn-alarm-snooze');
    const completeBtn = $('#btn-alarm-complete');

    if (closeBtn) closeBtn.onclick = () => this._closeActiveAlarmModal();
    if (dismissBtn) dismissBtn.onclick = () => this._closeActiveAlarmModal();

    // Posponer 5 minutos
    if (snoozeBtn) {
      snoozeBtn.onclick = () => {
        if (this.currentActiveAlarmTaskId) {
          const task = store.getTasks().find(t => t.id === this.currentActiveAlarmTaskId);
          if (task) {
            const now = new Date();
            now.setMinutes(now.getMinutes() + 5);
            let h = now.getHours();
            const m = String(now.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            if (h === 0) h = 12;
            const newTime = `${h}:${m} ${ampm}`;

            store.editTask(task.id, { time: newTime });
            toast.info(`Alarma pospuesta para las ${newTime}`);
          }
        }
        this._closeActiveAlarmModal();
      };
    }

    // Marcar como completada
    if (completeBtn) {
      completeBtn.onclick = () => {
        if (this.currentActiveAlarmTaskId) {
          store.toggleTaskCompletion(this.currentActiveAlarmTaskId);
          soundService.playTaskComplete();
          toast.success('Tarea completada exitosamente');
        }
        this._closeActiveAlarmModal();
      };
    }
  }

  /**
   * Despacho sensorial diferenciado según prioridad
   */
  _dispatchAlert(notif) {
    const isMuted = soundService.isMuted();
    const priority = notif.priority || 'medium';
    const uniqueTag = `edhuflow-${Date.now()}`;

    // 1. PRIORIDAD ALTA (Modo Alarma Crítica)
    if (priority === 'high') {
      soundService.playUrgentAlarm();
      notificationService.send(`EdhuFlow [URGENTE]: ${notif.title}`, {
        body: notif.description,
        tag: uniqueTag,
        requireInteraction: false
      });
      toast.warning(`[Alarma Urgente] ${notif.title}: ${notif.description}`);
    }

    // 2. PRIORIDAD MEDIA / ESTÁNDAR
    else if (priority === 'medium') {
      soundService.playSoftChime();
      notificationService.send(`EdhuFlow: ${notif.title}`, {
        body: notif.description,
        tag: uniqueTag,
        requireInteraction: false
      });
      toast.info(`[Recordatorio] ${notif.title}: ${notif.description}`);
    }

    // 3. PRIORIDAD BAJA (Aviso Silencioso)
    else {
      notificationService.send(`EdhuFlow: ${notif.title}`, {
        body: notif.description,
        tag: uniqueTag,
        requireInteraction: false
      });
    }
  }

  _parseTimeString(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3] ? match[3].toUpperCase() : null;

    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    return { hours, minutes };
  }
}

export const notificationScheduler = new NotificationSchedulerService();
