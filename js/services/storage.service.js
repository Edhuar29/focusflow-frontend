/**
 * FocusFlow Web - Services: Storage Service
 * Manejador Offline-First de LocalStorage con tipado de datos y aislamiento por usuario.
 */

const STORAGE_PREFIX = 'focusflow_';

export class StorageService {
  static get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`Error al leer ${key} de localStorage:`, e);
      return defaultValue;
    }
  }

  static set(key, value) {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Error al guardar ${key} en localStorage:`, e);
      return false;
    }
  }

  static remove(key) {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  }

  static clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }

  static getInitialTasks() {
    return [];
  }
}
