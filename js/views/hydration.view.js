/**
 * FocusFlow Web - Views: Hydration View Controller
 * Manejo de la botella reactiva, registro de tomas y recordatorios por correo (cuenta creada vs personalizado).
 */

import { BaseView } from './base.view.js';
import { store } from '../core/store.js';
import { eventBus } from '../core/event-bus.js';
import { soundService } from '../services/sound.service.js';
import { notificationService } from '../services/notification.service.js';
import { apiService } from '../services/api.service.js';
import { toast } from '../components/toast.component.js';
import { notificationScheduler } from '../services/notification-scheduler.service.js';
import { $, escapeHTML } from '../utils/dom.utils.js';

export class HydrationView extends BaseView {
  constructor() {
    super('hydration-view');
    this.unsubscribeHydration = null;
  }

  render() {
    if (!this.container) return;

    const data = store.getState().hydration;
    const goal = data.goalMl || 2000;
    const consumed = data.currentMl || 0;
    const reminder = data.reminder || {
      enabled: false,
      intervalHours: 1,
      emailNotification: false,
      email: ''
    };

    const currentUser = store.getUser();
    const emailPrefs = store.getEmailPreferences();
    const accountEmail = (currentUser && currentUser.email) ? currentUser.email : 'dannyeduardoanasi@gmail.com';
    
    // Determinar si usa el correo de la cuenta o personalizado
    const isCustomEmail = reminder.useCustomEmail === true || (reminder.email && reminder.email !== accountEmail);
    const activeEmail = isCustomEmail ? (reminder.email || emailPrefs.notificationEmail || '') : accountEmail;

    // Métricas del agua restante
    const remainingMl = Math.max(0, goal - consumed);
    const remainingPercent = Math.min(100, Math.max(0, Math.round((remainingMl / goal) * 100)));

    // Cálculo dinámico de altura SVG para la botella (Total 148px de span)
    const waterHeight = (remainingPercent / 100) * 148;
    const waterY = 38 + (148 - waterHeight);

    this.container.innerHTML = `
      <div class="hydration-container">
        
        <!-- Interactive 2L Bottle Graphic -->
        <div class="hydration-bottle-card">
          <svg class="hydration-bottle-svg" viewBox="0 0 100 220" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="water-fluid-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#0284C7" stop-opacity="0.9" />
              </linearGradient>

              <clipPath id="bottle-inner-shape">
                <rect x="19" y="37" width="62" height="150" rx="13" />
              </clipPath>
            </defs>

            <!-- Tapa de la botella -->
            <rect x="42" y="14" width="16" height="5" rx="2" fill="#38BDF8" />
            <rect x="38" y="19" width="24" height="12" rx="3" fill="#0EA5E9" />

            <!-- Cuello -->
            <path d="M42 31 L42 37 L58 37 L58 31 Z" fill="#0284C7" opacity="0.5" />

            <!-- Fondo vacío del cristal -->
            <rect x="19" y="37" width="62" height="150" rx="13" fill="rgba(56, 189, 248, 0.04)" />

            <!-- Agua restante dinámica con clip-path -->
            <g clip-path="url(#bottle-inner-shape)">
              <rect 
                id="svg-water-rect"
                x="10" 
                y="${waterY}" 
                width="80" 
                height="${waterHeight + 15}" 
                fill="url(#water-fluid-gradient)" 
                style="transition: y 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.5s cubic-bezier(0.4, 0, 0.2, 1);"
              />
              <ellipse 
                id="svg-water-surface"
                cx="50" 
                cy="${waterY}" 
                rx="30" 
                ry="4" 
                fill="#BAE6FD" 
                opacity="${waterHeight > 3 && remainingPercent < 98 ? '0.9' : '0'}"
                style="transition: cy 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;"
              />
            </g>

            <!-- Contorno exterior de cristal y marcas simétricas -->
            <rect x="18" y="36" width="64" height="152" rx="14" fill="none" stroke="#38BDF8" stroke-width="2.5" stroke-opacity="0.45" />
            
            <line x1="68" y1="75" x2="77" y2="75" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />
            <line x1="68" y1="112" x2="77" y2="112" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />
            <line x1="68" y1="149" x2="77" y2="149" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />

            <line x1="25" y1="46" x2="25" y2="176" stroke="rgba(255,255,255,0.18)" stroke-width="2" stroke-linecap="round" />
          </svg>

          <div style="margin-top: var(--space-4); text-align: center;">
            <div class="hydration-progress-text" id="hydration-progress-text">${consumed} / ${goal} ml</div>
            <div class="hydration-goal-label" id="hydration-goal-label">
              ${consumed >= goal 
                ? 'Meta diaria completada. Botella vacía.' 
                : `Restante por beber: ${remainingMl} ml (${remainingPercent}%)`}
            </div>
          </div>
        </div>

        <!-- Info, Single Drink Button & Water Reminder Panel -->
        <div class="hydration-info-panel">
          
          <!-- 1. Single Main Drink Button -->
          <div class="hydration-action-card">
            <h3 class="hydration-section-title">Registro Rápido</h3>
            <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-3);">
              Cada vaso vacía tu cuota diaria de agua restante:
            </p>
            
            <button class="btn btn-primary btn-drink-main" id="btn-drink-water-single">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
              </svg>
              <span>Tomar Agua (+250 ml)</span>
            </button>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-3);">
              <span style="font-size: var(--text-xs); color: var(--text-muted);" id="hydration-logs-text">${data.logsToday || 0} tomas registradas hoy</span>
              <button class="btn btn-ghost" id="btn-reset-water" style="font-size: var(--text-xs); padding: 4px 8px;">
                Reiniciar botella
              </button>
            </div>
          </div>

          <!-- 2. Water Reminder Configuration Panel -->
          <div class="hydration-action-card">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
              <h3 class="hydration-section-title" style="margin: 0;">Recordatorio de Hidratación</h3>
              <label class="custom-toggle" title="Activar/Desactivar recordatorio">
                <input type="checkbox" id="toggle-water-reminder" ${reminder.enabled ? 'checked' : ''} />
                <span class="toggle-slider"></span>
              </label>
            </div>
            
            <p style="color: var(--text-secondary); font-size: var(--text-xs); margin-bottom: var(--space-3);">
              Recibe avisos periódicos en la pantalla de tu computadora y en tu correo electrónico según el tiempo que elijas.
            </p>

            <!-- Selector Flexible de Frecuencia / Minutos Personalizados -->
            <div style="margin-bottom: var(--space-3); background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label for="reminder-interval-select" style="font-size: var(--text-xs); font-weight: 600; color: var(--text-primary);">Frecuencia de Aviso:</label>
                <span id="water-current-interval-badge" style="font-size: 10px; font-weight: 700; color: #38BDF8; background: rgba(56, 189, 248, 0.12); padding: 2px 7px; border-radius: 999px;">
                  Cada ${Math.round(parseFloat(reminder.intervalHours || 1) * 60)} min
                </span>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <select id="reminder-interval-select" class="form-control" style="flex: 1; min-width: 160px; padding: 7px 10px; font-size: var(--text-xs); cursor: pointer;">
                  <option value="0.0833" ${Math.abs(reminder.intervalHours - 0.0833) < 0.01 ? 'selected' : ''}>Cada 5 minutos (Prueba rápida)</option>
                  <option value="0.1666" ${Math.abs(reminder.intervalHours - 0.1666) < 0.01 ? 'selected' : ''}>Cada 10 minutos</option>
                  <option value="0.25" ${Math.abs(reminder.intervalHours - 0.25) < 0.01 ? 'selected' : ''}>Cada 15 minutos</option>
                  <option value="0.3333" ${Math.abs(reminder.intervalHours - 0.3333) < 0.01 ? 'selected' : ''}>Cada 20 minutos</option>
                  <option value="0.5" ${Math.abs(reminder.intervalHours - 0.5) < 0.01 ? 'selected' : ''}>Cada 30 minutos</option>
                  <option value="0.75" ${Math.abs(reminder.intervalHours - 0.75) < 0.01 ? 'selected' : ''}>Cada 45 minutos</option>
                  <option value="1" ${Math.abs(reminder.intervalHours - 1) < 0.01 ? 'selected' : ''}>Cada 1 hora (Recomendado)</option>
                  <option value="1.5" ${Math.abs(reminder.intervalHours - 1.5) < 0.01 ? 'selected' : ''}>Cada 1 hora y media</option>
                  <option value="2" ${Math.abs(reminder.intervalHours - 2) < 0.01 ? 'selected' : ''}>Cada 2 horas</option>
                  <option value="3" ${Math.abs(reminder.intervalHours - 3) < 0.01 ? 'selected' : ''}>Cada 3 horas</option>
                  <option value="custom">Personalizado en minutos...</option>
                </select>
                <div id="custom-minutes-wrap" style="display: none; align-items: center; gap: 6px; width: 100%;">
                  <input type="number" id="input-custom-water-minutes" class="form-control" placeholder="Minutos (ej. 25)" min="1" max="720" value="${Math.round(parseFloat(reminder.intervalHours || 1) * 60)}" style="flex: 1; padding: 6px 10px; font-size: var(--text-xs);" />
                  <span style="font-size: var(--text-xs); color: var(--text-muted);">minutos</span>
                </div>
              </div>
            </div>

            <!-- Email Notification Section -->
            <div style="background-color: var(--bg-input); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: var(--space-3);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: var(--text-xs); font-weight: var(--fw-semibold); color: var(--text-primary);">
                  Enviar aviso a mi correo electrónico
                </span>
                <input type="checkbox" id="toggle-water-email" ${reminder.emailNotification !== false ? 'checked' : ''} style="cursor: pointer;" />
              </div>

              <!-- Selector de Opciones: Correo de Cuenta vs Personalizado -->
              <div class="email-choice-group" style="margin-bottom: 8px;">
                <div class="email-choice-card ${!isCustomEmail ? 'active' : ''}" id="water-choice-account" style="padding: 8px 10px;">
                  <div class="email-choice-radio" style="width: 14px; height: 14px;">
                    <div class="email-choice-radio-inner" style="width: 5px; height: 5px;"></div>
                  </div>
                  <div>
                    <span class="email-choice-title" style="font-size: 11.5px;">Correo de mi cuenta (Gmail)</span>
                    <span class="email-choice-desc" style="font-size: 10px;">${escapeHTML(accountEmail)}</span>
                  </div>
                </div>

                <div class="email-choice-card ${isCustomEmail ? 'active' : ''}" id="water-choice-custom" style="padding: 8px 10px;">
                  <div class="email-choice-radio" style="width: 14px; height: 14px;">
                    <div class="email-choice-radio-inner" style="width: 5px; height: 5px;"></div>
                  </div>
                  <div>
                    <span class="email-choice-title" style="font-size: 11.5px;">Otro correo</span>
                    <span class="email-choice-desc" style="font-size: 10px;">Personalizado</span>
                  </div>
                </div>
              </div>

              <input 
                type="email" 
                id="water-reminder-email" 
                class="form-control" 
                placeholder="ejemplo@correo.com" 
                value="${escapeHTML(activeEmail)}"
                ${!isCustomEmail ? 'readonly style="opacity: 0.85; cursor: default; padding: 6px 10px; font-size: var(--text-xs);"' : 'style="padding: 6px 10px; font-size: var(--text-xs);"'}
              />
            </div>

            <!-- Botones de Acción y Prueba Inmediata -->
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" id="btn-save-reminder" style="flex: 1; font-size: var(--text-xs); padding: 8px 10px;">
                Guardar Configuración
              </button>
              <button class="btn btn-primary" id="btn-test-water-now" style="font-size: var(--text-xs); padding: 8px 14px; white-space: nowrap; display: flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #4F46E5, #0284C7); border-color: transparent; font-weight: 600;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M22 2L11 13"></path>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                <span>Probar Ahora</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    `;
  }

