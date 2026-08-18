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
   * Monta la vista en el contenedor del DOM
   */
  mount() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.error(`Contenedor #${this.containerId} no encontrado.`);
      return;
    }

    this.render();
    this.bindEvents();
    this.isMounted = true;
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
