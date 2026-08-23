/**
 * FocusFlow Web - Core: Reactive Global Store
 * Manejo centralizado del estado, aislamiento por usuario (Fresh Zero-State),
 * sinergia de módulos y preferencias de notificaciones por correo.
 */

import { eventBus } from './event-bus.js';
import { StorageService } from '../services/storage.service.js';
import { apiService } from '../services/api.service.js';
import { getTodayISO } from '../utils/date.utils.js';

/**
 * DTO / Normalizador defensivo para objetos de Tarea
 */
export function normalizeTask(task) {
  if (!task || typeof task !== 'object') {
    return {
      id: `task_${Date.now()}`,
      title: 'Nueva Tarea',
      description: '',
      category: 'General',
      priorities: ['medium'],
      priority: 'Medio',
      date: getTodayISO(),
      time: '12:00 PM',
      alarm: false,
      emailAlert: false,
      completed: false
    };
  }

  const priorities = Array.isArray(task.priorities) && task.priorities.length > 0
    ? task.priorities
    : [task.priority === 'Alto' ? 'high' : (task.priority === 'Bajo' ? 'low' : (task.priority || 'medium'))];

  const priorityLabel = task.priority || (priorities[0] === 'high' ? 'Alto' : (priorities[0] === 'low' ? 'Bajo' : 'Medio'));
  const rawDate = typeof task.date === 'string' ? task.date.trim().split('T')[0] : getTodayISO();

  return {
    ...task,
    id: task.id || `task_${Date.now()}`,
    title: task.title || 'Sin Título',
    description: task.description || '',
    category: task.category || 'General',
    priorities,
    priority: priorityLabel,
    date: rawDate,
    time: task.time || '12:00 PM',
    alarm: task.alarm !== undefined ? !!task.alarm : true,
    emailAlert: task.emailAlert !== undefined ? !!task.emailAlert : true,
    completed: !!task.completed
  };
}

/**
 * DTO / Normalizador defensivo para el estado de Hidratación
 */
export function normalizeHydration(hydration, defaultEmail = 'edhuflow.official@gmail.com') {
  const h = hydration || {};
  const reminder = h.reminder || {};

  return {
    currentMl: typeof h.currentMl === 'number' && !isNaN(h.currentMl) ? Math.max(0, h.currentMl) : 0,
    goalMl: typeof h.goalMl === 'number' && h.goalMl > 0 ? h.goalMl : 2000,
    logsToday: typeof h.logsToday === 'number' ? h.logsToday : 0,
    reminder: {
      enabled: reminder.enabled !== undefined ? !!reminder.enabled : true,
      startTime: reminder.startTime || '08:00',
      endTime: reminder.endTime || '22:00',
      intervalHours: typeof reminder.intervalHours === 'number' && reminder.intervalHours > 0 ? reminder.intervalHours : 1,
      emailNotification: reminder.emailNotification !== undefined ? !!reminder.emailNotification : true,
      useCustomEmail: !!reminder.useCustomEmail,
      email: reminder.email || defaultEmail
    }
  };
}

