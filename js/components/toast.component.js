/**
 * FocusFlow Web - Components: Smart Single Toast Notification
 * Muestra una única notificación interactiva sin emojis ni apilamiento.
 */

import { $, createElement } from '../utils/dom.utils.js';

class ToastComponent {
  constructor() {
    this.container = null;
    this.currentToast = null;
    this.timeoutId = null;
  }

  _ensureContainer() {
    if (!this.container) {
      this.container = $('.toast-container');
      if (!this.container) {
        this.container = createElement('div', { className: 'toast-container' });
        document.body.appendChild(this.container);
      }
    }
  }

  show(message, type = 'info', duration = 3000) {
    this._ensureContainer();

    // Si ya existe un toast visible, actualizamos su contenido y reiniciamos el temporizador suavemente
    if (this.currentToast && this.container.contains(this.currentToast)) {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }

      this.currentToast.className = `toast toast-${type} toast-updating`;
      this.currentToast.innerHTML = `
        <div class="toast-icon">${this._getIconSVG(type)}</div>
        <div class="toast-message">${message}</div>
      `;

      setTimeout(() => {
        if (this.currentToast) this.currentToast.classList.remove('toast-updating');
      }, 150);

      this.timeoutId = setTimeout(() => {
        this._dismissCurrent();
      }, duration);

      return;
    }

    // Crear nuevo toast único
    this.currentToast = createElement('div', {
      className: `toast toast-${type}`,
      innerHTML: `
        <div class="toast-icon">${this._getIconSVG(type)}</div>
        <div class="toast-message">${message}</div>
      `
    });

    this.container.innerHTML = '';
    this.container.appendChild(this.currentToast);

    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this._dismissCurrent();
    }, duration);
  }

  _dismissCurrent() {
    if (this.currentToast) {
      this.currentToast.classList.add('toast-hiding');
      setTimeout(() => {
        if (this.currentToast) {
          this.currentToast.remove();
          this.currentToast = null;
        }
      }, 250);
    }
  }

  _getIconSVG(type) {
    if (type === 'success') {
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    }
    if (type === 'warning') {
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }
    if (type === 'danger') {
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    }
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  success(message) {
    this.show(message, 'success');
  }

  info(message) {
    this.show(message, 'info');
  }

  warning(message) {
    this.show(message, 'warning');
  }

  error(message) {
    this.show(message, 'danger');
  }
}

export const toast = new ToastComponent();
