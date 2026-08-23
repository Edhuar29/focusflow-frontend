/**
 * FocusFlow Web - Views: AI Assistant View Controller
 * Conectado con la API de Google Gemini (Gratuita $0) y soporte para dictado por voz.
 */

import { BaseView } from './base.view.js';
import { soundService } from '../services/sound.service.js';
import { toast } from '../components/toast.component.js';
import { store } from '../core/store.js';
import { apiService } from '../services/api.service.js';
import { getTodayISO } from '../utils/date.utils.js';
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
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[AssistantView] Error loading chat history:', e);
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
      const toSave = this.messages.slice(-50);
      localStorage.setItem(this._getStorageKey(), JSON.stringify(toSave));
    } catch (e) {
      console.warn('[AssistantView] Error saving chat history:', e);
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

  _sanitizeInput(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let clean = raw.slice(0, 500);
    clean = clean.replace(/<[^>]*>?/gm, '');
    clean = clean.replace(/javascript:/gi, '');
    clean = clean.replace(/on\w+=/gi, '');
    return clean.trim();
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
            ${parsedItems.map(it => `
              <div class="proposal-card-item">
                <div class="proposal-card-top">
                  <span class="proposal-day-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line></svg>
                    ${escapeHTML(it.day)}${it.time ? ` · ${escapeHTML(it.time)}` : ''}
                  </span>
                  <span class="badge badge-priority-${it.priority.toLowerCase()}">${escapeHTML(it.priority)}</span>
                </div>
                <div class="proposal-card-title">${escapeHTML(it.title)}</div>
              </div>
            `).join('')}
          </div>
        `;

        const questionText = questionLines.join(' ');
        const questionHTML = questionText 
          ? `<div class="proposal-question-box"><p style="margin: 0;">${escapeHTML(questionText)}</p></div>` 
          : '';

        const quickActionsHTML = `
          <div class="proposal-quick-actions">
            <button type="button" class="btn btn-primary btn-quick-reply" data-quick-text="sí, me parece bien" style="font-size: 11.5px; padding: 6px 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Sí, agendar estas tareas</span>
            </button>
            <button type="button" class="btn btn-secondary btn-quick-reply" data-quick-text="deseo ajustar los horarios" style="font-size: 11.5px; padding: 6px 12px; border-radius: 999px;">
              <span>✏️ Ajustar horario</span>
            </button>
          </div>
        `;

        return `${introHTML}${cardsHTML}${questionHTML}${quickActionsHTML}`;
      }
    }

    const paragraphs = text.split(/\n\n+/);
    return paragraphs.map(p => `<p style="margin: 0 0 8px 0; line-height: 1.55; white-space: pre-wrap;">${escapeHTML(p)}</p>`).join('');
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
                ${this._formatMessageContent(m.text, m.sender === 'assistant')}
                
                ${m.detectedTasks && m.detectedTasks.length > 0 ? `
                  <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                    ${m.detectedTasks.length > 1 ? `
                      <div style="margin-bottom: 4px;">
                        <button class="btn btn-primary btn-approve-all-tasks" data-msg-idx="${idx}" style="font-size: 12px; font-weight: 600; padding: 8px 14px; width: 100%; border-radius: 8px;">
                          <span>✓ Aprobar y Agregar las ${m.detectedTasks.length} Tareas a la Agenda</span>
                        </button>
                      </div>
                    ` : ''}
                    ${m.detectedTasks.map((t, tIdx) => `
                      <div style="background: var(--bg-card); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-medium);">
                        <div style="font-weight: var(--fw-bold); font-size: var(--text-sm); color: var(--text-primary); margin-bottom: 2px;">
                          ${escapeHTML(t.title)}
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                          <span style="display: inline-flex; align-items: center; gap: 3px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            ${escapeHTML(t.time || '12:00 PM')}
                          </span>
                          <span>•</span>
                          <span style="display: inline-flex; align-items: center; gap: 3px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${escapeHTML(t.date || getTodayISO())}
                          </span>
                          <span>•</span>
                          <span class="badge badge-priority-${(t.priority || 'medium').toLowerCase()}">${t.priority || 'Medio'}</span>
                        </div>
                        <button class="btn btn-primary btn-approve-task" data-msg-idx="${idx}" data-task-idx="${tIdx}" style="font-size: 11px; padding: 4px 10px; width: 100%;">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 4px;">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          <span>Aprobar y Agregar a la Agenda</span>
                        </button>
                      </div>
                    `).join('')}
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
        }
      };
    }
  }

  async _sendMessage(userText) {
    soundService.playClick();
    this.messages.push({ sender: 'user', text: userText });
    this._saveHistory();
    this.isThinking = true;
    this.render();
    this.bindEvents();

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
      } else {
        // Motor conversacional y de extracción inteligente local
        const localReply = this._processLocalAssistant(userText);
        this.messages.push({
          sender: 'assistant',
          text: localReply.text,
          detectedTasks: localReply.detectedTasks || []
        });
      }
    } catch (e) {
      this.isThinking = false;
      const localReply = this._processLocalAssistant(userText);
      this.messages.push({
        sender: 'assistant',
        text: localReply.text,
        detectedTasks: localReply.detectedTasks || []
      });
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
        this._sendMessage(transcript);
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
