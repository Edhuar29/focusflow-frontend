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
import { leaderElectionService } from './leader-election.service.js';
import { toast } from '../components/toast.component.js';
import { getTodayISO, formatCleanTime } from '../utils/date.utils.js';
import { $, escapeHTML } from '../utils/dom.utils.js';

class NotificationSchedulerService {
  constructor() {
    this.firedAlarms = new Set();
    this.checkInterval = null;
    // Inicializar timestamp de hidratación si no existe
    if (!StorageService.get('last_water_check_ts')) {
      StorageService.set('last_water_check_ts', Date.now());
    }

    // Escuchar notificaciones emitidas por la pestaña Líder
    leaderElectionService.on('SYNC_NOTIFICATION', (notif) => {
      if (!leaderElectionService.isLeader()) {
        store.addNotification(notif);
      }
    });

    if (this.checkInterval) clearInterval(this.checkInterval);
    // Verificación precisa cada 1 segundo (1000ms)
    this.checkInterval = setInterval(() => this.checkSchedules(), 1000);
    this.checkSchedules();
  }

  init() {
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
    this.firedAlarms.clear();
    StorageService.remove('last_water_dispatched_key');
    StorageService.set('last_water_check_ts', Date.now());
  }

  _parseTimeToMinutes(timeStr, fallbackMin = 480) {
    if (!timeStr || typeof timeStr !== 'string') return fallbackMin;
    const clean = timeStr.trim().toLowerCase();
    const match = clean.match(/^(\d{1,2}):(\d{1,2})(?:\s*([ap]\.?m\.?))?/i);
    if (!match) return fallbackMin;

    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) || 0;
    const isPM = match[3] && match[3].startsWith('p');
    const isAM = match[3] && match[3].startsWith('a');

    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;

