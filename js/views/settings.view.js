/**
 * FocusFlow Web - Views: Settings View Controller
 * Gestión de perfil, selector interactivo de correo (cuenta creada vs correo personalizado),
 * paleta de colores y exportación de datos. Libre de emojis, con iconos SVG profesionales.
 */

import { BaseView } from './base.view.js';
import { store } from '../core/store.js';
import { soundService } from '../services/sound.service.js';
import { toast } from '../components/toast.component.js';
import { apiService } from '../services/api.service.js';
import { StorageService } from '../services/storage.service.js';
import { $, escapeHTML } from '../utils/dom.utils.js';

export class SettingsView extends BaseView {
  constructor() {
    super('settings-view');
  }

  render() {
    if (!this.container) return;

    const currentAccent = store.getState().accent || 'cobalt';
    const emailPrefs = store.getEmailPreferences();
    const currentUser = store.getUser();
    const accountEmail = (currentUser && currentUser.email) ? currentUser.email : 'dannyeduardoanasi@gmail.com';
    
    // Determinar si usa el correo de su cuenta o uno personalizado
    const isCustomEmail = emailPrefs.useCustomEmail === true && emailPrefs.notificationEmail && emailPrefs.notificationEmail !== accountEmail;
    const activeEmail = isCustomEmail ? emailPrefs.notificationEmail : accountEmail;

    this.container.innerHTML = `
      <div class="settings-container">
        
        <!-- 1. Notificaciones y Correo Electrónico -->
        <div class="settings-section">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-primary);">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <h3 class="settings-section-title" style="margin: 0;">Notificaciones y Correo Electrónico</h3>
          </div>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
            Elige si deseas recibir las alertas de tareas e hidratación en el correo de tu cuenta registrada o en un correo alternativo:
          </p>

          <div style="display: flex; flex-direction: column; gap: var(--space-4); max-width: 600px;">
            
            <!-- Selector de Modo: Correo de Cuenta vs Correo Alternativo -->
            <div class="email-choice-group">
              
              <div class="email-choice-card ${!isCustomEmail ? 'active' : ''}" id="choice-account-email">
                <div class="email-choice-radio">
                  <div class="email-choice-radio-inner"></div>
                </div>
                <div>
                  <span class="email-choice-title">Correo de mi cuenta</span>
                  <span class="email-choice-desc">${escapeHTML(accountEmail)}</span>
                </div>
              </div>

              <div class="email-choice-card ${isCustomEmail ? 'active' : ''}" id="choice-custom-email">
                <div class="email-choice-radio">
                  <div class="email-choice-radio-inner"></div>
                </div>
                <div>
                  <span class="email-choice-title">Usar otro correo</span>
                  <span class="email-choice-desc">Outlook, Yahoo o institucional</span>
                </div>
              </div>

            </div>

            <!-- Campo de Correo Electrónico -->
            <div class="form-group" style="margin-bottom: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" for="settings-notification-email" style="margin: 0;">Dirección de Destino para Alertas</label>
                <span id="email-mode-badge" style="font-size: 11px; color: ${!isCustomEmail ? '#38BDF8' : 'var(--text-muted)'}; font-weight: 500;">
                  ${!isCustomEmail ? 'Sincronizado con tu cuenta' : 'Modo personalizado activo'}
                </span>
              </div>
              
              <div style="position: relative; display: flex; align-items: center;">
                <input 
                  type="email" 
                  id="settings-notification-email" 
                  class="form-control" 
                  placeholder="ejemplo@correo.com" 
                  value="${escapeHTML(activeEmail)}" 
                  ${!isCustomEmail ? 'readonly style="opacity: 0.85; cursor: default;"' : ''}
                  autocomplete="email"
                />
              </div>
              <span id="email-mode-help" style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px; display: block;">
                ${!isCustomEmail ? 'Las notificaciones llegarán al correo con el que iniciaste sesión.' : 'Escribe el correo alternativo donde deseas recibir los avisos.'}
              </span>
            </div>

            <!-- Toggles de alertas -->
            <div style="display: flex; flex-direction: column; gap: 12px; padding: 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <strong style="display: block; font-size: var(--text-sm); color: var(--text-primary);">Recordatorios de Tareas por Correo</strong>
                  <span style="font-size: 11.5px; color: var(--text-muted);">Recibe un aviso por correo cuando se cumpla la hora de una tarea programada</span>
                </div>
                <label class="custom-toggle">
                  <input type="checkbox" id="toggle-email-tasks" ${emailPrefs.emailTaskAlerts !== false ? 'checked' : ''} />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                <div>
                  <strong style="display: block; font-size: var(--text-sm); color: var(--text-primary);">Alertas de Hidratación por Correo</strong>
                  <span style="font-size: 11.5px; color: var(--text-muted);">Avisos periódicos para mantener tus objetivos de hidratación diaria</span>
                </div>
                <label class="custom-toggle">
                  <input type="checkbox" id="toggle-email-water" ${emailPrefs.emailWaterAlerts !== false ? 'checked' : ''} />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <!-- Botones de Acción -->
            <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
              <button class="btn btn-primary" id="btn-save-email-prefs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px;">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Guardar Preferencias de Correo</span>
              </button>

              <button class="btn btn-secondary" id="btn-send-test-email">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                <span>Enviar Correo de Prueba</span>
              </button>
            </div>

          </div>
        </div>

        <!-- 2. Paleta de Acentos de Color -->
        <div class="settings-section">
          <h3 class="settings-section-title">Paleta de Color de Acento</h3>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-3);">
            Personaliza el color distintivo en todas las vistas, botones e indicadores de la plataforma:
          </p>
          <div class="color-swatches-grid">
            <button class="color-swatch ${currentAccent === 'cobalt' ? 'active' : ''}" data-accent-choice="cobalt" title="Azul Cobalto" aria-label="Azul Cobalto"></button>
            <button class="color-swatch ${currentAccent === 'emerald' ? 'active' : ''}" data-accent-choice="emerald" title="Verde Esmeralda" aria-label="Verde Esmeralda"></button>
            <button class="color-swatch ${currentAccent === 'amber' ? 'active' : ''}" data-accent-choice="amber" title="Ámbar Dorado" aria-label="Ámbar Dorado"></button>
            <button class="color-swatch ${currentAccent === 'pink' ? 'active' : ''}" data-accent-choice="pink" title="Rosa Neón" aria-label="Rosa Neón"></button>
            <button class="color-swatch ${currentAccent === 'ocean' ? 'active' : ''}" data-accent-choice="ocean" title="Cian Océano" aria-label="Cian Océano"></button>
          </div>
        </div>

        <!-- 3. Seguridad y Gestión de Datos (Offline-First) -->
        <div class="settings-section">
          <h3 class="settings-section-title">Seguridad y Respaldo de Datos</h3>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-3);">
            Tus datos están protegidos en tu almacenamiento local y sincronizados con tu cuenta:
          </p>
          <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-export-json">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Exportar Respaldo JSON</span>
            </button>

            <button class="btn btn-secondary" id="btn-export-csv">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>Exportar Tareas en CSV</span>
            </button>

            <button class="btn btn-secondary" id="btn-reset-data" style="color: var(--color-danger); border-color: rgba(239, 68, 68, 0.4);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Restablecer Estado Local</span>
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

    const choiceAccount = $('#choice-account-email', this.container);
    const choiceCustom = $('#choice-custom-email', this.container);
    const emailInput = $('#settings-notification-email', this.container);
    const modeBadge = $('#email-mode-badge', this.container);
    const modeHelp = $('#email-mode-help', this.container);

    let isCustomSelected = choiceCustom ? choiceCustom.classList.contains('active') : false;

    // 1. Selector de opción: Correo de cuenta
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

        if (modeBadge) {
          modeBadge.textContent = 'Sincronizado con tu cuenta';
          modeBadge.style.color = '#38BDF8';
        }
        if (modeHelp) {
          modeHelp.textContent = 'Las notificaciones llegarán al correo con el que iniciaste sesión.';
        }
      };

      // Selector de opción: Usar otro correo
      choiceCustom.onclick = () => {
        soundService.playClick();
        choiceCustom.classList.add('active');
        choiceAccount.classList.remove('active');
        isCustomSelected = true;

        emailInput.readOnly = false;
        emailInput.style.opacity = '1';
        emailInput.style.cursor = 'text';
        emailInput.focus();

        if (modeBadge) {
          modeBadge.textContent = 'Modo personalizado activo';
          modeBadge.style.color = 'var(--accent-primary)';
        }
        if (modeHelp) {
          modeHelp.textContent = 'Escribe el correo alternativo donde deseas recibir los avisos.';
        }
      };
    }

    // 2. Guardar Preferencias de Correo
    const saveEmailBtn = $('#btn-save-email-prefs', this.container);
    if (saveEmailBtn) {
      saveEmailBtn.onclick = () => {
        const toggleTasks = $('#toggle-email-tasks', this.container);
        const toggleWater = $('#toggle-email-water', this.container);

        if (!emailInput) return;
        const email = emailInput.value.trim();

        if (isCustomSelected && (!email || !email.includes('@') || !email.includes('.'))) {
          toast.warning('Por favor ingresa un correo electrónico válido');
          emailInput.focus();
          return;
        }

        soundService.playClick();
        store.setEmailPreferences({
          useCustomEmail: isCustomSelected,
          notificationEmail: isCustomSelected ? email : accountEmail,
          emailTaskAlerts: toggleTasks ? toggleTasks.checked : true,
          emailWaterAlerts: toggleWater ? toggleWater.checked : true,
        });

        toast.success('Preferencias de correo guardadas correctamente');
      };
    }

    // 3. Enviar Correo de Prueba
    const testEmailBtn = $('#btn-send-test-email', this.container);
    if (testEmailBtn) {
      testEmailBtn.onclick = async () => {
        const targetEmail = emailInput ? emailInput.value.trim() : accountEmail;

        if (!targetEmail || !targetEmail.includes('@')) {
          toast.warning('Ingresa un correo válido antes de enviar la prueba');
          return;
        }

        soundService.playClick();
        testEmailBtn.disabled = true;
        const originalText = testEmailBtn.innerHTML;
        testEmailBtn.innerHTML = `<span>Enviando prueba a ${targetEmail}...</span>`;

        try {
          await apiService.sendTestEmail(targetEmail);
          toast.success(`Notificación de prueba enviada a ${targetEmail}`);
        } catch (err) {
          toast.info(`Prueba procesada para ${targetEmail}`);
        } finally {
          testEmailBtn.disabled = false;
          testEmailBtn.innerHTML = originalText;
        }
      };
    }

    // 4. Selector de paleta de colores
    const swatches = this.container.querySelectorAll('[data-accent-choice]');
    swatches.forEach(swatch => {
      swatch.onclick = () => {
        const choice = swatch.getAttribute('data-accent-choice');
        soundService.playClick();
        store.setAccent(choice);
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        toast.info('Color de acento actualizado');
      };
    });

    // 5. Exportar JSON
    const exportJsonBtn = $('#btn-export-json', this.container);
    if (exportJsonBtn) {
      exportJsonBtn.onclick = () => {
        soundService.playClick();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store.getState(), null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `focusflow-backup-${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        toast.success('Respaldo JSON descargado');
      };
    }

    // 6. Exportar CSV de tareas
    const exportCsvBtn = $('#btn-export-csv', this.container);
    if (exportCsvBtn) {
      exportCsvBtn.onclick = () => {
        soundService.playClick();
        const tasks = store.getTasks();
        const headers = 'ID,Titulo,Prioridad,Fecha,Hora,Categoria,Completada\n';
        const rows = tasks.map(t => 
          `"${t.id}","${t.title.replace(/"/g, '""')}","${t.priorities ? (t.priorities[0] || 'medium') : 'medium'}","${t.date}","${t.time}","${t.category || 'General'}","${t.completed ? 'Si' : 'No'}"`
        ).join('\n');

        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", csvContent);
        downloadAnchor.setAttribute("download", `focusflow-tareas-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        toast.success('Archivo CSV de tareas descargado');
      };
    }

    // 7. Resetear a estado local
    const resetBtn = $('#btn-reset-data', this.container);
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (confirm('¿Deseas reiniciar las tareas y métricas de este usuario a su estado inicial?')) {
          soundService.playClick();
          store.logout();
          window.location.reload();
        }
      };
    }
  }
}
