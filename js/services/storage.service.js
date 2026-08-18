/**
 * FocusFlow Web - Services: Storage Service
 * Manejador Offline-First de LocalStorage con tipado de datos y semillas dinámicas para la fecha actual.
 */

import { getTodayISO } from '../utils/date.utils.js';

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
    const today = getTodayISO();
    return [
      {
        id: 'task-1',
        title: 'Finalizar Propuesta de Proyecto',
        priorities: ['high'],
        time: '05:00 PM',
        date: today,
        category: 'Trabajo',
        completed: true,
        alarm: true
      },
      {
        id: 'task-2',
        title: 'Llamada con Cliente de Onboarding',
        priorities: ['medium'],
        time: '12:00 PM',
        date: today,
        category: 'Trabajo',
        completed: false,
        alarm: false
      },
      {
        id: 'task-3',
        title: 'Revisión de Sprint y Arquitectura',
        priorities: ['medium'],
        time: '02:00 PM',
        date: today,
        category: 'General',
        completed: true,
        alarm: false
      },
      {
        id: 'task-4',
        title: 'Revisión de Documentación API',
        priorities: ['medium'],
        time: '04:00 PM',
        date: today,
        category: 'Trabajo',
        completed: false,
        alarm: true
      },
      {
        id: 'task-5',
        title: 'Lectura Técnica y Preparación',
        priorities: ['low'],
        time: '07:00 PM',
        date: today,
        category: 'Estudio',
        completed: false,
        alarm: false
      }
    ];
  }
}
