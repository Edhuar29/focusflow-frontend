/**
 * FocusFlow Web - Core: Reactive Global Store
 * Manejo centralizado del estado, persistencia, sinergia de módulos y notificaciones únicas.
 */

import { eventBus } from './event-bus.js';
import { StorageService } from '../services/storage.service.js';
import { getTodayISO } from '../utils/date.utils.js';

class Store {
  constructor() {
    const today = getTodayISO();

    this.state = {
      theme: StorageService.get('theme', 'dark'),
      accent: StorageService.get('accent', 'cobalt'),
      selectedDate: StorageService.get('selectedDate', today),
      weekOffset: 0,
      viewMode: StorageService.get('viewMode', 'grid'), // 'grid' | 'list'
      activeFilter: 'all',
      searchQuery: '',
      activeFocusTask: StorageService.get('activeFocusTask', null),
      tasks: StorageService.get('tasks', null),
      notifications: StorageService.get('notifications', []),
      pomodoro: StorageService.get('pomodoro', {
        mode: 'focus',
        duration: 25 * 60,
        cyclesCompletedToday: 4,
        totalFocusMinutes: 100
      }),
      hydration: StorageService.get('hydration', {
        currentMl: 0,
        goalMl: 2000,
        logsToday: 0
      }),
      settings: StorageService.get('settings', {
        soundEnabled: true,
        notificationsEnabled: true
      })
    };

    // Asegurar que existan tareas asignadas a la fecha de hoy
    if (!this.state.tasks || this.state.tasks.length === 0) {
      this.state.tasks = StorageService.getInitialTasks();
      StorageService.set('tasks', this.state.tasks);
    } else {
      // Si las tareas existentes pertenecían a fechas antiguas de prueba, sincronizar a la fecha de hoy
      const hasTodayTasks = this.state.tasks.some(t => t.date === today);
      if (!hasTodayTasks) {
        this.state.tasks = this.state.tasks.map((t, idx) => {
          if (idx < 5) return { ...t, date: today };
          return t;
        });
        StorageService.set('tasks', this.state.tasks);
      }
    }
  }

  /* Getters */
  getState() {
    return this.state;
  }

  getTasks() {
    return [...this.state.tasks];
  }

  getActiveFocusTask() {
    return this.state.activeFocusTask;
  }

  getNotifications() {
    return [...(this.state.notifications || [])];
  }

  getFilteredTasks() {
    const filtered = this.state.tasks.filter(task => {
      if (this.state.searchQuery.trim()) {
        const q = this.state.searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesCat = (task.category || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesCat) return false;
      }

      if (this.state.activeFilter === 'high') {
        return task.priorities.includes('high');
      }
      if (this.state.activeFilter === 'medium') {
        return task.priorities.includes('medium');
      }
      if (this.state.activeFilter === 'low') {
        return task.priorities.includes('low');
      }
      if (this.state.activeFilter === 'due-today') {
        return task.date === this.state.selectedDate;
      }
      if (this.state.activeFilter === 'completed') {
        return task.completed;
      }

      return true;
    });

    // Ordenamiento inteligente: Tareas pendientes primero, tareas completadas al final
    const pending = filtered.filter(t => !t.completed);
    const completed = filtered.filter(t => t.completed);

    return [...pending, ...completed];
  }

  getFilterCounts() {
    const all = this.state.tasks.length;
    const high = this.state.tasks.filter(t => t.priorities.includes('high')).length;
    const medium = this.state.tasks.filter(t => t.priorities.includes('medium')).length;
    const low = this.state.tasks.filter(t => t.priorities.includes('low')).length;
    const dueToday = this.state.tasks.filter(t => t.date === this.state.selectedDate).length;

    return { all, high, medium, low, dueToday };
  }

  getTaskStatsForDate(dateStr) {
    const forDay = this.state.tasks.filter(t => t.date === dateStr);
    const completed = forDay.filter(t => t.completed).length;
    const total = forDay.length;
    return {
      total,
      completed,
      pending: total - completed
    };
  }

  getDailyProgress() {
    const forDay = this.state.tasks.filter(t => t.date === this.state.selectedDate);
    const completed = forDay.filter(t => t.completed).length;
    const total = forDay.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }

