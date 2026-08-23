/**
 * FocusFlow Web - Views: AI Assistant View Controller
 * Conectado con la API de Google Gemini (Gratuita $0) y soporte para dictado por voz.
 */

import { BaseView } from './base.view.js';
import { soundService } from '../services/sound.service.js';
import { speechService } from '../services/speech.service.js';
import { toast } from '../components/toast.component.js';
import { store } from '../core/store.js';
import { apiService } from '../services/api.service.js';
import { getTodayISO, timeTo24, timeTo12, formatCleanTime } from '../utils/date.utils.js';
import { $, escapeHTML } from '../utils/dom.utils.js';

export class AssistantView extends BaseView {
  constructor() {
    super('assistant-view');
    this.messages = this._loadHistory();
    this.isListening = false;
    this.isThinking = false;
    this.recognition = null;
  }

  _getStorageKey() {
    const user = store.getUser();
    return user && user.id ? `edhuflow_ai_chat_${user.id}` : 'edhuflow_ai_chat_guest';
  }

  _loadHistory() {
    try {
      const saved = localStorage.getItem(this._getStorageKey());
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    const user = store.getUser();
    const userName = (user && user.name) ? user.name.split(' ')[0] : 'Usuario';
    return [
      {
        sender: 'assistant',
        text: `¡Hola, ${userName}! Soy tu Asistente EdhuFlow impulsado por IA. Puedes dictarme o escribirme tareas en lenguaje natural (ej: "Estudiar física mañana a las 4pm con prioridad alta" o "Recordatorio en 5 minutos con el nombre de prueba 1") o pedirme recomendaciones para organizar tu jornada.`
      }
    ];
  }

  _saveHistory() {
    try {
      localStorage.setItem(this._getStorageKey(), JSON.stringify(this.messages));
    } catch {
      // Fallback
    }
  }

  _clearHistory() {
    const user = store.getUser();
    const userName = (user && user.name) ? user.name.split(' ')[0] : 'Usuario';
    this.messages = [
      {
        sender: 'assistant',
        text: `¡Hola, ${userName}! Conversación reiniciada. ¿En qué puedo ayudarte hoy?`
      }
    ];
    this._saveHistory();
    soundService.playClick();
    toast.info('Conversación del asistente reiniciada.');
    this.render();
    this.bindEvents();
  }

  _sanitizeInput(input) {
    if (!input) return '';
    let clean = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<[^>]+>/g, '');
    clean = clean.replace(/javascript:/gi, '');
    clean = clean.replace(/on\w+=/gi, '');
    return clean.trim();
  }

