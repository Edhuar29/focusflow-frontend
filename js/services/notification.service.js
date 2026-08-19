import { StorageService } from './storage.service.js';

class NotificationService {
  constructor() {
    this.hasPermission = false;
    this.checkPermission();
  }

  checkPermission() {
    if ('Notification' in window) {
      this.hasPermission = Notification.permission === 'granted';
    }
    return this.hasPermission;
  }

  isDesktopEnabled() {
    return this.hasPermission && StorageService.get('edhuflow_desktop_notifs_enabled', true) !== false;
  }

  getPermissionStatus() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  async requestPermission() {
    if (!('Notification' in window)) return false;
    try {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    } catch (e) {
      console.warn('[NotificationService] Error solicitando permisos de notificación:', e);
      return false;
    }
  }

  send(title, options = {}) {
    if (StorageService.get('edhuflow_desktop_notifs_enabled', true) === false) {
      return null;
    }

    this.checkPermission();
    if (this.hasPermission && 'Notification' in window) {
      try {
        const iconUrl = new URL('./assets/images/logo.png', window.location.href).href;
        const badgeUrl = new URL('./assets/images/favicon.png', window.location.href).href;
        const notif = new Notification(title, {
          icon: iconUrl,
          badge: badgeUrl,
          ...options
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };

        return notif;
      } catch (e) {
        console.warn('[NotificationService] Error al disparar notificación de escritorio:', e);
      }
    }
    return null;
  }

  async sendTestDesktopNotification() {
    const granted = await this.requestPermission();
    if (!granted) {
      return { success: false, reason: 'permission_denied' };
    }

    const notif = this.send('EdhuFlow — Notificación de Escritorio', {
      body: '¡Excelente! Las notificaciones en tu computadora están activas y funcionando correctamente.',
      tag: 'edhuflow-test-alert',
      requireInteraction: false
    });

    return { success: !!notif };
  }
}

export const notificationService = new NotificationService();
