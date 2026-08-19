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
    this.messages = [
      {
        sender: 'assistant',
        text: '¡Hola, Francisco! Soy tu Asistente EdhuFlow impulsado por IA. Puedes dictarme o escribirme tareas en lenguaje natural (ej: "Estudiar física mañana a las 4pm con prioridad alta") o pedirme recomendaciones para organizar tu jornada.'
      }
    ];
    this.isListening = false;
    this.isThinking = false;
    this.recognition = null;
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="assistant-container">
        
        <!-- Chat History -->
        <div class="chat-history" id="chat-history">
          ${this.messages.map((m, idx) => `
            <div class="chat-message ${m.sender}">
              <div class="chat-bubble">
                <p style="margin: 0; line-height: 1.5;">${escapeHTML(m.text)}</p>
                
                ${m.detectedTasks && m.detectedTasks.length > 0 ? `
                  <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
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
                <span style="font-size: var(--text-xs); color: var(--text-secondary);">FocusFlow IA está analizando tu solicitud...</span>
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

    const handleSend = () => {
      const text = input.value.trim();
      if (!text || this.isThinking) return;
      input.value = '';
      this._sendMessage(text);
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
              alarm: priorityVal === 'high'
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

    this.render();
    this.bindEvents();
  }

  _processLocalAssistant(userText) {
    const raw = userText.trim();
    const lower = raw.toLowerCase();
    const todayISO = getTodayISO();

    // 1. Saludos
    if (/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|saludos|que tal|qué tal)\b/i.test(lower) && lower.length < 25) {
      return {
        text: '¡Hola! ¿En qué te puedo colaborar hoy? Puedes pedirme crear una tarea (ej: "Estudiar física mañana a las 4pm"), programar un recordatorio o solicitar recomendaciones de productividad.',
        detectedTasks: []
      };
    }

    // 2. Afirmaciones y confirmaciones cortas
    if (/^(si|sí|claro|dale|por favor|porfa|ok|vale|yes)\b/i.test(lower) && lower.length < 15) {
      return {
        text: '¡Excelente! Cuéntame qué tarea o recordatorio deseas agendar (por ejemplo: "Reunión con el equipo el viernes a las 10am" o "Comprar café hoy a las 6pm").',
        detectedTasks: []
      };
    }

    // 3. Petición general de recordatorio
    if (/^(quiero un recordatorio|necesito un recordatorio|hazme un recordatorio|ponme un recordatorio|recordatorio)\b/i.test(lower) && lower.length < 35) {
      return {
        text: '¡Perfecto! Dime qué quieres recordar y a qué hora (por ejemplo: "Recordar tomar agua a las 3:00 PM" o "Revisar tareas mañana a las 9:00 AM") y lo programaré de inmediato.',
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
    if (/mañana|manana/i.test(lower)) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dateVal = d.toISOString().split('T')[0];
    } else if (/pasado mañana|pasado manana/i.test(lower)) {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      dateVal = d.toISOString().split('T')[0];
    } else if (/lunes/i.test(lower)) {
      dateVal = this._getNextDayOfWeek(1);
    } else if (/martes/i.test(lower)) {
      dateVal = this._getNextDayOfWeek(2);
    } else if (/mi[eé]rcoles|miercoles/i.test(lower)) {
      dateVal = this._getNextDayOfWeek(3);
    } else if (/jueves/i.test(lower)) {
      dateVal = this._getNextDayOfWeek(4);
    } else if (/viernes/i.test(lower)) {
      dateVal = this._getNextDayOfWeek(5);
    } else if (/s[aá]bado|sabado/i.test(lower)) {
      dateVal = this._getNextDayOfWeek(6);
    } else if (/domingo/i.test(lower)) {
      dateVal = this._getNextDayOfWeek(0);
    }

    // Extracción de hora
    let timeVal = '12:00 PM';
    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i) ||
                      lower.match(/a las\s*(\d{1,2})(?::(\d{2}))?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      let mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      let ampm = timeMatch[3] ? timeMatch[3].toUpperCase().replace(/\./g, '') : (hours >= 12 ? 'PM' : 'AM');
      if (hours > 12) {
        hours -= 12;
        ampm = 'PM';
      }
      timeVal = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
    }

    // Prioridad
    const isUrgent = /urgente|importante|alarma|alta|prioridad alta|critico/i.test(lower);
    const isLow = /baja|opcional|despues|prioridad baja/i.test(lower);
    const priorityVal = isUrgent ? 'Alta' : (isLow ? 'Baja' : 'Media');

    // Categoría
    const isStudy = /estudiar|calculo|examen|lectura|estudio|tarea|universidad|colegio/i.test(lower);
    const isWork = /reunion|cliente|proyecto|trabajo|informe|reporte|correo|email|jefe/i.test(lower);
    const isHealth = /agua|ejercicio|gimnasio|correr|meditar|caminar|medicina|doctor/i.test(lower);
    const categoryVal = isStudy ? 'Estudio' : (isWork ? 'Trabajo' : (isHealth ? 'Salud' : 'General'));

    // Limpiar título de tarea
    let cleanTitle = raw
      .replace(/^(crear tarea( para)?|recordatorio( para)?|quiero un recordatorio( para)?|acordarme de|agendar( una)?|recordar|programar)\s*/i, '')
      .replace(/\b(mañana|hoy|el (lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo))\b/gi, '')
      .replace(/\ba las \d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?\b/gi, '')
      .replace(/\bcon prioridad (alta|media|baja)\b/gi, '')
      .replace(/\ben categor[ií]a \w+\b/gi, '')
      .trim();

    if (!cleanTitle || cleanTitle.length < 2) {
      cleanTitle = raw.charAt(0).toUpperCase() + raw.slice(1);
    } else {
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    }

    return {
      text: `He preparado la tarea a partir de tu indicación. Pulsa en **Agregar a mis Tareas** para agendarla con su recordatorio:`,
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