  _getDateFromDayName(dayName) {
    const d = new Date();
    const currentDay = d.getDay();
    const map = {
      'domingo': 0, 'dom': 0,
      'lunes': 1, 'lun': 1,
      'martes': 2, 'mar': 2,
      'miércoles': 3, 'miercoles': 3, 'mié': 3, 'mie': 3,
      'jueves': 4, 'jue': 4,
      'viernes': 5, 'vie': 5,
      'sábado': 6, 'sabado': 6, 'sáb': 6, 'sab': 6
    };
    const targetDay = map[(dayName || '').toLowerCase().trim()];
    if (targetDay !== undefined) {
      let diff = targetDay - currentDay;
      if (diff < 0) diff += 7;
      d.setDate(d.getDate() + diff);
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  _formatMessageContent(text, isAssistant) {
    if (!text) return '';
    if (!isAssistant) {
      return `<p style="margin: 0; line-height: 1.55; white-space: pre-wrap;">${escapeHTML(text)}</p>`;
    }

    // Comprobar si el texto contiene una propuesta estructurada con viñetas (• Día ...)
    if (text.includes('•') || (text.includes('(') && (text.includes('AM') || text.includes('PM')))) {
      const lines = text.split('\n');
      const introLines = [];
      const bulletItems = [];
      const questionLines = [];
      let state = 'intro';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
          state = 'bullets';
          bulletItems.push(trimmed.replace(/^[•\-*]\s*/, ''));
        } else if (state === 'bullets' || trimmed.includes('¿') || trimmed.includes('Te parece') || trimmed.includes('agregarlas')) {
          state = 'question';
          questionLines.push(trimmed);
        } else {
          introLines.push(trimmed);
        }
      }

      if (bulletItems.length > 0) {
        const parsedItems = bulletItems.map(item => {
          const match = item.match(/^([A-Za-záéíóúÁÉÍÓÚñÑ]+)\s*(?:\(([^)]+)\))?\s*(?:—|-|:)\s*(.+?)(?:\s*\[Prioridad\s*(\w+)\])?$/i);
          if (match) {
            return {
              day: match[1] || 'Día',
              time: match[2] || '',
              title: match[3] || item,
              priority: match[4] || 'Medio'
            };
          }
          return {
            day: 'Actividad',
            time: '',
            title: item,
            priority: 'Medio'
          };
        });

        const introHTML = introLines.length > 0 
          ? `<div class="proposal-intro-box">${introLines.map(l => `<p style="margin: 0 0 6px 0;">${escapeHTML(l)}</p>`).join('')}</div>` 
          : '';

        const cardsHTML = `
          <div class="proposal-grid-container">
            ${parsedItems.map(it => {
              const defaultDate = this._getDateFromDayName(it.day);
              const defaultTime24 = timeTo24(it.time || '09:00 AM');
              return `
              <div class="proposal-card-item" data-day="${escapeHTML(it.day)}" data-time="${escapeHTML(it.time || '09:00 AM')}" data-title="${escapeHTML(it.title)}" data-priority="${escapeHTML(it.priority)}">
                <div class="proposal-card-view-mode">
                  <div class="proposal-card-top">
                    <span class="proposal-day-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      ${escapeHTML(it.day)}${it.time ? ` · ${escapeHTML(it.time)}` : ''}
                    </span>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="badge badge-priority-${it.priority.toLowerCase()}">${escapeHTML(it.priority)}</span>
                      <button type="button" class="btn-edit-proposal" title="Editar detalles de esta actividad">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>
                  <div class="proposal-card-title">${escapeHTML(it.title)}</div>
                </div>

                <!-- Modo de Edición Completa Inline -->
                <div class="proposal-card-edit-mode" style="display: none;">
                  <div class="edit-prop-field" style="margin-bottom: 8px;">
                    <label class="edit-prop-label">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      <span>Título de la tarea</span>
                    </label>
                    <input type="text" class="edit-prop-input edit-prop-title" value="${escapeHTML(it.title)}" placeholder="Nombre de la actividad" />
                  </div>

                  <div class="edit-prop-grid">
                    <div class="edit-prop-field">
                      <label class="edit-prop-label">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>Fecha</span>
                      </label>
                      <input type="date" class="edit-prop-input edit-prop-date" value="${defaultDate}" min="${getTodayISO()}" />
                    </div>

                    <div class="edit-prop-field">
                      <label class="edit-prop-label">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span>Hora</span>
                      </label>
                      <input type="time" class="edit-prop-input edit-prop-time" value="${defaultTime24}" />
                    </div>

                    <div class="edit-prop-field">
                      <label class="edit-prop-label">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg>
                        <span>Categoría</span>
                      </label>
                      <select class="edit-prop-input edit-prop-category" style="cursor: pointer;">
                        <option value="General" selected>General</option>
                        <option value="Estudio">Estudio</option>
                        <option value="Trabajo">Trabajo</option>
                        <option value="Salud">Salud</option>
                        <option value="Personal">Personal</option>
                      </select>
                    </div>

                    <div class="edit-prop-field">
                      <label class="edit-prop-label">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <span>Prioridad</span>
                      </label>
                      <select class="edit-prop-input edit-prop-priority" style="cursor: pointer;">
                        <option value="Alto" ${it.priority.toLowerCase() === 'alto' ? 'selected' : ''}>Alta</option>
                        <option value="Medio" ${it.priority.toLowerCase() === 'medio' ? 'selected' : ''}>Media</option>
                        <option value="Bajo" ${it.priority.toLowerCase() === 'bajo' ? 'selected' : ''}>Baja</option>
                      </select>
                    </div>
                  </div>

                  <div class="edit-prop-toggles">
                    <label class="edit-prop-checkbox-label">
                      <input type="checkbox" class="edit-prop-alarm" checked />
                      <span>🔔 Alarma sonora</span>
                    </label>
                    <label class="edit-prop-checkbox-label">
                      <input type="checkbox" class="edit-prop-email" checked />
                      <span>✉️ Correo electrónico</span>
                    </label>
                  </div>

                  <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" class="btn btn-secondary btn-cancel-edit-prop" style="font-size: 11px; padding: 5px 12px; border-radius: 8px;">Cancelar</button>
                    <button type="button" class="btn btn-primary btn-save-edit-prop" style="font-size: 11px; padding: 5px 14px; font-weight: 600; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>Guardar en Tareas</span>
                    </button>
                  </div>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        `;

        const questionText = questionLines.join(' ');
        const questionHTML = questionText 
          ? `<div class="proposal-question-box"><p style="margin: 0;">${escapeHTML(questionText)}</p></div>` 
          : '';

        const quickActionsHTML = `
          <div class="proposal-quick-actions">
            <button type="button" class="btn btn-primary btn-confirm-and-schedule-all" style="font-size: 11.5px; padding: 6px 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Sí, agendar estas tareas</span>
            </button>
            <button type="button" class="btn btn-secondary btn-toggle-all-edits" style="font-size: 11.5px; padding: 6px 12px; border-radius: 999px;">
              <span>✏️ Ajustar horario</span>
            </button>
          </div>
        `;

        return `${introHTML}${cardsHTML}${questionHTML}${quickActionsHTML}`;
      }
    }

    // Comprobar si es una Matriz de Eisenhower
    if (text.includes('🔴') && text.includes('🟡')) {
      const qRegex = /(🔴|🟡|🔵|⚪)\s*\*\*([^*]+)\*\*:?([\s\S]*?)(?=(?:🔴|🟡|🔵|⚪)|$)/g;
      let match;
      const quadrants = [];
      while ((match = qRegex.exec(text)) !== null) {
        quadrants.push({
          icon: match[1],
          title: match[2].trim(),
          content: match[3].trim()
        });
      }

      if (quadrants.length >= 2) {
        const qCards = quadrants.map(q => {
          let qClass = 'q1';
          if (q.icon === '🟡') qClass = 'q2';
          if (q.icon === '🔵') qClass = 'q3';
          if (q.icon === '⚪') qClass = 'q4';

          const items = q.content.split('\n')
            .map(l => l.trim().replace(/^[•\-*]\s*/, ''))
            .filter(Boolean);

          return `
            <div class="eisenhower-quadrant ${qClass}">
              <div class="quadrant-title">${q.icon} <span>${escapeHTML(q.title)}</span></div>
              <ul class="quadrant-tasks-list">
                ${items.map(item => `<li>• ${escapeHTML(item)}</li>`).join('')}
              </ul>
            </div>
          `;
        }).join('');

        return `
          <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 6px;">🧠 Matriz de Priorización de Eisenhower</div>
          <div class="eisenhower-container">${qCards}</div>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin-top: 8px;">¿Deseas que agende las tareas del cuadrante Urgente e Importante primero?</p>
        `;
      }
    }

    const paragraphs = text.split(/\n\n+/);
    return paragraphs.map(p => {
      let formatted = escapeHTML(p);
      // Negrita **texto**
      formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Cursiva *texto*
      formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
      return `<p style="margin: 0 0 8px 0; line-height: 1.55; white-space: pre-wrap;">${formatted}</p>`;
    }).join('');
  }

  render() {
    if (!this.container) return;

    const user = store.getUser();
    const userName = (user && user.name) ? user.name.split(' ')[0] : 'Usuario';
    if (this.messages.length > 0 && this.messages[0].sender === 'assistant' && this.messages[0].text.startsWith('¡Hola,')) {
      this.messages[0].text = `¡Hola, ${userName}! Soy tu Asistente EdhuFlow impulsado por IA. Puedes dictarme o escribirme tareas en lenguaje natural (ej: "Estudiar física mañana a las 4pm con prioridad alta" o "Recordatorio en 5 minutos con el nombre de prueba 1") o pedirme recomendaciones para organizar tu jornada.`
    }

    this.container.innerHTML = `
      <div class="assistant-container">
        
        <!-- Header con Identidad EdhuFlow y Limpiar Chat -->
        <div class="assistant-header-bar" style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--border-subtle);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 28px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);">
              <img src="./assets/images/logo.png" alt="EdhuFlow" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <div>
              <span style="font-weight: var(--fw-bold); font-size: var(--text-sm); color: var(--text-primary);">Asistente EdhuFlow</span>
              <span style="display: block; font-size: 11px; color: var(--text-secondary);">Encuentra tu ritmo, domina tu enfoque</span>
            </div>
          </div>
          <button type="button" class="btn btn-secondary" id="btn-clear-ai-chat" style="font-size: 11px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px;" title="Limpiar conversación">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Limpiar Chat</span>
          </button>
        </div>