  bindEvents() {
    if (!this.container) return;

    const currentUser = store.getUser();
    const accountEmail = (currentUser && currentUser.email) ? currentUser.email : 'dannyeduardoanasi@gmail.com';

    const choiceAccount = $('#water-choice-account', this.container);
    const choiceCustom = $('#water-choice-custom', this.container);
    const emailInput = $('#water-reminder-email', this.container);

    let isCustomSelected = choiceCustom ? choiceCustom.classList.contains('active') : false;

    // 1. Alternador de modo de correo en Hidratación
    if (choiceAccount && choiceCustom && emailInput) {
      choiceAccount.onclick = () => {
        soundService.playClick();
        choiceAccount.classList.add('active');
        choiceCustom.classList.remove('active');
        isCustomSelected = false;

        emailInput.value = accountEmail;
        emailInput.readOnly = true;
        emailInput.style.opacity = '0.85';
        emailInput.style.cursor = 'default';
      };

      choiceCustom.onclick = () => {
        soundService.playClick();
        choiceCustom.classList.add('active');
        choiceAccount.classList.remove('active');
        isCustomSelected = true;

        emailInput.readOnly = false;
        emailInput.style.opacity = '1';
        emailInput.style.cursor = 'text';
        emailInput.focus();
      };
    }

    // 1.1 Manejo de intervalo personalizado de hidratación
    const intervalSelect = $('#reminder-interval-select', this.container);
    const customWrap = $('#custom-minutes-wrap', this.container);
    const customInput = $('#input-custom-water-minutes', this.container);
    const intervalBadge = $('#water-current-interval-badge', this.container);

    const updateIntervalDisplay = () => {
      if (!intervalSelect) return;
      if (intervalSelect.value === 'custom') {
        if (customWrap) customWrap.style.display = 'flex';
        const mins = customInput ? (parseInt(customInput.value, 10) || 30) : 30;
        if (intervalBadge) intervalBadge.textContent = `Cada ${mins} min`;
      } else {
        if (customWrap) customWrap.style.display = 'none';
        const hours = parseFloat(intervalSelect.value) || 1;
        const mins = Math.round(hours * 60);
        if (intervalBadge) intervalBadge.textContent = `Cada ${mins} min`;
      }
    };

    if (intervalSelect) {
      intervalSelect.onchange = () => {
        soundService.playClick();
        updateIntervalDisplay();
      };
    }

    if (customInput) {
      customInput.oninput = () => {
        const mins = parseInt(customInput.value, 10) || 1;
        if (intervalBadge) intervalBadge.textContent = `Cada ${mins} min`;
      };
    }

    // 2. Botón de Tomar Agua (+250 ml)
    const drinkBtn = $('#btn-drink-water-single', this.container);
    if (drinkBtn) {
      drinkBtn.onclick = () => {
        soundService.playTaskComplete();
        const data = store.getState().hydration;
        data.currentMl = (data.currentMl || 0) + 250;
        data.logsToday = (data.logsToday || 0) + 1;
        store._persistAndNotify('hydration', data, 'hydration:updated');
        toast.success(`Tomaste 250 ml. Total consumido: ${data.currentMl} ml`);
        this._updateBottleUI();
      };
    }

    // 3. Botón de Reiniciar Botella
    const resetBtn = $('#btn-reset-water', this.container);
    if (resetBtn) {
      resetBtn.onclick = () => {
        soundService.playClick();
        const data = store.getState().hydration;
        data.currentMl = 0;
        data.logsToday = 0;
        store._persistAndNotify('hydration', data, 'hydration:updated');
        toast.info('Botella reiniciada a cuota completa (2000 ml)');
        this._updateBottleUI();
      };
    }

    // 4. Guardar Recordatorio
    const saveReminderBtn = $('#btn-save-reminder', this.container);
    if (saveReminderBtn) {
      saveReminderBtn.onclick = () => {
        soundService.playClick();

        let interval = 1;
        if (intervalSelect && intervalSelect.value === 'custom') {
          const mins = parseInt(customInput ? customInput.value : '30', 10) || 30;
          interval = Math.max(0.016, mins / 60);
        } else if (intervalSelect) {
          interval = parseFloat(intervalSelect.value) || 1;
        }

        const enabled = $('#toggle-water-reminder', this.container)?.checked || false;
        const emailNotification = $('#toggle-water-email', this.container)?.checked || false;
        const inputEmail = emailInput ? emailInput.value.trim() : accountEmail;
        const targetEmail = isCustomSelected ? inputEmail : accountEmail;

        if (emailNotification && isCustomSelected && (!targetEmail || !targetEmail.includes('@'))) {
          toast.warning('Por favor ingresa un correo electrónico válido');
          emailInput?.focus();
          return;
        }

        const data = store.getState().hydration;
        data.reminder = {
          enabled,
          intervalHours: interval,
          emailNotification,
          useCustomEmail: isCustomSelected,
          email: targetEmail
        };

        store._persistAndNotify('hydration', data, 'hydration:updated');
        
        // Sincronizar con las preferencias globales de correo
        store.setEmailPreferences({
          emailWaterAlerts: emailNotification,
          notificationEmail: targetEmail,
          useCustomEmail: isCustomSelected
        });

        const totalMinutes = Math.round(interval * 60);

        if (enabled) {
          notificationScheduler.resetWaterTimer();
          toast.success(`Recordatorio de hidratación programado cada ${totalMinutes} minutos para ${targetEmail}`);
        } else {
          toast.info('Recordatorio de hidratación desactivado');
        }
      };
    }

    // 4.1 Botón de Probar Notificación y Correo Inmediato
    const testWaterBtn = $('#btn-test-water-now', this.container);
    if (testWaterBtn) {
      testWaterBtn.onclick = async () => {
        soundService.playSoftChime();
        testWaterBtn.disabled = true;
        const origText = testWaterBtn.innerHTML;
        testWaterBtn.innerHTML = `<span>Enviando correo...</span>`;

        const inputEmail = emailInput ? emailInput.value.trim() : accountEmail;
        const targetEmail = isCustomSelected ? inputEmail : accountEmail;

        try {
          // 1. Notificación en pantalla de la computadora (Desktop)
          const perm = notificationService.getPermissionStatus();
          if (perm === 'granted') {
            notificationService.send('EdhuFlow: Hora de Hidratarte', {
              body: 'Momento de tomar un vaso de agua (+250 ml). Mantén tu concentración y energía.',
              tag: 'edhuflow-test-water'
            });
          } else if (perm === 'default') {
            eventBus.emit('desktopNotif:requestPermission');
          }

          // 2. Correo electrónico real entregado a Gmail
          const res = await apiService.sendHydrationEmailReminder(targetEmail);
          if (res && res.success) {
            toast.success(`¡Alerta emitida y correo entregado a ${targetEmail}!`);
          } else {
            toast.info(`Recordatorio procesado para ${targetEmail}`);
          }
        } catch (err) {
          toast.error(`Error enviando correo: ${err.message || 'Verifica tu conexión'}`);
        } finally {
          testWaterBtn.disabled = false;
          testWaterBtn.innerHTML = origText;
        }
      };
    }

    // 5. Suscripción a eventos externos
    if (this.unsubscribeHydration) this.unsubscribeHydration();
    this.unsubscribeHydration = eventBus.on('hydration:updated', () => {
      this._updateBottleUI();
    });
  }

