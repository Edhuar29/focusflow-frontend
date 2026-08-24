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
    const accountEmail = (currentUser && currentUser.email) ? currentUser.email : 'edhuflow.official@gmail.com';
    
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

            <!-- Horario Programado y Frecuencia -->
            <div style="margin-bottom: var(--space-3); background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px;">
              
              <!-- 1. Hora de Inicio y Fin -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div>
                  <label for="water-start-time" style="font-size: 11px; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">
                    Hora de Inicio:
                  </label>
                  <input 
                    type="time" 
                    id="water-start-time" 
                    class="form-control" 
                    value="${reminder.startTime || '08:00'}" 
                    style="padding: 6px 8px; font-size: var(--text-xs); cursor: pointer;" 
                  />
                </div>
                <div>
                  <label for="water-end-time" style="font-size: 11px; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">
                    Hora de Fin:
                  </label>
                  <input 
                    type="time" 
                    id="water-end-time" 
                    class="form-control" 
                    value="${reminder.endTime || '22:00'}" 
                    style="padding: 6px 8px; font-size: var(--text-xs); cursor: pointer;" 
                  />
                </div>
              </div>

              <!-- 2. Frecuencia / Cada cuánto suena -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label for="reminder-interval-select" style="font-size: 11px; font-weight: 600; color: var(--text-primary);">Repetir cada:</label>
                <span id="water-current-interval-badge" style="font-size: 10px; font-weight: 700; color: #38BDF8; background: rgba(56, 189, 248, 0.12); padding: 2px 7px; border-radius: 999px;">
                  Cada ${Math.max(1, Math.round(parseFloat(reminder.intervalHours || 0.25) * 60))} min
                </span>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <select id="reminder-interval-select" class="form-control" style="flex: 1; min-width: 160px; padding: 7px 10px; font-size: var(--text-xs); cursor: pointer;">
                  <option value="0.0833" ${Math.abs((reminder.intervalHours || 0.25) - 0.0833) < 0.01 ? 'selected' : ''}>Cada 5 minutos (Prueba rápida)</option>
                  <option value="0.1666" ${Math.abs((reminder.intervalHours || 0.25) - 0.1666) < 0.01 ? 'selected' : ''}>Cada 10 minutos</option>
                  <option value="0.25" ${Math.abs((reminder.intervalHours || 0.25) - 0.25) < 0.01 ? 'selected' : ''}>Cada 15 minutos</option>
                  <option value="0.3333" ${Math.abs((reminder.intervalHours || 0.25) - 0.3333) < 0.01 ? 'selected' : ''}>Cada 20 minutos</option>
                  <option value="0.5" ${Math.abs((reminder.intervalHours || 0.25) - 0.5) < 0.01 ? 'selected' : ''}>Cada 30 minutos</option>
                  <option value="0.75" ${Math.abs((reminder.intervalHours || 0.25) - 0.75) < 0.01 ? 'selected' : ''}>Cada 45 minutos</option>
                  <option value="1" ${Math.abs((reminder.intervalHours || 0.25) - 1) < 0.01 ? 'selected' : ''}>Cada 1 hora (Recomendado)</option>
                  <option value="1.5" ${Math.abs((reminder.intervalHours || 0.25) - 1.5) < 0.01 ? 'selected' : ''}>Cada 1 hora y media</option>
                  <option value="2" ${Math.abs((reminder.intervalHours || 0.25) - 2) < 0.01 ? 'selected' : ''}>Cada 2 horas</option>
                  <option value="3" ${Math.abs((reminder.intervalHours || 0.25) - 3) < 0.01 ? 'selected' : ''}>Cada 3 horas</option>
                  <option value="custom" ${![0.0833, 0.1666, 0.25, 0.3333, 0.5, 0.75, 1, 1.5, 2, 3].some(p => Math.abs((reminder.intervalHours || 0.25) - p) < 0.01) ? 'selected' : ''}>Personalizado en minutos...</option>
                </select>
                <div id="custom-minutes-wrap" style="display: ${![0.0833, 0.1666, 0.25, 0.3333, 0.5, 0.75, 1, 1.5, 2, 3].some(p => Math.abs((reminder.intervalHours || 0.25) - p) < 0.01) ? 'flex' : 'none'}; align-items: center; gap: 6px; width: 100%;">
                  <input type="number" id="input-custom-water-minutes" class="form-control" placeholder="Minutos (ej. 7, 12, 25)" min="1" max="720" value="${Math.max(1, Math.round(parseFloat(reminder.intervalHours || 0.25) * 60))}" style="flex: 1; padding: 6px 10px; font-size: var(--text-xs);" />
                  <span style="font-size: var(--text-xs); color: var(--text-muted);">minutos</span>
                </div>
              </div>

              <!-- Indicador visual de horario -->
              <div id="water-schedule-preview" style="margin-top: 8px; font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #38BDF8;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Programado desde las <strong>${reminder.startTime || '08:00'}</strong> hasta las <strong>${reminder.endTime || '22:00'}</strong></span>
              </div>
            </div>

            <!-- Email Notification Section -->
            <div style="background-color: var(--bg-input); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: var(--space-3);">
              <label for="toggle-water-email" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer;">
                <span style="font-size: var(--text-xs); font-weight: var(--fw-semibold); color: var(--text-primary);">
                  Enviar aviso a mi correo electrónico
                </span>
                <input type="checkbox" id="toggle-water-email" ${reminder.emailNotification !== false ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: #38BDF8;" />
              </label>

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
                <!-- Botón de Acción Principal -->
            <div style="margin-top: var(--space-4);">
              <button class="btn btn-primary" id="btn-save-reminder" style="width: 100%; font-size: var(--text-sm); padding: 11px 16px; font-weight: 700; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(14, 165, 233, 0.3); transition: all 0.2s ease; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <span>Guardar Configuración</span>
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
    const accountEmail = (currentUser && currentUser.email) ? currentUser.email : 'edhuflow.official@gmail.com';

    const choiceAccount = $('#water-choice-account', this.container);
    const choiceCustom = $('#water-choice-custom', this.container);
    const emailInput = $('#water-reminder-email', this.container);

    let isCustomSelected = choiceCustom ? choiceCustom.classList.contains('active') : false;

    // 1. Alternador de modo de correo en Hidratación
    if (choiceAccount && choiceCustom && emailInput) {
      choiceAccount.onclick = () => {
        soundService.playClick();
        isCustomSelected = false;
        choiceAccount.classList.add('active');
        choiceCustom.classList.remove('active');
        emailInput.value = accountEmail;
        emailInput.readOnly = true;
        emailInput.style.opacity = '0.85';
        emailInput.style.cursor = 'default';
      };

      choiceCustom.onclick = () => {
        soundService.playClick();
        isCustomSelected = true;
        choiceCustom.classList.add('active');
        choiceAccount.classList.remove('active');
        emailInput.readOnly = false;
        emailInput.style.opacity = '1';
        emailInput.style.cursor = 'text';
        emailInput.focus();
      };
    }

    // 1.1 Manejo visual del intervalo y horario
    const intervalSelect = $('#reminder-interval-select', this.container);
    const customWrap = $('#custom-minutes-wrap', this.container);
    const customInput = $('#input-custom-water-minutes', this.container);
    const intervalBadge = $('#water-current-interval-badge', this.container);
    const startTimeInput = $('#water-start-time', this.container);
    const endTimeInput = $('#water-end-time', this.container);
    const schedulePreview = $('#water-schedule-preview', this.container);

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
      if (schedulePreview && startTimeInput && endTimeInput) {
        schedulePreview.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #38BDF8;">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Programado desde las <strong>${startTimeInput.value || '08:00'}</strong> hasta las <strong>${endTimeInput.value || '22:00'}</strong></span>
        `;
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

    if (startTimeInput) startTimeInput.onchange = updateIntervalDisplay;
    if (endTimeInput) endTimeInput.onchange = updateIntervalDisplay;

    // 2. Botón de Tomar Agua (+250 ml)
    const drinkBtn = $('#btn-drink-water-single', this.container);
    if (drinkBtn) {
      drinkBtn.onclick = () => {
        soundService.playTaskComplete();
        const data = store.logWater(250);
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

    // 4. Botón de Guardar Configuración (Acción Principal)
    const saveReminderBtn = $('#btn-save-reminder', this.container);
    if (saveReminderBtn) {
      saveReminderBtn.onclick = async () => {
        soundService.playClick();

        // 4.1 Pedir permiso de notificación nativa de pantalla al navegador si está en default
        if ('Notification' in window && Notification.permission === 'default') {
          try {
            await notificationService.requestPermission();
          } catch (e) {}
        }

        // 4.2 Calcular intervalo en horas y minutos
        let interval = 1;
        let totalMinutes = 60;
        if (intervalSelect && intervalSelect.value === 'custom') {
          totalMinutes = parseInt(customInput ? customInput.value : '30', 10) || 30;
          totalMinutes = Math.max(1, totalMinutes);
          interval = totalMinutes / 60;
        } else if (intervalSelect) {
          interval = parseFloat(intervalSelect.value) || 1;
          totalMinutes = Math.max(1, Math.round(interval * 60));
        }

        const enabled = $('#toggle-water-reminder', this.container)?.checked || false;
        const startTime = $('#water-start-time', this.container)?.value || '08:00';
        const endTime = $('#water-end-time', this.container)?.value || '22:00';
        const emailCheckbox = $('#toggle-water-email', this.container);
        const emailNotification = emailCheckbox ? emailCheckbox.checked : true;
        const inputEmail = emailInput ? emailInput.value.trim() : accountEmail;
        const targetEmail = isCustomSelected ? inputEmail : accountEmail;

        if (emailNotification && isCustomSelected && (!targetEmail || !targetEmail.includes('@'))) {
          toast.warning('Por favor ingresa un correo electrónico válido');
          emailInput?.focus();
          return;
        }

        // Estado visual de guardado en el botón
        const originalBtnHTML = saveReminderBtn.innerHTML;
        saveReminderBtn.disabled = true;
        saveReminderBtn.innerHTML = `<span>⏳ Guardando cambios...</span>`;

        try {
          // Guardar en el Store reactivo y StorageService
          const data = store.getState().hydration;
          data.reminder = {
            enabled,
            startTime,
            endTime,
            intervalHours: interval,
            emailNotification,
            useCustomEmail: isCustomSelected,
            email: targetEmail
          };

          store._persistAndNotify('hydration', data, 'hydration:updated');
          
          store.setEmailPreferences({
            emailWaterAlerts: emailNotification,
            notificationEmail: targetEmail,
            useCustomEmail: isCustomSelected
          });

          // Sincronizar de forma permanente con el servidor backend / nube
          await apiService.saveWaterReminderConfig({
            email: targetEmail,
            startTime,
            endTime,
            intervalMinutes: totalMinutes,
            enabled: !!emailNotification && !!enabled,
          });

          notificationScheduler.resetWaterTimer();

          // Feedback visual exitoso en botón
          saveReminderBtn.innerHTML = `<span>✓ ¡Configuración Guardada!</span>`;
          saveReminderBtn.style.background = '#10B981';

          if (enabled) {
            toast.success(`✓ Alarma de agua configurada de ${startTime} a ${endTime} (cada ${totalMinutes} min)`);
            if ('Notification' in window && Notification.permission === 'denied') {
              toast.warning('Notificaciones de escritorio bloqueadas en tu navegador. Actívalas en la barra de direcciones.');
            }
          } else {
            toast.info('Recordatorio de hidratación desactivado');
          }

          setTimeout(() => {
            saveReminderBtn.disabled = false;
            saveReminderBtn.innerHTML = originalBtnHTML;
            saveReminderBtn.style.background = '';
          }, 2000);

        } catch (err) {
          console.warn('[HydrationView] Error guardando configuración:', err);
          saveReminderBtn.disabled = false;
          saveReminderBtn.innerHTML = originalBtnHTML;
          toast.error('Error al sincronizar con el servidor. Intenta de nuevo.');
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
