import { StorageService } from './storage.service.js';

class NotificationService {
  constructor() {
    this.hasPermission = false;
    this.checkPermission();
    this.initServiceWorker();
  }

  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.info('[NotificationService] Modo estándar sin Service Worker:', err?.message);
        });
      } catch (e) {}
    }
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

    // Vibración física en dispositivos móviles
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {}
    }

    this.checkPermission();
    if (this.hasPermission && 'Notification' in window) {
      try {
        const notifOptions = {
          body: options.body || '',
          tag: options.tag || `edhuflow-${Date.now()}`,
          vibrate: [200, 100, 200],
          requireInteraction: options.requireInteraction || false,
        };

        // Icono seguro
        try {
          notifOptions.icon = new URL('./assets/images/logo.png', window.location.href).href;
          notifOptions.badge = notifOptions.icon;
        } catch (e) {}

        // 1. En móviles (Android Chrome) usar ServiceWorkerRegistration.showNotification()
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            if (reg && typeof reg.showNotification === 'function') {
              return reg.showNotification(title, notifOptions);
            }
            return new Notification(title, notifOptions);
          }).catch(() => {
            try {
              return new Notification(title, notifOptions);
            } catch (err) {}
          });
          return true;
        }

        // 2. En computadoras de escritorio usar Notification constructor directo
        const notif = new Notification(title, notifOptions);

        notif.onclick = () => {
          window.focus();
          notif.close();
        };

        return notif;
      } catch (e) {
        // Fallback defensivo
        try {
          return new Notification(title, { body: options.body || '' });
        } catch (err2) {
          console.warn('[NotificationService] Notificación del sistema no soportada en este entorno:', err2?.message);
        }
      }
    }
    return null;
  }

  async sendTestDesktopNotification() {
    const granted = await this.requestPermission();
    if (!granted) {
      return { success: false, reason: 'permission_denied' };
    }

    const notif = this.send('EdhuFlow — Notificación del Sistema', {
      body: 'Las notificaciones en tu dispositivo están activas y funcionando correctamente.',
      tag: 'edhuflow-test-alert',
      requireInteraction: false
    });

    return { success: !!notif };
  }
}

export const notificationService = new NotificationService();
