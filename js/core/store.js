/**
 * FocusFlow Web - Core: Reactive Global Store
 * Manejo centralizado del estado, aislamiento por usuario (Fresh Zero-State),
 * sinergia de módulos y preferencias de notificaciones por correo.
 */

import { eventBus } from './event-bus.js';
import { StorageService } from '../services/storage.service.js';
import { getTodayISO } from '../utils/date.utils.js';

class Store {
  constructor() {
    const today = getTodayISO();
    const currentUser = StorageService.get('user', null);

    this.state = {
      theme: StorageService.get('theme', 'dark'),
      accent: StorageService.get('accent', 'cobalt'),
      selectedDate: StorageService.get('selectedDate', today),
      weekOffset: 0,
      viewMode: StorageService.get('viewMode', 'grid'), // 'grid' | 'list'
      activeFilter: 'all',
      searchQuery: '',
      activeFocusTask: null,
      notifications: StorageService.get('notifications', []),
      user: currentUser,
      tasks: currentUser && currentUser.id 
        ? StorageService.get(`user_${currentUser.id}_tasks`, [])
        : StorageService.get('tasks', []),
      pomodoro: currentUser && currentUser.id
        ? StorageService.get(`user_${currentUser.id}_pomodoro`, {
            mode: 'focus',
            duration: 25 * 60,
            cyclesCompletedToday: 0,
            totalFocusMinutes: 0
          })
        : StorageService.get('pomodoro', {
            mode: 'focus',
            duration: 25 * 60,
            cyclesCompletedToday: 0,
            totalFocusMinutes: 0
          }),
      hydration: currentUser && currentUser.id
        ? StorageService.get(`user_${currentUser.id}_hydration`, {
            currentMl: 0,
            goalMl: 2000,
            logsToday: 0
          })
        : StorageService.get('hydration', {
            currentMl: 0,
            goalMl: 2000,
            logsToday: 0
          }),
      settings: StorageService.get('settings', {
        soundEnabled: true,
        notificationsEnabled: true
      }),
      emailPreferences: currentUser && currentUser.id
        ? StorageService.get(`user_${currentUser.id}_email_pref`, {
            notificationEmail: currentUser.email || '',
            emailTaskAlerts: true,
            emailWaterAlerts: true
          })
        : StorageService.get('email_preferences', {
            notificationEmail: '',
            emailTaskAlerts: true,
            emailWaterAlerts: true
          })
    };
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

  getEmailPreferences() {
    return { ...this.state.emailPreferences };
  }

  setEmailPreferences(prefs) {
    this.state.emailPreferences = { ...this.state.emailPreferences, ...prefs };
    this._persistAndNotify('email_pref', this.state.emailPreferences, 'emailPreferences:updated');
  }

  getFilteredTasks() {
    const selectedDate = this.state.selectedDate || getTodayISO();

    const filtered = this.state.tasks.filter(task => {
      if (this.state.searchQuery && this.state.searchQuery.trim()) {
        const q = this.state.searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesCat = (task.category || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesCat) return false;
        return true;
      }

      if (this.state.activeFilter === 'high') {
        return task.priorities && task.priorities.includes('high') && task.date === selectedDate;
      }
      if (this.state.activeFilter === 'medium') {
        return task.priorities && task.priorities.includes('medium') && task.date === selectedDate;
      }
      if (this.state.activeFilter === 'low') {
        return task.priorities && task.priorities.includes('low') && task.date === selectedDate;
      }
      if (this.state.activeFilter === 'due-today') {
        return task.date === getTodayISO();
      }
      if (this.state.activeFilter === 'completed') {
        return task.completed && task.date === selectedDate;
      }
      if (this.state.activeFilter === 'all-days') {
        return true;
      }

      // Por defecto: mostrar estrictamente las tareas del día seleccionado
      return task.date === selectedDate;
    });

    const pending = filtered.filter(t => !t.completed);
    const completed = filtered.filter(t => t.completed);

    return [...pending, ...completed];
  }

  getFilterCounts() {
    const selectedDate = this.state.selectedDate || getTodayISO();
    const dayTasks = this.state.tasks.filter(t => t.date === selectedDate);
    const all = dayTasks.length;
    const high = dayTasks.filter(t => t.priorities && t.priorities.includes('high')).length;
    const medium = dayTasks.filter(t => t.priorities && t.priorities.includes('medium')).length;
    const low = dayTasks.filter(t => t.priorities && t.priorities.includes('low')).length;
    const dueToday = this.state.tasks.filter(t => t.date === getTodayISO()).length;

    return { all, high, medium, low, dueToday, totalAllDays: this.state.tasks.length };
  }

  getTaskStatsForDate(dateStr) {
    const tasks = this.state.tasks.filter(t => t.date === dateStr);
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.length - completed;
    return { completed, pending, total: tasks.length };
  }

  getDailyProgress() {
    const today = getTodayISO();
    const todayTasks = this.state.tasks.filter(t => t.date === today);
    const total = todayTasks.length;
    const completed = todayTasks.filter(t => t.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }

  /* Mutaciones de Tareas */
  addTask(taskData) {
    const newTask = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title: taskData.title || 'Nueva Tarea',
      description: taskData.description || '',
      category: taskData.category || 'General',
      priorities: taskData.priorities || ['medium'],
      date: taskData.date || this.state.selectedDate,
      time: taskData.time || '12:00 PM',
      alarm: !!taskData.alarm,
      emailAlert: !!taskData.emailAlert,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.state.tasks.unshift(newTask);
    this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');

    if (newTask.alarm) {
      eventBus.emit('alarm:registered', newTask);
    }

    return newTask;
  }

  updateTask(taskId, updates) {
    const index = this.state.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.state.tasks[index] = { ...this.state.tasks[index], ...updates };
      this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');

      if (updates.alarm) {
        eventBus.emit('alarm:registered', this.state.tasks[index]);
      }
    }
  }

  editTask(taskId, updates) {
    return this.updateTask(taskId, updates);
  }

  postponeTask(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      const baseDate = task.date || getTodayISO();
      const d = new Date(baseDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      task.date = d.toISOString().split('T')[0];
      this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
    }
  }

  deleteTask(taskId) {
    this.state.tasks = this.state.tasks.filter(t => t.id !== taskId);
    if (this.state.activeFocusTask && this.state.activeFocusTask.id === taskId) {
      this.clearActiveFocusTask();
    }
    this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
    eventBus.emit('alarm:cancelled', taskId);
  }

  toggleTaskCompletion(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
      eventBus.emit('task:toggled', task);
    }
  }