class Store {
  constructor() {
    const today = getTodayISO();
    const currentUser = StorageService.get('user', null);
    const defaultEmail = (currentUser && currentUser.email) || 'edhuflow.official@gmail.com';

    const rawTasks = currentUser && currentUser.id 
      ? StorageService.get(`user_${currentUser.id}_tasks`, [])
      : StorageService.get('tasks', []);

    const rawHydration = currentUser && currentUser.id
      ? StorageService.get(`user_${currentUser.id}_hydration`, null)
      : StorageService.get('hydration', null);

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
      tasks: Array.isArray(rawTasks) ? rawTasks.map(normalizeTask) : [],
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
      hydration: normalizeHydration(rawHydration, defaultEmail),
      settings: StorageService.get('settings', {
        soundEnabled: true,
        notificationsEnabled: true
      }),
      emailPreferences: currentUser && currentUser.id
        ? StorageService.get(`user_${currentUser.id}_email_pref`, {
            notificationEmail: defaultEmail,
            emailTaskAlerts: true,
            emailWaterAlerts: true,
            useCustomEmail: false
          })
        : StorageService.get('email_preferences', {
            notificationEmail: 'edhuflow.official@gmail.com',
            emailTaskAlerts: true,
            emailWaterAlerts: true,
            useCustomEmail: false
          })
    };
  }

  /* Getters */
  getState() {
    return this.state;
  }

  getTasks() {
    const raw = this.state.tasks || [];
    return raw.map(normalizeTask);
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
    const selectedDate = (this.state.selectedDate || getTodayISO()).trim().split('T')[0];
    const todayISO = getTodayISO();

    const filtered = this.state.tasks.filter(task => {
      const taskDate = (task.date || '').trim().split('T')[0];

      if (this.state.searchQuery && this.state.searchQuery.trim()) {
        const q = this.state.searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesCat = (task.category || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesCat) return false;
        return true;
      }

      if (this.state.activeFilter === 'high') {
        return task.priorities && task.priorities.includes('high') && (taskDate === selectedDate || (!taskDate && selectedDate === todayISO));
      }
      if (this.state.activeFilter === 'medium') {
        return task.priorities && task.priorities.includes('medium') && (taskDate === selectedDate || (!taskDate && selectedDate === todayISO));
      }
      if (this.state.activeFilter === 'low') {
        return task.priorities && task.priorities.includes('low') && (taskDate === selectedDate || (!taskDate && selectedDate === todayISO));
      }
      if (this.state.activeFilter === 'due-today') {
        return taskDate === todayISO || (!taskDate && selectedDate === todayISO);
      }
      if (this.state.activeFilter === 'completed') {
        return task.completed && (taskDate === selectedDate || (!taskDate && selectedDate === todayISO));
      }
      if (this.state.activeFilter === 'all-days') {
        return true;
      }

      // Por defecto: mostrar estrictamente las tareas del día seleccionado
      if (!taskDate) return selectedDate === todayISO;
      return taskDate === selectedDate;
    });

    const pending = filtered.filter(t => !t.completed);
    const completed = filtered.filter(t => t.completed);

    return [...pending, ...completed];
  }

  getFilterCounts() {
    const selectedDate = (this.state.selectedDate || getTodayISO()).trim().split('T')[0];
    const todayISO = getTodayISO();
    const dayTasks = this.state.tasks.filter(t => {
      const tDate = (t.date || '').trim().split('T')[0];
      return tDate === selectedDate || (!tDate && selectedDate === todayISO);
    });

    const all = dayTasks.length;
    const high = dayTasks.filter(t => t.priorities && t.priorities.includes('high')).length;
    const medium = dayTasks.filter(t => t.priorities && t.priorities.includes('medium')).length;
    const low = dayTasks.filter(t => t.priorities && t.priorities.includes('low')).length;
    const dueToday = this.state.tasks.filter(t => {
      const tDate = (t.date || '').trim().split('T')[0];
      return tDate === todayISO || (!tDate);
    }).length;

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

    // Sincronización automática con la base de datos en la nube (Supabase PostgreSQL)
    if (this.isAuthenticated()) {
      apiService.createTask(newTask).then((res) => {
        if (res && res.id && res.id !== newTask.id) {
          newTask.backendId = res.id;
          this._persistAndNotify('tasks', this.state.tasks);
        }
      }).catch(() => {});
    }

    return newTask;
  }

  updateTask(taskId, updates) {
    const index = this.state.tasks.findIndex(t => t.id === taskId || t.backendId === taskId);
    if (index !== -1) {
      const currentTask = this.state.tasks[index];
      this.state.tasks[index] = { ...currentTask, ...updates };
      this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');

      if (updates.alarm) {
        eventBus.emit('alarm:registered', this.state.tasks[index]);
      }

      if (this.isAuthenticated()) {
        const backendTargetId = currentTask.backendId || currentTask.id;
        apiService.updateTask(backendTargetId, {
          title: this.state.tasks[index].title,
          description: this.state.tasks[index].description,
          date: this.state.tasks[index].date,
          time: this.state.tasks[index].time,
          category: this.state.tasks[index].category,
          priority: this.state.tasks[index].priorities ? (this.state.tasks[index].priorities[0] === 'high' ? 'Alto' : 'Medio') : 'Medio',
          is_alarm_enabled: !!this.state.tasks[index].alarm,
          is_completed: !!this.state.tasks[index].completed,
        }).catch(() => {});
      }
    }
  }

  editTask(taskId, updates) {
    return this.updateTask(taskId, updates);
  }

  postponeTask(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId || t.backendId === taskId);
    if (task) {
      const baseDate = task.date || getTodayISO();
      const d = new Date(baseDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      task.date = d.toISOString().split('T')[0];
      this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
      
      if (this.isAuthenticated()) {
        const backendTargetId = task.backendId || task.id;
        apiService.updateTask(backendTargetId, { date: task.date }).catch(() => {});
      }
    }
  }

  deleteTask(taskId) {
    const taskToDelete = this.state.tasks.find(t => t.id === taskId || t.backendId === taskId);
    this.state.tasks = this.state.tasks.filter(t => t.id !== taskId && t.backendId !== taskId);
    if (this.state.activeFocusTask && (this.state.activeFocusTask.id === taskId || this.state.activeFocusTask.backendId === taskId)) {
      this.clearActiveFocusTask();
    }
    this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
    eventBus.emit('alarm:cancelled', taskId);

    if (this.isAuthenticated() && taskToDelete) {
      const backendTargetId = taskToDelete.backendId || taskToDelete.id;
      apiService.deleteTask(backendTargetId).catch(() => {});
    }
  }

  toggleTaskCompletion(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId || t.backendId === taskId);
    if (task) {
      task.completed = !task.completed;
      this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
      eventBus.emit('task:toggled', task);

      if (this.isAuthenticated()) {
        const backendTargetId = task.backendId || task.id;
        apiService.updateTask(backendTargetId, { is_completed: task.completed }).catch(() => {});
      }
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
      const defaultEmail = user.email || 'edhuflow.official@gmail.com';
      // Carga aislada para el usuario (los nuevos usuarios inician en cero absoluto)
      const savedAvatar = StorageService.get(`user_${user.id}_avatar`, null);
      if (savedAvatar) {
        this.state.user.avatarUrl = savedAvatar;
      }
      const rawTasks = StorageService.get(`user_${user.id}_tasks`, []);
      this.state.tasks = Array.isArray(rawTasks) ? rawTasks.map(normalizeTask) : [];
      this.state.pomodoro = StorageService.get(`user_${user.id}_pomodoro`, {
        mode: 'focus',
        duration: 25 * 60,
        cyclesCompletedToday: 0,
        totalFocusMinutes: 0
      });
      const rawHydration = StorageService.get(`user_${user.id}_hydration`, null);
      this.state.hydration = normalizeHydration(rawHydration, defaultEmail);
      this.state.emailPreferences = StorageService.get(`user_${user.id}_email_pref`, {
        notificationEmail: defaultEmail,
        emailTaskAlerts: true,
        emailWaterAlerts: true,
        useCustomEmail: false
      });
    }

    eventBus.emit('user:changed', user);
    eventBus.emit('user:avatarChanged', this.getUserAvatar());
    eventBus.emit('tasks:updated', this.state.tasks);
    eventBus.emit('hydration:updated', this.state.hydration);
    eventBus.emit('pomodoro:updated', this.state.pomodoro);
    eventBus.emit('emailPreferences:updated', this.state.emailPreferences);

    // Cargar y sincronizar tareas guardadas en la base de datos en la nube (PostgreSQL)
    this.syncTasksFromCloud().catch(() => {});
  }

  async syncTasksFromCloud() {
    if (!this.isAuthenticated()) return;
    try {
      const remoteTasks = await apiService.getTasks();
      if (Array.isArray(remoteTasks)) {
        const mapped = remoteTasks.map((t) => normalizeTask({
          id: t.id,
          backendId: t.id,
          title: t.title,
          description: t.description || '',
          category: t.category || 'General',
          priorities: [t.priority === 'Alto' ? 'high' : (t.priority === 'Bajo' ? 'low' : 'medium')],
          date: t.date,
          time: t.time,
          alarm: t.is_alarm_enabled,
          emailAlert: t.is_alarm_enabled,
          completed: t.is_completed,
          createdAt: t.created_at
        }));

        if (mapped.length > 0) {
          this.state.tasks = mapped;
          this._persistAndNotify('tasks', this.state.tasks, 'tasks:updated');
        } else if (this.state.tasks.length > 0) {
          for (const localTask of this.state.tasks) {
            apiService.createTask(localTask).catch(() => {});
          }
        }
      }
    } catch {}
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
    const user = this.state?.user || StorageService.get('user', null);
    const savedProfile = StorageService.get('focusflow_saved_profile', null);
    const hasUser = (!!user && !!user.email && user.email !== 'invitado@focusflow.app') ||
                    (!!savedProfile && !!savedProfile.email && savedProfile.email !== 'invitado@focusflow.app');
    const hasToken = !!localStorage.getItem('focusflow_auth_token') || !!this.state?.token;
    return hasUser || hasToken;
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
