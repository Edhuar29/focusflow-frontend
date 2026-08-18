/**
 * FocusFlow Web - Components: Accessible Modal Controller
 * Control de modales accesible con prevención de fugas de eventos globales.
 */

import { $, $$ } from '../utils/dom.utils.js';

export class ModalComponent {
  constructor(modalId) {
    this.modal = $(`#${modalId}`);
    this._keydownHandler = null;
    this._backdropClickHandler = null;
    
    if (this.modal) {
      this._bindStaticEvents();
    }
  }

  _bindStaticEvents() {
    // Cerrar al hacer clic en botones de cierre
    const closeButtons = $$('[data-close-modal]', this.modal);
    closeButtons.forEach(btn => {
      btn.onclick = () => this.close();
    });

    // Cerrar al hacer clic en el fondo oscuro
    this.modal.onclick = (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    };
  }

  open() {
    if (!this.modal) return;
    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');

    // Registrar manejador de Escape solo cuando está abierto
    if (!this._keydownHandler) {
      this._keydownHandler = (e) => {
        if (e.key === 'Escape' && this.isOpen()) {
          this.close();
        }
      };
      document.addEventListener('keydown', this._keydownHandler);
    }

    const firstInput = this.modal.querySelector('input:not([type="hidden"]), button, select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('open');
    this.modal.setAttribute('aria-hidden', 'true');

    // Remover escuchador global de teclado al cerrar
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
  }

  isOpen() {
    return this.modal && this.modal.classList.contains('open');
  }
}