        <!-- Chat History -->
        <div class="chat-history" id="chat-history">
          ${this.messages.map((m, idx) => `
            <div class="chat-message ${m.sender}">
              <div class="chat-bubble">
                ${m.sender === 'assistant' ? `
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                    <span style="font-size: 11px; font-weight: 600; color: #A78BFA; display: inline-flex; align-items: center; gap: 4px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                      <span>Asistente EdhuFlow</span>
                    </span>
                    <button type="button" class="btn-tts-speak" data-msg-idx="${idx}" title="Escuchar respuesta por voz">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                      <span>Escuchar</span>
                    </button>
                  </div>
                ` : ''}

                ${this._formatMessageContent(m.text, m.sender === 'assistant')}
                
                ${idx === 0 && this.messages.length <= 1 ? `
                  <div class="prompt-starters-container">
                    <div class="prompt-starters-title">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                      <span>Sugerencias de Inicio Rápido</span>
                    </div>
                    <div class="prompt-starters-grid">
                      <button type="button" class="prompt-starter-chip" data-quick-text="planificar mi semana con 5 actividades">
                        <span class="prompt-starter-icon">📅</span>
                        <span>Organizar semana (5 tareas)</span>
                      </button>
                      <button type="button" class="prompt-starter-chip" data-quick-text="¿qué tareas tengo para hoy?">
                        <span class="prompt-starter-icon">📋</span>
                        <span>¿Qué tareas tengo para hoy?</span>
                      </button>
                      <button type="button" class="prompt-starter-chip" data-quick-text="¿cuánta agua he tomado hoy?">
                        <span class="prompt-starter-icon">💧</span>
                        <span>¿Cómo va mi meta de agua?</span>
                      </button>
                      <button type="button" class="prompt-starter-chip" data-quick-text="iniciar un pomodoro de 25 minutos">
                        <span class="prompt-starter-icon">⏱️</span>
                        <span>Iniciar enfoque (25 min)</span>
                      </button>
                      <button type="button" class="prompt-starter-chip" data-quick-text="priorizar mis pendientes con la matriz de eisenhower">
                        <span class="prompt-starter-icon">🧠</span>
                        <span>Matriz de Eisenhower</span>
                      </button>
                    </div>
                  </div>
                ` : ''}
                
                ${m.detectedTasks && m.detectedTasks.length > 0 ? `
                  <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                    ${m.detectedTasks.length > 1 ? `
                      <div style="margin-bottom: 4px;">
                        <button class="btn btn-primary btn-approve-all-tasks" data-msg-idx="${idx}" style="font-size: 12px; font-weight: 600; padding: 8px 14px; width: 100%; border-radius: 8px;">
                          <span>✓ Aprobar y Agregar las ${m.detectedTasks.length} Tareas a la Agenda</span>
                        </button>
                      </div>
                    ` : ''}
                    ${m.detectedTasks.map((t, tIdx) => {
                      const tDate = t.date || getTodayISO();
                      const tTime24 = timeTo24(t.time || '12:00 PM');
                      const tCategory = t.category || 'General';
                      const tPriority = t.priority || 'Medio';
                      return `
                      <div class="detected-task-card" style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-medium);" data-msg-idx="${idx}" data-task-idx="${tIdx}">
                        <div class="detected-task-view-mode">
                          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
                            <div style="font-weight: var(--fw-bold); font-size: var(--text-sm); color: var(--text-primary);">
                              ${escapeHTML(t.title)}
                            </div>
                            <button type="button" class="btn-edit-detected-task" title="Editar tarea antes de agendar" style="background: none; border: 1px solid var(--border-subtle); color: var(--text-secondary); border-radius: 6px; padding: 2px 7px; font-size: 10.5px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; flex-shrink: 0;">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                              <span>Editar</span>
                            </button>
                          </div>
                          <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="display: inline-flex; align-items: center; gap: 3px;">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                              ${escapeHTML(t.time || '12:00 PM')}
                            </span>
                            <span>•</span>
                            <span style="display: inline-flex; align-items: center; gap: 3px;">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                              ${escapeHTML(tDate)}
                            </span>
                            <span>•</span>
                            <span class="badge badge-priority-${tPriority.toLowerCase()}">${escapeHTML(tPriority)}</span>
                            <span>•</span>
                            <span style="color: #38BDF8;">📁 ${escapeHTML(tCategory)}</span>
                          </div>
                          <button class="btn btn-primary btn-approve-task" data-msg-idx="${idx}" data-task-idx="${tIdx}" style="font-size: 11px; padding: 6px 12px; width: 100%; border-radius: 8px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 4px;">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>Aprobar y Agregar a la Agenda</span>
                          </button>
                        </div>

                        <!-- Modo de Edición Completa para Detected Task -->
                        <div class="detected-task-edit-mode" style="display: none;">
                          <div class="edit-prop-field" style="margin-bottom: 8px;">
                            <label class="edit-prop-label">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              <span>Título de la tarea</span>
                            </label>
                            <input type="text" class="edit-prop-input edit-det-title" value="${escapeHTML(t.title)}" placeholder="Nombre de la actividad" />
                          </div>

                          <div class="edit-prop-grid">
                            <div class="edit-prop-field">
                              <label class="edit-prop-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                <span>Fecha</span>
                              </label>
                              <input type="date" class="edit-prop-input edit-det-date" value="${tDate}" min="${getTodayISO()}" />
                            </div>

                            <div class="edit-prop-field">
                              <label class="edit-prop-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                <span>Hora</span>
                              </label>
                              <input type="time" class="edit-prop-input edit-det-time" value="${tTime24}" />
                            </div>

                            <div class="edit-prop-field">
                              <label class="edit-prop-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg>
                                <span>Categoría</span>
                              </label>
                              <select class="edit-prop-input edit-det-category" style="cursor: pointer;">
                                <option value="General" ${tCategory === 'General' ? 'selected' : ''}>General</option>
                                <option value="Estudio" ${tCategory === 'Estudio' ? 'selected' : ''}>Estudio</option>
                                <option value="Trabajo" ${tCategory === 'Trabajo' ? 'selected' : ''}>Trabajo</option>
                                <option value="Salud" ${tCategory === 'Salud' ? 'selected' : ''}>Salud</option>
                                <option value="Personal" ${tCategory === 'Personal' ? 'selected' : ''}>Personal</option>
                              </select>
                            </div>

                            <div class="edit-prop-field">
                              <label class="edit-prop-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                <span>Prioridad</span>
                              </label>
                              <select class="edit-prop-input edit-det-priority" style="cursor: pointer;">
                                <option value="Alto" ${tPriority.toLowerCase() === 'alto' || tPriority.toLowerCase() === 'high' ? 'selected' : ''}>Alta</option>
                                <option value="Medio" ${tPriority.toLowerCase() === 'medio' || tPriority.toLowerCase() === 'medium' || !tPriority ? 'selected' : ''}>Media</option>
                                <option value="Bajo" ${tPriority.toLowerCase() === 'bajo' || tPriority.toLowerCase() === 'low' ? 'selected' : ''}>Baja</option>
                              </select>
                            </div>
                          </div>

                          <div class="edit-prop-toggles">
                            <label class="edit-prop-checkbox-label">
                              <input type="checkbox" class="edit-det-alarm" checked />
                              <span>🔔 Alarma sonora</span>
                            </label>
                            <label class="edit-prop-checkbox-label">
                              <input type="checkbox" class="edit-det-email" checked />
                              <span>✉️ Correo electrónico</span>
                            </label>
                          </div>

                          <div style="display: flex; justify-content: flex-end; gap: 8px;">
                            <button type="button" class="btn btn-secondary btn-cancel-edit-det" style="font-size: 11px; padding: 5px 12px; border-radius: 8px;">Cancelar</button>
                            <button type="button" class="btn btn-primary btn-save-edit-det" style="font-size: 11px; padding: 5px 14px; font-weight: 600; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px;">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              <span>Guardar en Tareas</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    `;
                    }).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}

          ${this.isThinking ? `
            <div class="chat-message assistant">
              <div class="chat-bubble" style="display: flex; align-items: center; gap: 6px; padding: 10px 14px;">
                <span class="alarm-pulse-dot" style="width: 8px; height: 8px; background: var(--accent-primary);"></span>
                <span style="font-size: var(--text-xs); color: var(--text-secondary);">EdhuFlow IA está procesando tu solicitud...</span>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Input Area -->
        <div class="chat-input-area">
          <button class="topbar-btn mic-btn ${this.isListening ? 'listening' : ''}" id="btn-mic" title="Dictado por voz" aria-label="Toggle voice input">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </button>

          <input 
            type="text" 
            class="form-control" 
            id="chat-input" 
            placeholder="Escribe o dicta: 'Examen de cálculo el viernes a las 3pm'..." 
            autocomplete="off" 
            maxlength="500"
          />

          <button class="btn btn-primary" id="btn-send-chat">
            <span>Enviar</span>
          </button>
        </div>

      </div>
    `;

    this._scrollToBottom();
  }

  bindEvents() {
    if (!this.container) return;

    const input = $('#chat-input', this.container);
    const sendBtn = $('#btn-send-chat', this.container);
    const micBtn = $('#btn-mic', this.container);
    const clearBtn = $('#btn-clear-ai-chat', this.container);

    if (clearBtn) {
      clearBtn.onclick = () => this._clearHistory();
    }

    const handleSend = () => {
      const sanitized = this._sanitizeInput(input.value);
      if (!sanitized || this.isThinking) return;
      input.value = '';
      this._sendMessage(sanitized);
    };

    if (sendBtn) sendBtn.onclick = handleSend;
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') handleSend();
      };
    }

    if (micBtn) {
      micBtn.onclick = () => {
        this._toggleSpeechRecognition();
      };
    }

    // Delegación de aprobación de tareas creadas por IA
    const history = $('#chat-history', this.container);
    if (history) {
      history.onclick = (e) => {
        // 0.0 Escuchar respuesta por voz (Text-to-Speech)
        const ttsBtn = e.target.closest('.btn-tts-speak');
        if (ttsBtn) {
          const msgIdx = parseInt(ttsBtn.getAttribute('data-msg-idx'), 10);
          const msg = this.messages[msgIdx];
          if (msg && msg.text) {
            speechService.toggleSpeech(msg.text, ttsBtn);
          }
          return;
        }

        // 0.01 Clic en Sugerencias de Inicio Rápido (Prompt Starters)
        const chip = e.target.closest('.prompt-starter-chip');
        if (chip) {
          const quickText = chip.getAttribute('data-quick-text');
          if (quickText && !this.isThinking) {
            this._sendMessage(quickText, false);
          }
          return;
        }

        // 0. Confirmar y agendar directamente todas las tareas de la propuesta
        const confirmAllBtn = e.target.closest('.btn-confirm-and-schedule-all');
        if (confirmAllBtn) {
          const bubble = confirmAllBtn.closest('.chat-bubble');
          if (bubble) {
            const cards = bubble.querySelectorAll('.proposal-card-item');
            if (cards.length > 0) {
              cards.forEach(card => {
                const dayName = card.getAttribute('data-day') || 'Lunes';
                const taskTitle = card.getAttribute('data-title') || 'Actividad';
                const taskTime = card.getAttribute('data-time') || '09:00 AM';
                const taskPriority = card.getAttribute('data-priority') || 'Medio';
                const targetDate = this._getDateFromDayName(dayName);

                let priorityCode = 'medium';
                if (/alto|alta|high/i.test(taskPriority)) priorityCode = 'high';
                if (/bajo|baja|low/i.test(taskPriority)) priorityCode = 'low';

                store.addTask({
                  title: taskTitle,
                  priorities: [priorityCode],
                  time: taskTime,
                  date: targetDate,
                  category: 'General',
                  alarm: true,
                  emailAlert: true
                });

                card.innerHTML = `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
                    <div>
                      <span style="font-weight: 600; font-size: 12px; color: var(--text-primary); opacity: 0.9;">${escapeHTML(taskTitle)}</span>
                      <div style="font-size: 11px; color: var(--text-muted);">${escapeHTML(dayName)} (${escapeHTML(targetDate)}) · ${escapeHTML(taskTime)}</div>
                    </div>
                    <span style="font-size: 11px; font-weight: 600; color: #10B981; background: rgba(16, 185, 129, 0.15); padding: 3px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>Agendada</span>
                    </span>
                  </div>
                `;
              });

              soundService.playTaskComplete();
              toast.success(`✓ Se agregaron las ${cards.length} tareas a tu agenda con éxito`);

              const actionsBox = confirmAllBtn.closest('.proposal-quick-actions');
              if (actionsBox) {
                actionsBox.innerHTML = `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); width: 100%;">
                    <div style="display: flex; align-items: center; gap: 8px; color: #10B981; font-weight: 600; font-size: 12px;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>¡Todas las tareas fueron agendadas con éxito en tu pestaña de Tareas!</span>
                    </div>
                    <a href="#/tasks" style="color: #38BDF8; font-size: 12px; font-weight: 600; text-decoration: underline; cursor: pointer;">Ver Tareas →</a>
                  </div>
                `;
              }
            }
          }
          return;
        }

        // 0.1 Alternar modo de edición para todas las tarjetas de la propuesta
        const toggleAllEditsBtn = e.target.closest('.btn-toggle-all-edits');
        if (toggleAllEditsBtn) {
          const bubble = toggleAllEditsBtn.closest('.chat-bubble');
          if (bubble) {
            const cards = bubble.querySelectorAll('.proposal-card-item');
            cards.forEach(card => {
              const viewMode = card.querySelector('.proposal-card-view-mode');
              const editMode = card.querySelector('.proposal-card-edit-mode');
              if (viewMode && editMode) {
                viewMode.style.display = 'none';
                editMode.style.display = 'block';
              }
            });
            toast.info('Modifica las fechas u horas que desees y pulsa "Guardar en Tareas"');
          }
          return;
        }

        const quickReplyBtn = e.target.closest('.btn-quick-reply');
        if (quickReplyBtn) {
          const quickText = quickReplyBtn.getAttribute('data-quick-text');
          if (quickText && !this.isThinking) {
            this._sendMessage(quickText);
          }
          return;
        }

        const approveAllBtn = e.target.closest('.btn-approve-all-tasks');
        if (approveAllBtn) {
          const msgIdx = parseInt(approveAllBtn.getAttribute('data-msg-idx'), 10);
          const tasks = this.messages[msgIdx]?.detectedTasks;
          if (Array.isArray(tasks) && tasks.length > 0) {
            tasks.forEach(taskData => {
              let priorityVal = 'medium';
              if (taskData.priority && /alto|alta|high/i.test(taskData.priority)) priorityVal = 'high';
              if (taskData.priority && /bajo|baja|low/i.test(taskData.priority)) priorityVal = 'low';

              store.addTask({
                title: taskData.title,
                priorities: [priorityVal],
                time: taskData.time || '12:00 PM',
                date: taskData.date || getTodayISO(),
                category: taskData.category || 'General',
                alarm: true,
                emailAlert: true
              });
            });

            soundService.playTaskComplete();
            toast.success(`Se agregaron ${tasks.length} tareas a tu agenda con éxito.`);

            approveAllBtn.disabled = true;
            approveAllBtn.innerHTML = `<span>✓ ${tasks.length} Tareas Agregadas a la Agenda</span>`;
            approveAllBtn.style.opacity = '0.6';

            const individualBtns = history.querySelectorAll(`[data-msg-idx="${msgIdx}"].btn-approve-task`);
            individualBtns.forEach(btn => {
              btn.disabled = true;
              btn.innerHTML = `<span>✓ Agregada a la Agenda</span>`;
              btn.style.opacity = '0.6';
            });
          }
          return;
        }

        const approveBtn = e.target.closest('.btn-approve-task');
        if (approveBtn) {
          const msgIdx = parseInt(approveBtn.getAttribute('data-msg-idx'), 10);
          const taskIdx = parseInt(approveBtn.getAttribute('data-task-idx'), 10);

          const taskData = this.messages[msgIdx]?.detectedTasks[taskIdx];
          if (taskData) {
            let priorityVal = 'medium';
            if (taskData.priority && /alto|alta|high/i.test(taskData.priority)) priorityVal = 'high';
            if (taskData.priority && /bajo|baja|low/i.test(taskData.priority)) priorityVal = 'low';

            store.addTask({
              title: taskData.title,
              priorities: [priorityVal],
              time: taskData.time || '12:00 PM',
              date: taskData.date || getTodayISO(),
              category: taskData.category || 'General',
              alarm: true,
              emailAlert: true
            });

            soundService.playTaskComplete();
            toast.success(`Tarea agregada para el ${taskData.date || 'hoy'} a las ${taskData.time || '12:00 PM'}`);
            
            approveBtn.disabled = true;
            approveBtn.innerHTML = `<span>✓ Agregada a la Agenda</span>`;
            approveBtn.style.opacity = '0.6';
          }
          return;
        }

        // 1. Abrir modo de edición en la tarjeta de propuesta
        const editPropBtn = e.target.closest('.btn-edit-proposal');
        if (editPropBtn) {
          const card = editPropBtn.closest('.proposal-card-item');
          if (card) {
            const viewMode = card.querySelector('.proposal-card-view-mode');
            const editMode = card.querySelector('.proposal-card-edit-mode');
            if (viewMode && editMode) {
              viewMode.style.display = 'none';
              editMode.style.display = 'block';
              const titleInput = editMode.querySelector('.edit-prop-title');
              if (titleInput) titleInput.focus();
            }
          }
          return;
        }

        // 2. Cancelar modo de edición de propuesta
        const cancelEditBtn = e.target.closest('.btn-cancel-edit-prop');
        if (cancelEditBtn) {
          const card = cancelEditBtn.closest('.proposal-card-item');
          if (card) {
            const viewMode = card.querySelector('.proposal-card-view-mode');
            const editMode = card.querySelector('.proposal-card-edit-mode');
            if (viewMode && editMode) {
              editMode.style.display = 'none';
              viewMode.style.display = 'block';
            }
          }
          return;
        }

        // 3. Guardar y agendar la tarjeta de propuesta editada
        const saveEditBtn = e.target.closest('.btn-save-edit-prop');
        if (saveEditBtn) {
          const card = saveEditBtn.closest('.proposal-card-item');
          if (card) {
            const titleInput = card.querySelector('.edit-prop-title');
            const dateInput = card.querySelector('.edit-prop-date');
            const timeInput = card.querySelector('.edit-prop-time');
            const categorySelect = card.querySelector('.edit-prop-category');
            const prioritySelect = card.querySelector('.edit-prop-priority');
            const alarmCheck = card.querySelector('.edit-prop-alarm');
            const emailCheck = card.querySelector('.edit-prop-email');

            const dayName = card.getAttribute('data-day') || 'Lunes';
            const targetDate = this._getDateFromDayName(dayName);
            const updatedTitle = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : 'Nueva Tarea';
            const updatedDate = (dateInput && dateInput.value) ? dateInput.value : targetDate;
            const rawTimeVal = (timeInput && timeInput.value) ? timeInput.value : '09:00';
            const updatedTime = timeTo12(rawTimeVal);
            const updatedCategory = categorySelect ? categorySelect.value : 'General';
            const updatedPriority = prioritySelect ? prioritySelect.value : 'Medio';
            const hasAlarm = alarmCheck ? alarmCheck.checked : true;
            const hasEmail = emailCheck ? emailCheck.checked : true;

            let priorityCode = 'medium';
            if (/alto|alta|high/i.test(updatedPriority)) priorityCode = 'high';
            if (/bajo|baja|low/i.test(updatedPriority)) priorityCode = 'low';

            store.addTask({
              title: updatedTitle,
              priorities: [priorityCode],
              time: updatedTime,
              date: updatedDate,
              category: updatedCategory,
              alarm: hasAlarm,
              emailAlert: hasEmail
            });

            soundService.playTaskComplete();
            toast.success(`✓ "${updatedTitle}" guardada para el ${updatedDate} a las ${updatedTime} (visible en Tareas)`);

            card.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0;">
                <div>
                  <div style="font-weight: 600; font-size: 12.5px; color: var(--text-primary); margin-bottom: 2px;">${escapeHTML(updatedTitle)}</div>
                  <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span>📅 ${escapeHTML(updatedDate)}</span>
                    <span>•</span>
                    <span>⏰ ${escapeHTML(updatedTime)}</span>
                    <span>•</span>
                    <span class="badge badge-priority-${priorityCode}">${escapeHTML(updatedPriority)}</span>
                    <span>•</span>
                    <span style="color: #38BDF8;">📁 ${escapeHTML(updatedCategory)}</span>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                  <span style="font-size: 10.5px; font-weight: 600; color: #10B981; background: rgba(16, 185, 129, 0.15); padding: 3px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Guardada en Tareas</span>
                  </span>
                  <a href="#/tasks" style="font-size: 10.5px; color: #38BDF8; text-decoration: underline; cursor: pointer;">Ver en Tareas →</a>
                </div>
              </div>
            `;
          }
          return;
        }

        // 4. Abrir modo de edición en Detected Task Card
        const editDetBtn = e.target.closest('.btn-edit-detected-task');
        if (editDetBtn) {
          const card = editDetBtn.closest('.detected-task-card');
          if (card) {
            const viewMode = card.querySelector('.detected-task-view-mode');
            const editMode = card.querySelector('.detected-task-edit-mode');
            if (viewMode && editMode) {
              viewMode.style.display = 'none';
              editMode.style.display = 'block';
              const titleInput = editMode.querySelector('.edit-det-title');
              if (titleInput) titleInput.focus();
            }
          }
          return;
        }

        // 5. Cancelar modo de edición de Detected Task
        const cancelDetBtn = e.target.closest('.btn-cancel-edit-det');
        if (cancelDetBtn) {
          const card = cancelDetBtn.closest('.detected-task-card');
          if (card) {
            const viewMode = card.querySelector('.detected-task-view-mode');
            const editMode = card.querySelector('.detected-task-edit-mode');
            if (viewMode && editMode) {
              editMode.style.display = 'none';
              viewMode.style.display = 'block';
            }
          }
          return;
        }

        // 6. Guardar y agendar la Detected Task editada
        const saveDetBtn = e.target.closest('.btn-save-edit-det');
        if (saveDetBtn) {
          const card = saveDetBtn.closest('.detected-task-card');
          if (card) {
            const titleInput = card.querySelector('.edit-det-title');
            const dateInput = card.querySelector('.edit-det-date');
            const timeInput = card.querySelector('.edit-det-time');
            const categorySelect = card.querySelector('.edit-det-category');
            const prioritySelect = card.querySelector('.edit-det-priority');
            const alarmCheck = card.querySelector('.edit-det-alarm');
            const emailCheck = card.querySelector('.edit-det-email');

            const updatedTitle = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : 'Nueva Tarea';
            const updatedDate = (dateInput && dateInput.value) ? dateInput.value : getTodayISO();
            const rawTimeVal = (timeInput && timeInput.value) ? timeInput.value : '12:00';
            const updatedTime = timeTo12(rawTimeVal);
            const updatedCategory = categorySelect ? categorySelect.value : 'General';
            const updatedPriority = prioritySelect ? prioritySelect.value : 'Medio';
            const hasAlarm = alarmCheck ? alarmCheck.checked : true;
            const hasEmail = emailCheck ? emailCheck.checked : true;

            let priorityCode = 'medium';
            if (/alto|alta|high/i.test(updatedPriority)) priorityCode = 'high';
            if (/bajo|baja|low/i.test(updatedPriority)) priorityCode = 'low';

            store.addTask({
              title: updatedTitle,
              priorities: [priorityCode],
              time: updatedTime,
              date: updatedDate,
              category: updatedCategory,
              alarm: hasAlarm,
              emailAlert: hasEmail
            });

            soundService.playTaskComplete();
            toast.success(`✓ "${updatedTitle}" guardada para el ${updatedDate} a las ${updatedTime} (visible en Tareas)`);

            card.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0;">
                <div>
                  <div style="font-weight: 600; font-size: 12.5px; color: var(--text-primary); margin-bottom: 2px;">${escapeHTML(updatedTitle)}</div>
                  <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span>📅 ${escapeHTML(updatedDate)}</span>
                    <span>•</span>
                    <span>⏰ ${escapeHTML(updatedTime)}</span>
                    <span>•</span>
                    <span class="badge badge-priority-${priorityCode}">${escapeHTML(updatedPriority)}</span>
                    <span>•</span>
                    <span style="color: #38BDF8;">📁 ${escapeHTML(updatedCategory)}</span>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                  <span style="font-size: 10.5px; font-weight: 600; color: #10B981; background: rgba(16, 185, 129, 0.15); padding: 3px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Guardada en Tareas</span>
                  </span>
                  <a href="#/tasks" style="font-size: 10.5px; color: #38BDF8; text-decoration: underline; cursor: pointer;">Ver en Tareas →</a>
                </div>
              </div>
            `;
          }
          return;
        }
      };
    }
  }

