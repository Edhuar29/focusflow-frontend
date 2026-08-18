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
        text: '¡Hola, Francisco! Soy tu Asistente FocusFlow impulsado por IA. Puedes dictarme o escribirme tareas en lenguaje natural (ej: "Estudiar física mañana a las 4pm con prioridad alta") o pedirme recomendaciones para organizar tu jornada.'
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
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
                          <span>⏰ ${escapeHTML(t.time || '12:00 PM')}</span> • 
                          <span>📅 ${escapeHTML(t.date || getTodayISO())}</span> • 
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

      if (response && response.data) {
        const detected = response.data.detected_tasks || [];
        this.messages.push({
          sender: 'assistant',
          text: response.data.message || 'He procesado tu solicitud:',
          detectedTasks: detected
        });
      } else {
        // Fallback dinámico inteligente local
        const todayISO = getTodayISO();
        const isStudy = /estudiar|calculo|examen|lectura|estudio/i.test(userText);
        const isWork = /reunion|cliente|proyecto|trabajo|informe/i.test(userText);
        const isUrgent = /urgente|importante|alarma|alta/i.test(userText);

        this.messages.push({
          sender: 'assistant',
          text: `He preparado la tarea a partir de tu indicación. Pulsa en el botón para integrarla a tu agenda:`,
          detectedTasks: [
            {
              title: userText.charAt(0).toUpperCase() + userText.slice(1),
              category: isStudy ? 'Estudio' : (isWork ? 'Trabajo' : 'General'),
              priority: isUrgent ? 'Alta' : 'Media',
              time: '04:00 PM',
              date: todayISO
            }
          ]
        });
      }
    } catch (e) {
      this.isThinking = false;
      this.messages.push({
        sender: 'assistant',
        text: 'He registrado tu consulta. ¿Deseas que prepare una tarea o configuremos un bloque de enfoque?'
      });
    }

    this.render();
    this.bindEvents();
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