  /* Acciones de Tareas */
  addTask(taskData) {
    const newTask = {
      id: `task-${Date.now()}`,
      title: taskData.title.trim(),
      priorities: taskData.priorities || ['medium'],
      time: taskData.time || '12:00 PM',
      date: taskData.date || this.state.selectedDate,
      category: taskData.category || 'General',
      completed: false,
      alarm: !!taskData.alarm
    };

    // Insertar al inicio para máxima visibilidad inmediata
    this.state.tasks.unshift(newTask);
    this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
    eventBus.emit('tasks:created', newTask);
    return newTask;
  }

  editTask(taskId, updatedData) {
    const idx = this.state.tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      this.state.tasks[idx] = { ...this.state.tasks[idx], ...updatedData };
      this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
    }
  }

  postponeTask(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      const parts = task.date.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + 1);
      const nextY = d.getFullYear();
      const nextM = String(d.getMonth() + 1).padStart(2, '0');
      const nextD = String(d.getDate()).padStart(2, '0');
      task.date = `${nextY}-${nextM}-${nextD}`;
      this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
    }
  }

  toggleTaskCompletion(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
      eventBus.emit('tasks:toggled', task);
    }
  }

  deleteTask(taskId) {
    this.state.tasks = this.state.tasks.filter(t => t.id !== taskId);
    this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
    eventBus.emit('tasks:deleted', taskId);
  }

  /* Notificaciones Globales con Deduplicación Inteligente */
  addNotification(notif) {
    const id = notif.id || `notif-${Date.now()}`;
    const newNotif = {
      id,
      title: notif.title,
      description: notif.description,
      priority: notif.priority || 'medium',
      type: notif.type || 'task',
      time: notif.time || 'Ahora',
      taskId: notif.taskId || null,
      createdAt: Date.now()
    };

    if (!this.state.notifications) this.state.notifications = [];
    
    const existingIndex = this.state.notifications.findIndex(n => n.id === id || (n.type === 'hydration' && notif.type === 'hydration'));
    if (existingIndex !== -1) {
      this.state.notifications[existingIndex] = newNotif;
    } else {
      this.state.notifications.unshift(newNotif);
    }

    this._persistAndNotify('notifications', this.state.notifications, 'notifications:updated');
    return newNotif;
  }

  removeNotification(id) {
    if (!this.state.notifications) this.state.notifications = [];
    this.state.notifications = this.state.notifications.filter(n => n.id !== id);
    this._persistAndNotify('notifications', this.state.notifications, 'notifications:updated');
  }

  clearNotifications() {
    this.state.notifications = [];
    this._persistAndNotify('notifications', [], 'notifications:updated');
  }

  /* Sinergia Pomodoro */
  startFocusOnTask(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      this.state.activeFocusTask = task;
      this._persistAndNotify('activeFocusTask', task, 'focus:started');
      window.location.hash = '#/pomodoro';
    }
  }

  clearActiveFocusTask() {
    this.state.activeFocusTask = null;
    this._persistAndNotify('activeFocusTask', null, 'focus:cleared');
  }

  clearFocusTask() {
    this.clearActiveFocusTask();
  }

  /* Vistas y Filtros */
  setViewMode(mode) {
    this.state.viewMode = mode;
    StorageService.set('viewMode', mode);
    eventBus.emit('viewMode:changed', mode);
  }

  setWeekOffset(offset) {
    this.state.weekOffset = offset;
    eventBus.emit('weekOffset:changed', offset);
  }

  setFilter(filterName) {
    this.state.activeFilter = this.state.activeFilter === filterName ? 'all' : filterName;
    eventBus.emit('filter:changed', this.state.activeFilter);
  }

  setSearchQuery(query) {
    this.state.searchQuery = query;
    eventBus.emit('search:changed', query);
  }

  setSelectedDate(dateStr) {
    this.state.selectedDate = dateStr;
    StorageService.set('selectedDate', dateStr);
    eventBus.emit('date:selected', dateStr);
  }

  setAccent(accentName) {
    this.state.accent = accentName;
    StorageService.set('accent', accentName);
    document.documentElement.setAttribute('data-accent', accentName);
    eventBus.emit('theme:accentChanged', accentName);
  }

  _persistAndNotify(key, value, eventName) {
    StorageService.set(key, value);
    if (eventName) {
      eventBus.emit(eventName, value);
    }
  }
}

export const store = new Store();
