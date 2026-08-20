/**
 * FocusFlow Web - Services: Dynamic API Client Service
 * Cliente REST API desacoplado con soporte Offline-First y autenticación JWT.
 */

import { CONFIG } from '../config.js';

class ApiService {
  constructor() {
    this.baseUrl = CONFIG.API_BASE_URL;
    this.token = localStorage.getItem('focusflow_auth_token') || null;
    this.isOnline = navigator.onLine;
    this.isBackendAvailable = null;

    window.addEventListener('online', () => { this.isOnline = true; });
    window.addEventListener('offline', () => { this.isOnline = false; });
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('focusflow_auth_token', token);
    } else {
      localStorage.removeItem('focusflow_auth_token');
    }
  }

  async _request(endpoint, options = {}) {
    if (!this.isOnline) {
      return null;
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        this.token = null;
        localStorage.removeItem('focusflow_auth_token');
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || `Error ${response.status}: ${response.statusText}`);
      }

      this.isBackendAvailable = true;
      return data;
    } catch (err) {
      console.warn(`[ApiService] Request to ${endpoint} failed:`, err.message);
      this.isBackendAvailable = false;
      throw err;
    }
  }

  /* --- Autenticación de Usuario --- */
  async login(email, password) {
    const res = await this._request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res && res.data && res.data.token) {
      this.setToken(res.data.token);
      return res.data;
    }
    return null;
  }

  async register(userData) {
    const res = await this._request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: userData.name,
        email: userData.email,
        password: userData.password,
      }),
    });

    if (res && res.data && res.data.token) {
      this.setToken(res.data.token);
      return res.data;
    }
    return null;
  }

  async googleLogin(payload) {
    const res = await this._request('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res && res.data && res.data.token) {
      this.setToken(res.data.token);
      return res.data;
    }
    return null;
  }

  /* --- Tareas --- */
  async getTasks() {
    try {
      const res = await this._request('/tasks');
      return res ? res.data : null;
    } catch {
      return null;
    }
  }

  async createTask(taskData) {
    try {
      const payload = {
        title: taskData.title,
        description: taskData.description || '',
        date: taskData.date,
        time: taskData.time,
        category: taskData.category || 'General',
        priority: taskData.priorities ? (taskData.priorities[0] === 'high' ? 'Alto' : (taskData.priorities[0] === 'low' ? 'Bajo' : 'Medio')) : 'Medio',
        is_alarm_enabled: !!taskData.alarm,
      };

      const res = await this._request('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res ? res.data : null;
    } catch {
      return null;
    }
  }

  async updateTask(id, updates) {
    try {
      const res = await this._request(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return res ? res.data : null;
    } catch {
      return null;
    }
  }

  async deleteTask(id) {
    try {
      const res = await this._request(`/tasks/${id}`, {
        method: 'DELETE',
      });
      return res ? res.data : null;
    } catch {
      return null;
    }
  }

  /* --- Pomodoro & Hidratación --- */
  async logPomodoroSession(sessionData) {
    try {
      const res = await this._request('/pomodoro/sessions', {
        method: 'POST',
        body: JSON.stringify(sessionData),
      });
      return res ? res.data : null;
    } catch {
      return null;
    }
  }

  async logWater(amountMl) {
    try {
      const res = await this._request('/water/logs', {
        method: 'POST',
        body: JSON.stringify({ amount_ml: amountMl }),
      });
      return res ? res.data : null;
    } catch {
      return null;
    }
  }

  /* --- Gemini AI Assistant --- */
  async askGemini(prompt, history = []) {
    try {
      const res = await this._request('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: prompt, history }),
      });
      return res;
    } catch {
      return null;
    }
  }

  async sendChatMessage(prompt, history = []) {
    return this.askGemini(prompt, history);
  }

  /* --- Recordatorios por Correo --- */
  async sendTaskEmailReminder(email, taskTitle, taskTime, category) {
    return this._request('/reminders/task-email', {
      method: 'POST',
      body: JSON.stringify({ email, task_title: taskTitle, task_time: taskTime, category }),
    });
  }

  async sendHydrationEmailReminder(email) {
    return this._request('/reminders/hydration-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async sendTestEmail(email) {
    return this._request('/reminders/task-email', {
      method: 'POST',
      body: JSON.stringify({
        email,
        task_title: 'Notificación de Prueba EdhuFlow',
        task_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: 'Sistema'
      }),
    });
  }
}

export const apiService = new ApiService();
