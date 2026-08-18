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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      this.isBackendAvailable = true;
      return await response.json();
    } catch (err) {
      // Backend no disponible (modo offline silencioso sin romper la UI)
      this.isBackendAvailable = false;
      return null;
    }
  }

  /* --- Autenticación Demo / Usuario --- */
  async ensureDemoAuth() {
    if (this.token) return this.token;

    const res = await this._request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'demo@focusflow.app',
        password: 'Password123!',
      }),
    });

    if (res && res.data && res.data.token) {
      this.setToken(res.data.token);
      return res.data.token;
    }
    return null;
  }

  /* --- Tareas --- */
  async getTasks() {
    await this.ensureDemoAuth();
    const res = await this._request('/tasks');
    return res ? res.data : null;
  }

  async createTask(taskData) {
    await this.ensureDemoAuth();
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
  }

  async updateTask(id, updates) {
    await this.ensureDemoAuth();
    const res = await this._request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res ? res.data : null;
  }

  async deleteTask(id) {
    await this.ensureDemoAuth();
    const res = await this._request(`/tasks/${id}`, {
      method: 'DELETE',
    });
    return res ? res.data : null;
  }

  /* --- Inteligencia Artificial (Gemini API) --- */
  async sendChatMessage(message) {
    await this.ensureDemoAuth();
    const res = await this._request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return res ? res.data : null;
  }

  /* --- Hidratación --- */
  async logWater(amountMl, date) {
    await this.ensureDemoAuth();
    const res = await this._request('/water/logs', {
      method: 'POST',
      body: JSON.stringify({ amount_ml: amountMl, date }),
    });
    return res ? res.data : null;
  }

  /* --- Pomodoro --- */
  async logPomodoroSession(durationMinutes, taskId = null) {
    await this.ensureDemoAuth();
    const res = await this._request('/pomodoro/sessions', {
      method: 'POST',
      body: JSON.stringify({ duration_minutes: durationMinutes, task_id: taskId }),
    });
    return res ? res.data : null;
  }
}

export const apiService = new ApiService();