  async _sendMessage(userText, isVoice = false) {
    soundService.playClick();
    this.messages.push({ sender: 'user', text: userText });
    this._saveHistory();
    this.isThinking = true;
    this.render();
    this.bindEvents();

    const lower = userText.toLowerCase().trim();

    // 1. CONSULTA DE ESTADO: Tareas de Hoy
    if (/(?:tareas?|pendientes?|actividades?)\s*(?:de\s+)?(?:hoy|para hoy)|qu[eé]\s+tengo\s+(?:hoy|para hoy|pendiente)|agenda\s+de\s+hoy/i.test(lower)) {
      const todayISO = getTodayISO();
      const todayTasks = (store.state.tasks || []).filter(t => (t.date || '').startsWith(todayISO));
      
      let replyMsg = '';
      if (todayTasks.length === 0) {
        replyMsg = `¡No tienes tareas programadas para hoy (${todayISO})! 🎉\n\nPuedes pedirme: *"Planificar mi semana con 5 actividades"* o *"Estudiar física a las 4:00 PM"* para agendar tu jornada.`;
      } else {
        const completed = todayTasks.filter(t => t.completed).length;
        const pending = todayTasks.length - completed;
        const bullets = todayTasks.map(t => {
          const statusIcon = t.completed ? '✅' : '⏳';
          const p = t.priorities && t.priorities[0] ? t.priorities[0] : 'medium';
          const pLabel = p === 'high' ? 'Alta' : (p === 'low' ? 'Baja' : 'Media');
          return `• ${statusIcon} **${t.time || '12:00 PM'}** — ${t.title} [Prioridad ${pLabel}] ${t.completed ? '*(Completada)*' : ''}`;
        }).join('\n');

        replyMsg = `📋 **Tus Tareas para Hoy (${todayISO}):**\nLlevas **${completed} completadas** y **${pending} pendientes** de un total de ${todayTasks.length}:\n\n${bullets}\n\n¿Deseas iniciar una sesión de enfoque o agregar alguna tarea adicional?`;
      }

      this.isThinking = false;
      soundService.playSoftChime();
      this.messages.push({ sender: 'assistant', text: replyMsg });
      this._saveHistory();
      this.render();
      this.bindEvents();
      if (isVoice) speechService.speak(replyMsg);
      return;
    }

    // 2. CONSULTA DE ESTADO: Progreso de Hidratación
    if (/cu[aá]nta\s+agua|meta\s+de\s+agua|mi\s+hidrataci[oó]n|agua\s+tomad[oa]|registro\s+de\s+agua|c[oó]mo\s+va\s+mi\s+agua/i.test(lower)) {
      const hData = store.getState().hydration || { currentMl: 0, goalMl: 2000 };
      const current = hData.currentMl || 0;
      const goal = hData.goalMl || 2000;
      const percent = Math.min(100, Math.round((current / goal) * 100));
      const remaining = Math.max(0, goal - current);

      const msg = `💧 **Tu Progreso de Hidratación:**\nHas tomado **${current} ml** de tu meta diaria de **${goal} ml** (**${percent}%**).\n${remaining > 0 ? `Te faltan **${remaining} ml** para completar tu meta del día.` : '🎉 ¡Felicidades! Has alcanzado tu meta diaria de agua.'}\n\nPuedes decirme: *"Tomé un vaso de 250ml de agua"* cuando bebas agua para registrarlo al instante.`;
      
      this.isThinking = false;
      soundService.playWaterDrop();
      this.messages.push({ sender: 'assistant', text: msg });
      this._saveHistory();
      this.render();
      this.bindEvents();
      if (isVoice) speechService.speak(msg);
      return;
    }

    // 3. CONSULTA DE ESTADO: Tiempo de Enfoque / Pomodoro
    if (/cu[aá]nto\s+tiempo\s+llevo|cu[aá]ntos\s+pomodoros|tiempo\s+de\s+enfoque|sesiones\s+de\s+estudio|mi\s+productividad\s+de\s+hoy/i.test(lower)) {
      const pomo = store.getState().pomodoro || { cyclesCompletedToday: 0, totalFocusMinutes: 0 };
      const cycles = pomo.cyclesCompletedToday || 0;
      const minutes = pomo.totalFocusMinutes || 0;

      const msg = `⏱️ **Tu Enfoque Hoy:**\nHas completado **${cycles} ciclos Pomodoro** con un total de **${minutes} minutos de trabajo profundo**.\n\n¿Listo para otra sesión? Puedes decirme: *"Iniciar pomodoro de 25 minutos"* para comenzar.`;

      this.isThinking = false;
      soundService.playSoftChime();
      this.messages.push({ sender: 'assistant', text: msg });
      this._saveHistory();
      this.render();
      this.bindEvents();
      if (isVoice) speechService.speak(msg);
      return;
    }

    // 4. ACCIÓN DIRECTA: Iniciar Pomodoro
    const pomoStartMatch = lower.match(/(?:inicia|iniciar|arranca|arrancar|comenzar|pon|ponme)\s+(?:un\s+)?(?:pomodoro|temporizador|sesi[oó]n\s+de\s+enfoque)(?:\s+de\s+(\d+)\s*(?:minutos?|mins?))?/i);
    if (pomoStartMatch) {
      const minutes = parseInt(pomoStartMatch[1], 10) || 25;
      const replyMsg = `🚀 ¡Excelente! Preparando tu sesión Pomodoro de **${minutes} minutos**. Navegando al temporizador...`;
      
      this.isThinking = false;
      soundService.playTaskComplete();
      this.messages.push({ sender: 'assistant', text: replyMsg });
      this._saveHistory();
      this.render();
      this.bindEvents();
      if (isVoice) speechService.speak(replyMsg);

      setTimeout(() => {
        window.location.hash = '#/pomodoro';
      }, 1200);
      return;
    }

    // 5. ACCIÓN DIRECTA: Registrar Agua
    const waterLogMatch = lower.match(/(?:tom[eé]|bebi|beber|tomar|registrar|a[ñn]adir|sumar)\s+(?:un\s+vaso\s+de\s+)?(\d+)?\s*(?:ml|vaso|vasos)?\s*(?:de\s+)?agua/i) ||
                          lower.match(/(?:acabo\s+de\s+tomar|me\s+tom[eé])\s+(?:un\s+vaso|agua)/i);
    if (waterLogMatch) {
      let amount = 250;
      if (waterLogMatch[1] && /\d+/.test(waterLogMatch[1])) {
        amount = parseInt(waterLogMatch[1], 10);
      }
      const updated = store.logWater(amount);
      soundService.playWaterDrop();
      toast.success(`💧 Registrados +${amount}ml de agua`);

      const replyMsg = `💧 ¡Registrado con éxito! Agregué **+${amount}ml** a tu progreso. Vas en total con **${updated.currentMl}ml** de tu meta de **${updated.goalMl}ml** (${Math.min(100, Math.round((updated.currentMl / updated.goalMl) * 100))}%).`;

      this.isThinking = false;
      this.messages.push({ sender: 'assistant', text: replyMsg });
      this._saveHistory();
      this.render();
      this.bindEvents();
      if (isVoice) speechService.speak(replyMsg);
      return;
    }

    // 6. ACCIÓN DIRECTA: Completar Tarea
    const completeTaskMatch = lower.match(/(?:marca|marcar|completar|complet[eé]|termin[eé]|lista)\s+(?:la\s+)?(?:tarea|actividad|pendiente)?\s*(?:de\s+|con\s+)?(.+)/i);
    if (completeTaskMatch && completeTaskMatch[1]) {
      const searchTitle = completeTaskMatch[1].trim().toLowerCase();
      const matchedTask = (store.state.tasks || []).find(t => 
        !t.completed && t.title.toLowerCase().includes(searchTitle)
      );

      if (matchedTask) {
        store.toggleTaskCompletion(matchedTask.id);
        soundService.playCelebration();
        toast.success(`🎉 Tarea "${matchedTask.title}" marcada como completada`);

        const replyMsg = `🎉 ¡Fantástico! He marcado como completada tu tarea **"${matchedTask.title}"**. ¡Sigue así!`;
        this.isThinking = false;
        this.messages.push({ sender: 'assistant', text: replyMsg });
        this._saveHistory();
        this.render();
        this.bindEvents();
        if (isVoice) speechService.speak(replyMsg);
        return;
      }
    }

    try {
      const response = await apiService.sendChatMessage(userText);

      this.isThinking = false;
      soundService.playSoftChime();

      if (response && response.data && response.data.message) {
        const detected = response.data.detected_tasks || [];
        this.messages.push({
          sender: 'assistant',
          text: response.data.message,
          detectedTasks: detected
        });
        if (isVoice) speechService.speak(response.data.message);
      } else {
        // Motor conversacional y de extracción inteligente local
        const localReply = this._processLocalAssistant(userText);
        this.messages.push({
          sender: 'assistant',
          text: localReply.text,
          detectedTasks: localReply.detectedTasks || []
        });
        if (isVoice) speechService.speak(localReply.text);
      }
    } catch (e) {
      this.isThinking = false;
      const localReply = this._processLocalAssistant(userText);
      this.messages.push({
        sender: 'assistant',
        text: localReply.text,
        detectedTasks: localReply.detectedTasks || []
      });
      if (isVoice) speechService.speak(localReply.text);
    }

    this._saveHistory();
    this.render();
    this.bindEvents();
  }

