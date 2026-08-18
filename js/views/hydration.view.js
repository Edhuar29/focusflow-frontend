/**
 * FocusFlow Web - Views: Hydration View Controller
 * Manejo de la botella reactiva, registro de tomas y recordatorios por correo (cuenta creada vs personalizado).
 */

import { BaseView } from './base.view.js';
import { store } from '../core/store.js';
import { eventBus } from '../core/event-bus.js';
import { soundService } from '../services/sound.service.js';
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
              Recibe avisos periódicos en tu computadora y correo electrónico para mantener tu nivel de concentración.
            </p>

            <div style="display: flex; gap: var(--space-3); align-items: center; margin-bottom: var(--space-3);">
              <label for="reminder-interval-select" style="font-size: var(--text-xs); color: var(--text-secondary);">Frecuencia:</label>
              <select id="reminder-interval-select" class="form-control" style="max-width: 175px; padding: 6px 10px; font-size: var(--text-xs); cursor: pointer;">
                <option value="0.25" ${reminder.intervalHours === 0.25 ? 'selected' : ''}>Cada 15 minutos</option>
                <option value="0.5" ${reminder.intervalHours === 0.5 ? 'selected' : ''}>Cada 30 minutos</option>
                <option value="0.75" ${reminder.intervalHours === 0.75 ? 'selected' : ''}>Cada 45 minutos</option>
                <option value="1" ${reminder.intervalHours === 1 ? 'selected' : ''}>Cada 1 hora</option>
                <option value="2" ${reminder.intervalHours === 2 ? 'selected' : ''}>Cada 2 horas</option>
              </select>
            </div>

            <!-- Email Notification Section -->
            <div style="background-color: var(--bg-input); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: var(--text-xs); font-weight: var(--fw-semibold); color: var(--text-primary);">
                  Notificar a mi correo electrónico
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
                    <span class="email-choice-title" style="font-size: 11.5px;">Correo de mi cuenta</span>
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

            <button class="btn btn-secondary" id="btn-save-reminder" style="width: 100%; margin-top: var(--space-3); font-size: var(--text-xs);">
              Guardar Configuración
            </button>
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
        
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        const enabled = $('#toggle-water-reminder', this.container)?.checked || false;
        const interval = parseFloat($('#reminder-interval-select', this.container)?.value || '1');
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

        if (enabled) {
          notificationScheduler.addNotification({
            id: 'notif-water-reminder',
            title: 'Recordatorio de Hidratación Activado',
            description: `Avisos programados cada ${interval} horas en tu computadora${emailNotification ? ` y a ${targetEmail}` : ''}.`,
            priority: 'medium',
            type: 'hydration'
          });
          toast.success(`Recordatorio de hidratación guardado para ${targetEmail}`);
        } else {
          notificationScheduler.removeNotification('notif-water-reminder');
          toast.info('Recordatorio de hidratación desactivado');
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
