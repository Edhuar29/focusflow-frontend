/**
 * FocusFlow Web - Services: Web Notifications Service
 */

class NotificationService {
  constructor() {
    this.hasPermission = false;
    this.checkPermission();
  }

  checkPermission() {
    if ('Notification' in window) {
      this.hasPermission = Notification.permission === 'granted';
    }
  }

  async requestPermission() {
    if (!('Notification' in window)) return false;
    try {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    } catch (e) {
      console.warn('Error solicitando permisos de notificación:', e);
      return false;
    }
  }

  send(title, options = {}) {
    if (this.hasPermission && 'Notification' in window) {
      return new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
    return null;
  }
}

export const notificationService = new NotificationService();