  _processLocalAssistant(userText) {
    const raw = userText.trim();
    const lower = raw.toLowerCase();
    const now = new Date();
    const currentHour24 = now.getHours();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 1. Saludos
    if (/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|saludos|que tal|qué tal)\b/i.test(lower) && lower.length < 25) {
      return {
        text: '¡Hola! ¿En qué te puedo colaborar hoy? Puedes dictarme o escribirme cualquier recordatorio (ej: "Correr a la 1:25 PM de hoy" o "Estudiar cálculo mañana a las 4:00 PM") o pedirme recomendaciones de productividad.',
        detectedTasks: []
      };
    }

    // 2. Confirmaciones cortas
    if (/^(si|sí|claro|dale|por favor|porfa|ok|vale|yes)\b/i.test(lower) && lower.length < 15) {
      return {
        text: '¡Excelente! Cuéntame qué tarea o recordatorio deseas agendar (por ejemplo: "Correr hoy a la 1:25 PM" o "Reunión de equipo el viernes a las 10:00 AM").',
        detectedTasks: []
      };
    }

    // 3. Petición general o incompleta de recordatorio (incluso con errores tipográficos como "recordaoptrio")
    if (
      /^(quiero|necesito|hazme|ponme|dame|crear|agendar)?\s*(un\s+|una\s+)?(recordat[oó]rio|recorda\w+|tarea|aviso|alarma)\s*$/i.test(lower) ||
      (/recorda\w+/i.test(lower) && lower.length < 28 && !/\d|hora|hoy|mañana|estudiar|correr|llamar|trabajo|reunion/i.test(lower))
    ) {
      return {
        text: '¡Con gusto! ¿De qué actividad o tema deseas que sea tu recordatorio y para qué hora te gustaría programarlo? (Por ejemplo: "Correr hoy a la 1:25 PM" o "Estudiar para el examen mañana a las 4:00 PM").',
        detectedTasks: []
      };
    }

