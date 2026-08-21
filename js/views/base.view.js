/**
 * FocusFlow Web - Views: Base View Class
 * Define el ciclo de vida estándar y extensible para cada módulo SPA.
 */

export class BaseView {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.isMounted = false;
  }

  /**
   * Monta la vista en el contenedor del DOM de forma aislada y segura
   */
  mount() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.error(`Contenedor #${this.containerId} no encontrado.`);
      return;
    }

    try {
      this.render();
    } catch (err) {
      console.error(`[BaseView] Error al renderizar ${this.containerId}:`, err);
      this.renderErrorFallback(err);
      return;
    }

    try {
      this.bindEvents();
    } catch (err) {
      console.error(`[BaseView] Error vinculando eventos en ${this.containerId}:`, err);
    }

    this.isMounted = true;
  }

  /**
   * Interfaz de respaldo aislada en caso de error inesperado en la vista
   */
  renderErrorFallback(error) {
    if (!this.container) return;
    this.container.innerHTML = `
      <div style="padding: 3rem 1.5rem; text-align: center; max-width: 480px; margin: 2rem auto; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(239, 68, 68, 0.12); color: #EF4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">Sección temporalmente no disponible</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          Ocurrió una advertencia al cargar estos datos. Puedes continuar usando todas las demás pestañas sin problemas.
        </p>
        <button class="btn btn-primary" onclick="window.location.reload()" style="font-size: 0.8rem; padding: 6px 14px;">
          Reintentar Carga
        </button>
      </div>
    `;
  }

  /**
   * Renderiza el contenido de la vista
   */
  render() {
    // Sobrescribir en clases hijas
  }

  /**
   * Conecta los event listeners locales
   */
  bindEvents() {
    // Sobrescribir en clases hijas
  }

  /**
   * Desmonta la vista y limpia listeners si es necesario
   */
  unmount() {
    this.isMounted = false;
  }
}