  /* Notificaciones en Campana */
  addNotification(notif) {
    const newNotif = {
      id: notif.id || 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: notif.title || 'Notificación',
      description: notif.description || '',
      type: notif.type || 'reminder',
      priority: notif.priority || 'medium',
      taskId: notif.taskId || null,
      timestamp: new Date().toISOString(),
      read: false
    };

    const existingIdx = this.state.notifications.findIndex(n => n.taskId && n.taskId === newNotif.taskId);
    if (existingIdx !== -1) {
      this.state.notifications[existingIdx] = newNotif;
    } else {
      this.state.notifications.unshift(newNotif);
    }

    if (this.state.notifications.length > 20) {
      this.state.notifications = this.state.notifications.slice(0, 20);
    }

    this._persistAndNotify('notifications', this.state.notifications, 'notifications:updated');
  }

  removeNotification(notifId) {
    this.state.notifications = this.state.notifications.filter(n => n.id !== notifId);
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

  /* Gestión de Autenticación y Aislamiento de Usuario */
  getUser() {
    return this.state.user;
  }

  getUserAvatar() {
    const user = this.state.user;
    if (!user) return null;
    return user.avatarUrl || StorageService.get(`user_${user.id}_avatar`, null);
  }

  setUserAvatar(avatarUrl) {
    if (!this.state.user) return;
    this.state.user.avatarUrl = avatarUrl;
    StorageService.set('user', this.state.user);
    if (this.state.user.id) {
      StorageService.set(`user_${this.state.user.id}_avatar`, avatarUrl);
    }
    eventBus.emit('user:avatarChanged', avatarUrl);
  }

  setUser(user) {
    this.state.user = user;
    StorageService.set('user', user);

    if (user && user.id) {
      // Carga aislada para el usuario (los nuevos usuarios inician en cero absoluto)
      const savedAvatar = StorageService.get(`user_${user.id}_avatar`, null);
      if (savedAvatar) {
        this.state.user.avatarUrl = savedAvatar;
      }
      this.state.tasks = StorageService.get(`user_${user.id}_tasks`, []);
      this.state.pomodoro = StorageService.get(`user_${user.id}_pomodoro`, {
        mode: 'focus',
        duration: 25 * 60,
        cyclesCompletedToday: 0,
        totalFocusMinutes: 0
      });
      this.state.hydration = StorageService.get(`user_${user.id}_hydration`, {
        currentMl: 0,
        goalMl: 2000,
        logsToday: 0
      });
      this.state.emailPreferences = StorageService.get(`user_${user.id}_email_pref`, {
        notificationEmail: user.email || '',
        emailTaskAlerts: true,
        emailWaterAlerts: true
      });
    }

    eventBus.emit('user:changed', user);
    eventBus.emit('user:avatarChanged', this.getUserAvatar());
    eventBus.emit('tasks:updated', this.state.tasks);
    eventBus.emit('hydration:updated', this.state.hydration);
    eventBus.emit('pomodoro:updated', this.state.pomodoro);
    eventBus.emit('emailPreferences:updated', this.state.emailPreferences);
  }

  logout() {
    this.state.user = null;
    this.state.tasks = [];
    this.state.pomodoro = { mode: 'focus', duration: 25 * 60, cyclesCompletedToday: 0, totalFocusMinutes: 0 };
    this.state.hydration = { currentMl: 0, goalMl: 2000, logsToday: 0 };
    StorageService.remove('user');
    localStorage.removeItem('focusflow_auth_token');
    document.documentElement.classList.remove('authenticated-boot');
    document.documentElement.classList.add('unauthenticated-boot');
    eventBus.emit('user:loggedOut');
    eventBus.emit('tasks:updated', this.state.tasks);
    eventBus.emit('hydration:updated', this.state.hydration);
    eventBus.emit('pomodoro:updated', this.state.pomodoro);
    eventBus.emit('auth:open');
  }

  isAuthenticated() {
    return !!this.state.user && !!localStorage.getItem('focusflow_auth_token');
  }

  _persistAndNotify(key, value, eventName) {
    const user = this.state.user;
    if (user && user.id) {
      StorageService.set(`user_${user.id}_${key}`, value);
    }
    StorageService.set(key, value);
    if (eventName) {
      eventBus.emit(eventName, value);
    }
  }
}

export const store = new Store();