    // 4. Preguntas de productividad / consejos
    if (/consejo|técnica|tecnica|pomodoro|eisenhower|distracc|procrastin|concentra|organizar|h[aá]bito/i.test(lower)) {
      return {
        text: 'Te recomiendo la técnica de Bloques de Tiempo (*Time Blocking*): dedica 45 minutos de trabajo sin interrupciones seguidos de 10 minutos de pausa activa para estirar y tomar agua. También puedes iniciar una sesión en nuestro **Temporizador** para mantener tu ritmo.',
        detectedTasks: []
      };
    }

    // 5. Extracción inteligente de Tareas / Recordatorios
    let dateVal = todayISO;
    let timeVal = '12:00 PM';
    let timeFound = false;

    // A) Detección de Tiempo Relativo (ej: "en 5 minutos", "dentro de 10 mins", "en 2 horas")
    const relativeMinMatch = lower.match(/(?:dentro de|en)\s+(\d+)\s*(?:minutos?|mins?|m\b)/i);
    const relativeHourMatch = lower.match(/(?:dentro de|en)\s+(\d+)\s*(?:horas?|hrs?|h\b)/i);

    if (relativeMinMatch) {
      const minsToAdd = parseInt(relativeMinMatch[1], 10);
      const targetDate = new Date(Date.now() + minsToAdd * 60 * 1000);
      let hours = targetDate.getHours();
      const minutes = targetDate.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      timeVal = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      dateVal = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      timeFound = true;
    } else if (relativeHourMatch) {
      const hoursToAdd = parseInt(relativeHourMatch[1], 10);
      const targetDate = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
      let hours = targetDate.getHours();
      const minutes = targetDate.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      timeVal = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      dateVal = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      timeFound = true;
    } else {
      // B) Detección de Hora Absoluta en Español (ej: "a la 1:25", "a las 1:25", "a las 4pm", "a las 16:30", "1:25 pm", "13:25")
      const timeMatch =
        lower.match(/(?:a\s+las?|para\s+las?|a\s+la)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i) ||
        lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?\b/i) ||
        lower.match(/\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b/i);

      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        let mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        let ampm = timeMatch[3] ? timeMatch[3].toUpperCase().replace(/\./g, '') : null;

