/**
 * FocusFlow Web - View: Hydration View Controller
 * Actualizaciones visuales fluidas sin bloqueo ni destrucción del DOM.
 */

import { BaseView } from './base.view.js';
import { soundService } from '../services/sound.service.js';
import { toast } from '../components/toast.component.js';
import { store } from '../core/store.js';
import { eventBus } from '../core/event-bus.js';
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
    
    const remainingMl = Math.max(0, goal - consumed);
    const remainingPercent = Math.min(100, Math.max(0, Math.round((remainingMl / goal) * 100)));

    // Coordenadas SVG en viewBox 0 0 100 200
    const totalCavityHeight = 152;
    const waterHeight = (totalCavityHeight * remainingPercent) / 100;
    const waterY = 186 - waterHeight;

    const reminder = data.reminder || {
      enabled: false,
      intervalHours: 1,
      emailNotification: false,
      email: 'demo@focusflow.app'
    };

    this.container.innerHTML = `
      <div class="hydration-container">
        
        <!-- Bottle Graphic Card with Realistic Emptying Physics -->
        <div class="bottle-visual-card">
          <svg class="hydration-bottle-svg" viewBox="0 0 100 200">
            <defs>
              <linearGradient id="water-fluid-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#38BDF8" />
                <stop offset="50%" stop-color="#0284C7" />
                <stop offset="100%" stop-color="#1D4ED8" />
              </linearGradient>

              <clipPath id="bottle-liquid-clip">
                <rect x="19" y="35" width="62" height="150" rx="15" />
              </clipPath>
            </defs>

            <!-- Tapa y Cuello -->
            <rect x="36" y="10" width="28" height="14" rx="4" fill="#1E293B" stroke="#334155" stroke-width="2" />
            <rect x="42" y="24" width="16" height="12" fill="#0F172A" stroke="#334155" stroke-width="1.5" />

            <!-- Fondo interior oscuro del cristal -->
            <rect x="18" y="34" width="64" height="152" rx="16" fill="rgba(15, 23, 42, 0.9)" />

            <!-- Líquido reactivo -->
            <g clip-path="url(#bottle-liquid-clip)" id="bottle-water-group">
              <rect 
                id="svg-water-rect"
                x="15" 
                y="${waterY}" 
                width="70" 
                height="${waterHeight + 8}" 
                fill="url(#water-fluid-gradient)" 
                style="transition: y 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.5s cubic-bezier(0.4, 0, 0.2, 1);"
              />
              <ellipse 
                id="svg-water-surface"
                cx="50" 
                cy="${waterY}" 
                rx="30" 
                ry="4.5" 
                fill="#BAE6FD" 
                opacity="${waterHeight > 3 && remainingPercent < 98 ? '0.9' : '0'}"
                style="transition: cy 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;"
              />
            </g>

            <!-- Contorno exterior de cristal y marcas -->
            <rect x="18" y="34" width="64" height="152" rx="16" fill="none" stroke="#38BDF8" stroke-width="2.5" stroke-opacity="0.4" />
            
            <line x1="68" y1="65" x2="76" y2="65" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" />
            <line x1="68" y1="105" x2="76" y2="105" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" />
            <line x1="68" y1="145" x2="76" y2="145" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" />

            <line x1="24" y1="45" x2="24" y2="175" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round" />
          </svg>

          <div style="margin-top: var(--space-4); text-align: center;">
            <div class="hydration-progress-text" id="hydration-progress-text">${consumed} / ${goal} ml</div>
            <div class="hydration-goal-label" id="hydration-goal-label">
              ${consumed >= goal 
                ? '¡Meta diaria completada! Botella vacía.' 
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
              Recibe avisos periódicos en tu computadora para mantener tu nivel de concentración.
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

            <!-- Email Notification Toggle -->
            <div style="background-color: var(--bg-input); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-size: var(--text-xs); font-weight: var(--fw-semibold); color: var(--text-primary);">
                  Notificar a mi correo electrónico
                </span>
                <input type="checkbox" id="toggle-water-email" ${reminder.emailNotification ? 'checked' : ''} style="cursor: pointer;" />
              </div>
              <input 
                type="email" 
                id="water-reminder-email" 
                class="form-control" 
                placeholder="tu-correo@ejemplo.com" 
                value="${escapeHTML(reminder.email || 'demo@focusflow.app')}"
                style="padding: 6px 10px; font-size: var(--text-xs);"
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

    // 1. Botón de Tomar Agua (+250 ml)
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

    // 2. Botón de Reiniciar Botella
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

    // 3. Guardar Recordatorio (No bloqueante, sin recargar todo el DOM)
    const saveReminderBtn = $('#btn-save-reminder', this.container);
    if (saveReminderBtn) {
      saveReminderBtn.onclick = () => {
        soundService.playClick();
        
        // Solicitar permisos de escritorio sin bloquear el hilo principal
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        const enabled = $('#toggle-water-reminder', this.container)?.checked || false;
        const interval = parseFloat($('#reminder-interval-select', this.container)?.value || '1');
        const emailNotification = $('#toggle-water-email', this.container)?.checked || false;
        const email = $('#water-reminder-email', this.container)?.value.trim() || 'demo@focusflow.app';

        const data = store.getState().hydration;
        data.reminder = {
          enabled,
          intervalHours: interval,
          emailNotification,
          email
        };

        store._persistAndNotify('hydration', data, 'hydration:updated');
        
        if (enabled) {
          notificationScheduler.addNotification({
            id: 'notif-water-reminder',
            title: 'Recordatorio de Hidratación Activado',
            description: `Avisos programados cada ${interval} horas en tu computadora${emailNotification ? ` y a ${email}` : ''}.`,
            priority: 'medium',
            type: 'hydration'
          });
          toast.success(`Recordatorio activo cada ${interval}h`);
        } else {
          notificationScheduler.removeNotification('notif-water-reminder');
          toast.info('Recordatorio de hidratación desactivado');
        }
      };
    }

    // 4. Suscripción a eventos externos (ej. registrar desde la campana)
    if (this.unsubscribeHydration) this.unsubscribeHydration();
    this.unsubscribeHydration = eventBus.on('hydration:updated', () => {
      this._updateBottleUI();
    });
  }

  /**
   * Actualiza fluidamente solo el SVG y los textos sin destruir el DOM ni los botones
   */
  _updateBottleUI() {
    if (!this.container) return;

    const data = store.getState().hydration;
    const goal = data.goalMl || 2000;
    const consumed = data.currentMl || 0;

    const remainingMl = Math.max(0, goal - consumed);
    const remainingPercent = Math.min(100, Math.max(0, Math.round((remainingMl / goal) * 100)));

    const totalCavityHeight = 152;
    const waterHeight = (totalCavityHeight * remainingPercent) / 100;
    const waterY = 186 - waterHeight;

    const waterRect = $('#svg-water-rect', this.container);
    const waterSurface = $('#svg-water-surface', this.container);
    const progressText = $('#hydration-progress-text', this.container);
    const goalLabel = $('#hydration-goal-label', this.container);
    const logsText = $('#hydration-logs-text', this.container);

    if (waterRect) {
      waterRect.setAttribute('y', waterY);
      waterRect.setAttribute('height', waterHeight + 8);
    }

    if (waterSurface) {
      waterSurface.setAttribute('cy', waterY);
      waterSurface.style.opacity = (waterHeight > 3 && remainingPercent < 98) ? '0.9' : '0';
    }

    if (progressText) {
      progressText.textContent = `${consumed} / ${goal} ml`;
    }

    if (goalLabel) {
      goalLabel.textContent = consumed >= goal
        ? '¡Meta diaria completada! Botella vacía.'
        : `Restante por beber: ${remainingMl} ml (${remainingPercent}%)`;
    }

    if (logsText) {
      logsText.textContent = `${data.logsToday || 0} tomas registradas hoy`;
    }
  }

  unmount() {
    if (this.unsubscribeHydration) {
      this.unsubscribeHydration();
      this.unsubscribeHydration = null;
    }
    super.unmount();
  }
}