    return (h * 60) + m;
  }

  getWaterTimeRemaining() {
    const hydration = store.getState().hydration;
    if (!hydration || !hydration.reminder || !hydration.reminder.enabled) return null;

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentTotalSec = (currentHours * 3600) + (currentMinutes * 60) + currentSeconds;

    const startTotalMin = this._parseTimeToMinutes(hydration.reminder.startTime, 480);
    const endTotalMin = this._parseTimeToMinutes(hydration.reminder.endTime, 1320);

    const startTotalSec = startTotalMin * 60;
    const endTotalSec = endTotalMin * 60;

    const intervalMinutes = Math.max(1, Math.round(parseFloat(hydration.reminder.intervalHours || 1) * 60));
    const intervalSec = intervalMinutes * 60;

    let remainingSec = 0;
    let nextAlarmTime = '';

    if (currentTotalSec < startTotalSec) {
      remainingSec = startTotalSec - currentTotalSec;
      const sh = String(Math.floor(startTotalMin / 60)).padStart(2, '0');
      const sm = String(startTotalMin % 60).padStart(2, '0');
      nextAlarmTime = `${sh}:${sm}`;
    } else if (currentTotalSec >= endTotalSec) {
      remainingSec = (86400 - currentTotalSec) + startTotalSec;
      const sh = String(Math.floor(startTotalMin / 60)).padStart(2, '0');
      const sm = String(startTotalMin % 60).padStart(2, '0');
      nextAlarmTime = `Mañana ${sh}:${sm}`;
    } else {
      const diffFromStartSec = currentTotalSec - startTotalSec;
      const passedInCycleSec = diffFromStartSec % intervalSec;
      remainingSec = intervalSec - passedInCycleSec;
      const nextTotalSec = currentTotalSec + remainingSec;
      const nextH = String(Math.floor(nextTotalSec / 3600) % 24).padStart(2, '0');
      const nextM = String(Math.floor((nextTotalSec % 3600) / 60)).padStart(2, '0');
      nextAlarmTime = `${nextH}:${nextM}`;
    }

    const minutes = Math.floor(remainingSec / 60);
    const seconds = remainingSec % 60;

    return {
      minutes,
      seconds,
      totalSeconds: remainingSec,
      remainingMs: remainingSec * 1000,
      nextAlarmTime,
      intervalHours: hydration.reminder.intervalHours
    };
  }

  getNotifications() {
    return store.getNotifications();
  }

  addNotification(notif) {
    const saved = store.addNotification(notif);
    this._dispatchAlert(saved);
    leaderElectionService.broadcast('SYNC_NOTIFICATION', notif);
    return saved;
  }

  removeNotification(id) {
    store.removeNotification(id);
  }

  clearAll() {
    store.clearNotifications();
  }

  checkSchedules() {
    // Solo la pestaña Líder activa evalúa y despacha alarmas para evitar colisiones
    if (!leaderElectionService.isLeader()) return;

    const todayISO = getTodayISO();
    const tasks = store.getTasks().filter(t => {
      const taskDate = (t.date || '').trim().split('T')[0];
      return (taskDate === todayISO || !taskDate) && !t.completed;
    });

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    // 1. Revisión de alarmas de tareas programadas
    tasks.forEach(task => {
      const alarmKey = `${task.id}-${task.time}-${todayISO}`;
      const isTaskDispatched = StorageService.get(`task_alarm_${alarmKey}`, false);
      if (this.firedAlarms.has(alarmKey) || isTaskDispatched) return;

      const parsed = this._parseTimeString(task.time);
      if (parsed) {
        if (parsed.hours === currentHours && parsed.minutes === currentMinutes) {
          this.firedAlarms.add(alarmKey);
          StorageService.set(`task_alarm_${alarmKey}`, true);
          const priority = (task.priorities && task.priorities[0]) || 'medium';

          console.log(`⏰ [NotificationScheduler] ¡Hora cumplida para la tarea "${task.title}"! Ejecutando despacho...`);

          // Etapa A: Guardar en campana y emitir sonido/toast
          try {
            this.addNotification({
              id: `notif-task-${task.id}`,
              taskId: task.id,
              title: task.title,
              description: `Hora programada: ${task.time} (${task.category || 'General'})`,
              priority: priority,
              type: 'task',
              time: task.time
            });
          } catch (e) {
            console.warn('[NotificationScheduler] Error en addNotification:', e);
          }

          // Etapa B: Disparar Notificación Nativa de Escritorio o Smartphone (con vibración)
          try {
            const perm = notificationService.getPermissionStatus();
            if (perm === 'granted') {
              notificationService.send(`EdhuFlow: ${task.title}`, {
                body: `Hora programada: ${task.time} (${task.category || 'General'})`,
                tag: `edhuflow-task-${task.id}`,
                requireInteraction: false
              });
            }
          } catch (e) {
            console.warn('[NotificationScheduler] Error en notificación nativa:', e);
          }
        }
      }
    });

    // 2. Revisión de recordatorio de hidratación anclado a hora exacta del reloj
    const hydration = store.getState().hydration;
    if (hydration && hydration.reminder && hydration.reminder.enabled) {
      const startTotalMin = this._parseTimeToMinutes(hydration.reminder.startTime, 480);
      const endTotalMin = this._parseTimeToMinutes(hydration.reminder.endTime, 1320);
      const currentTotalMin = (currentHours * 60) + currentMinutes;

      const intervalMinutes = Math.max(1, Math.round(parseFloat(hydration.reminder.intervalHours || 1) * 60));

      if (currentTotalMin >= startTotalMin && currentTotalMin <= endTotalMin) {
        const diffFromStart = currentTotalMin - startTotalMin;
        if (diffFromStart % intervalMinutes === 0) {
          const formattedCurrentTime = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;
          const alarmKey = `water_${todayISO}_${formattedCurrentTime}`;
          const lastWaterDispatched = StorageService.get('last_water_dispatched_key', '');

          if (lastWaterDispatched !== alarmKey && !this.firedAlarms.has(alarmKey)) {
            this.firedAlarms.add(alarmKey);
            StorageService.set('last_water_dispatched_key', alarmKey);

            console.log(`[NotificationScheduler] Hora programada de hidratación cumplida (${formattedCurrentTime})`);

            // 1. Sonido especial de hidratación
            soundService.playWaterChime();

            // 2. Registro en campana y alerta completa en pantalla
            this.addNotification({
              id: `notif-water-${Date.now()}`,
              title: 'Recordatorio de Hidratación',
              description: `Son las ${formattedCurrentTime}. Momento de beber un vaso de agua (+250 ml) para mantener tu concentración.`,
              priority: 'medium',
              type: 'hydration',
              time: formattedCurrentTime
            });

            // 3. Notificación Nativa en Pantalla / Smartphone (con vibración)
            notificationService.send('💧 EdhuFlow: Hora de Hidratarte', {
              body: `Momento de tomar un vaso de agua (+250 ml) para mantener tu concentración (${formattedCurrentTime}).`,
              tag: `edhuflow-water-${formattedCurrentTime}`,
              requireInteraction: false
            });
          }
        }
      }
    }
  }

  /**
   * Despacho sensorial diferenciado según prioridad
   */
  _dispatchAlert(notif) {
    if (!notif) return;
    if (notif.type === 'hydration') {
      toast.info(`[Hidratación] ${notif.title}: ${notif.description}`);
      return;
    }

    const priority = notif.priority || 'medium';

    // 1. PRIORIDAD ALTA (Modo Alarma Crítica)
    if (priority === 'high') {
      soundService.playUrgentAlarm();
      toast.warning(`[Alarma Urgente] ${notif.title}: ${notif.description}`);
    }
    // 2. PRIORIDAD MEDIA / ESTÁNDAR
    else {
      soundService.playSoftChime();
      toast.info(`[Recordatorio] ${notif.title}: ${notif.description}`);
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