        if (!ampm) {
          if (hours >= 13 && hours <= 23) {
            hours -= 12;
            ampm = 'PM';
          } else if (hours === 12) {
            ampm = 'PM';
          } else if (hours >= 1 && hours <= 7 && currentHour24 >= 11) {
            ampm = 'PM';
          } else if (hours >= 8 && hours <= 11) {
            ampm = currentHour24 >= 12 && (hours < currentHour24 % 12) ? 'PM' : 'AM';
          } else {
            ampm = hours >= 12 ? 'PM' : 'AM';
          }
        } else {
          if (hours > 12) hours -= 12;
        }

        timeVal = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
        timeFound = true;
      }

      // C) Detección de Fecha Relativa
      if (/mañana|manana/i.test(lower)) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        dateVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else if (/pasado mañana|pasado manana/i.test(lower)) {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        dateVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else if (/lunes/i.test(lower)) dateVal = this._getNextDayOfWeek(1);
      else if (/martes/i.test(lower)) dateVal = this._getNextDayOfWeek(2);
      else if (/mi[eé]rcoles|miercoles/i.test(lower)) dateVal = this._getNextDayOfWeek(3);
      else if (/jueves/i.test(lower)) dateVal = this._getNextDayOfWeek(4);
      else if (/viernes/i.test(lower)) dateVal = this._getNextDayOfWeek(5);
      else if (/s[aá]bado|sabado/i.test(lower)) dateVal = this._getNextDayOfWeek(6);
      else if (/domingo/i.test(lower)) dateVal = this._getNextDayOfWeek(0);
    }

    // D) Prioridad
    const isUrgent = /urgente|importante|alarma|alta|prioridad alta|critico/i.test(lower);
    const isLow = /baja|opcional|despues|prioridad baja/i.test(lower);
    const priorityVal = isUrgent ? 'Alta' : (isLow ? 'Baja' : 'Media');

    // E) Categoría
    const isStudy = /estudiar|calculo|examen|lectura|estudio|tarea|universidad|colegio|curso|aprender/i.test(lower);
    const isWork = /reunion|cliente|proyecto|trabajo|informe|reporte|correo|email|jefe|oficina|entrevista/i.test(lower);
    const isHealth = /agua|ejercicio|gimnasio|gym|correr|caminar|meditar|medicina|doctor|pastilla|entrenar/i.test(lower);
    const categoryVal = isStudy ? 'Estudio' : (isWork ? 'Trabajo' : (isHealth ? 'Salud' : 'General'));

    // F) Extracción Limpia y Precisa del Título de la Tarea
    let cleanTitle = '';

    // Patrón 1: Nombre explícito (ej: "con el nombre de prueba 1", "titulado reporte final")
    const explicitNameMatch = raw.match(/(?:con el (?:nombre|t[ií]tulo)(?: de)?|llamad[oa]|titulad[oa]|de nombre)\s+["']?([^"'\n\.,;]+?)["']?(?:\s+(?:para|el|a las|con)|$)/i);
    if (explicitNameMatch && explicitNameMatch[1]) {
      cleanTitle = explicitNameMatch[1].trim();
    }

    // Patrón 2: Limpieza profunda de prefijos conversacionales y sufijos de tiempo
    if (!cleanTitle) {
      cleanTitle = raw
        // Prefijos conversacionales en español
        .replace(/^(pero\s+)?(por\s+favor\s+)?(me\s+gustar[ií]a\s+que\s+)?(quiero\s+que\s+)?(mi\s+recordatorio\s+sea\s+(sobre|de|para)\s+|mi\s+tarea\s+sea\s+(sobre|de|para)\s+|recu[eé]rdame\s+(sobre|de|que\s+tengo\s+que\s+)?|hazme\s+un\s+recordatorio\s+(sobre|de|para)\s+|quiero\s+un\s+recordatorio\s+(sobre|de|para)\s+|poner\s+(un\s+)?recordatorio\s+(sobre|de|para)\s+|crear\s+(una\s+)?tarea\s+(sobre|de|para)\s+|agendar\s+(una\s+)?tarea\s+(sobre|de|para)\s+|acordarme\s+de\s+|recordar\s+|programar\s+|a[ñn]adir\s+(una\s+)?tarea\s+(de|para|sobre)?\s*)/i, '')
        // Expresiones de tiempo y hora
        .replace(/(?:a\s+las?|para\s+las?|a\s+la)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?/gi, '')
        .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?\b/gi, '')
        .replace(/\b(?:dentro de|en)\s+\d+\s*(?:minutos?|mins?|horas?|hrs?)\b/gi, '')
        // Fechas relativas
        .replace(/\b(?:de\s+)?(?:hoy|mañana|manana|pasado\s+mañana|pasado\s+manana)\b/gi, '')
        .replace(/\b(?:el\s+)?(?:lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo)\b/gi, '')
        // Prioridades y categorías
        .replace(/\bcon\s+prioridad\s+(?:alta|media|baja)\b/gi, '')
        .replace(/\ben\s+categor[ií]a\s+\w+\b/gi, '')
        .replace(/\bcon\s+el\s+(?:nombre|t[ií]tulo)(?:\s+de)?\s*/gi, '')
        // Conectores residuales al inicio o final
        .replace(/^(sobre|de|para|que\s+sea\s+sobre|que\s+sea\s+de|que)\s+/i, '')
        .replace(/\s+(de\s+hoy|hoy|para\s+hoy|mañana|para\s+mañana)$/i, '')
        .trim();
    }

    // Si el título quedó vacío o solo contiene palabras genéricas
    if (!cleanTitle || /^(recordatorio|recorda\w+|tarea|algo|aviso)$/i.test(cleanTitle) || cleanTitle.length < 2) {
      if (!timeFound) {
        return {
          text: '¡Con gusto! ¿De qué actividad o tema deseas que sea tu recordatorio y para qué hora te gustaría programarlo? (Por ejemplo: "Correr hoy a la 1:25 PM" o "Estudiar para el examen mañana a las 4:00 PM").',
          detectedTasks: []
        };
      }
      cleanTitle = 'Recordatorio';
    } else {
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    }

    return {
      text: `He preparado tu recordatorio "${cleanTitle}" para el ${dateVal} a las ${timeVal}. Pulsa en el botón para agregarla a tu agenda:`,
      detectedTasks: [
        {
          title: cleanTitle,
          category: categoryVal,
          priority: priorityVal,
          time: timeVal,
          date: dateVal
        }
      ]
    };
  }

  _getNextDayOfWeek(targetDayIndex) {
    const d = new Date();
    const currentDay = d.getDay();
    let diff = targetDayIndex - currentDay;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  _toggleSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.warning('El dictado por voz no está disponible en este navegador.');
      return;
    }

    if (!this.recognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = 'es-ES';

      this.recognition.onstart = () => {
        this.isListening = true;
        toast.info('Escuchando... puedes hablar ahora');
        this.render();
        this.bindEvents();
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const input = $('#chat-input', this.container);
        if (input) input.value = transcript;
        this._sendMessage(transcript, true);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.render();
        this.bindEvents();
      };

      this.recognition.onerror = () => {
        this.isListening = false;
        this.render();
        this.bindEvents();
      };
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      this.recognition.start();
    }
  }

  _scrollToBottom() {
    const history = $('#chat-history', this.container);
    if (history) {
      history.scrollTop = history.scrollHeight;
    }
  }
}
