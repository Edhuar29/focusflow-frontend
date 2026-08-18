/**
 * FocusFlow Web - Core: Event Bus (Pub/Sub)
 * Facilita la comunicación desacoplada y escalable entre módulos y servicios.
 */

class EventBus {
  constructor() {
    this.events = new Map();
  }

  /**
   * Suscribirse a un evento
   * @param {string} event - Nombre del evento (ej: 'task:created')
   * @param {Function} callback - Función que se ejecutará al emitir
   * @returns {Function} Función para cancelar la suscripción
   */
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Cancelar suscripción a un evento
   * @param {string} event 
   * @param {Function} callback 
   */
  off(event, callback) {
    if (this.events.has(event)) {
      this.events.get(event).delete(callback);
    }
  }

  /**
   * Emitir un evento hacia todos los suscriptores
   * @param {string} event 
   * @param {*} data 
   */
  emit(event, data) {
    if (this.events.has(event)) {
      this.events.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error procesando el evento "${event}":`, error);
        }
      });
    }
  }
}

export const eventBus = new EventBus();