  _updateBottleUI() {
    if (!this.container) return;

    const data = store.getState().hydration;
    const goal = data.goalMl || 2000;
    const consumed = data.currentMl || 0;

    const remainingMl = Math.max(0, goal - consumed);
    const remainingPercent = Math.min(100, Math.max(0, Math.round((remainingMl / goal) * 100)));

    const waterHeight = (remainingPercent / 100) * 148;
    const waterY = 38 + (148 - waterHeight);

    const rect = $('#svg-water-rect', this.container);
    const surface = $('#svg-water-surface', this.container);
    const progressText = $('#hydration-progress-text', this.container);
    const goalLabel = $('#hydration-goal-label', this.container);
    const logsText = $('#hydration-logs-text', this.container);

    if (rect) {
      rect.setAttribute('y', waterY);
      rect.setAttribute('height', waterHeight + 15);
    }
    if (surface) {
      surface.setAttribute('cy', waterY);
      surface.style.opacity = (waterHeight > 3 && remainingPercent < 98) ? '0.9' : '0';
    }
    if (progressText) {
      progressText.textContent = `${consumed} / ${goal} ml`;
    }
    if (goalLabel) {
      goalLabel.textContent = consumed >= goal 
        ? 'Meta diaria completada. Botella vacía.' 
        : `Restante por beber: ${remainingMl} ml (${remainingPercent}%)`;
    }
    if (logsText) {
      logsText.textContent = `${data.logsToday || 0} tomas registradas hoy`;
    }
  }
}
