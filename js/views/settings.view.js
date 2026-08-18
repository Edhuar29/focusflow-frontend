/**
 * FocusFlow Web - Views: Settings View Controller
 * Gestión de perfil, paleta de colores y exportación/importación de datos.
 */

import { BaseView } from './base.view.js';
import { store } from '../core/store.js';
import { soundService } from '../services/sound.service.js';
import { toast } from '../components/toast.component.js';
import { StorageService } from '../services/storage.service.js';
import { $, escapeHTML } from '../utils/dom.utils.js';

export class SettingsView extends BaseView {
  constructor() {
    super('settings-view');
  }

  render() {
    if (!this.container) return;

    const currentAccent = store.getState().accent;

    this.container.innerHTML = `
      <div class="settings-container">
        
        <!-- 1. Paleta de Acentos de Color -->
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

        <!-- 2. Seguridad y Gestión de Datos (Offline-First) -->
        <div class="settings-section">
          <h3 class="settings-section-title">Seguridad y Respaldo de Datos</h3>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-3);">
            Tus datos están protegidos en tu almacenamiento local cifrado. Puedes exportar un respaldo en cualquier momento:
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
              <span>Restablecer a Estado Inicial</span>
            </button>
          </div>
        </div>

      </div>
    `;
  }

  bindEvents() {
    if (!this.container) return;

    // Selector de paleta de colores
    const swatches = this.container.querySelectorAll('[data-accent-choice]');
    swatches.forEach(swatch => {
      swatch.onclick = () => {
        const choice = swatch.getAttribute('data-accent-choice');
        soundService.playClick();
        store.setAccent(choice);
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        toast.info(`Color de acento actualizado`);
      };
    });

    // Exportar JSON
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

    // Exportar CSV de tareas
    const exportCsvBtn = $('#btn-export-csv', this.container);
    if (exportCsvBtn) {
      exportCsvBtn.onclick = () => {
        soundService.playClick();
        const tasks = store.getTasks();
        const headers = 'ID,Titulo,Prioridad,Fecha,Hora,Categoria,Completada\n';
        const rows = tasks.map(t => 
          `"${t.id}","${t.title.replace(/"/g, '""')}","${t.priorities[0] || 'medium'}","${t.date}","${t.time}","${t.category || 'General'}","${t.completed ? 'Si' : 'No'}"`
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

    // Resetear a estado de fábrica
    const resetBtn = $('#btn-reset-data', this.container);
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (confirm('¿Estás seguro de que deseas reiniciar todas las tareas y configuraciones a su estado original?')) {
          soundService.playClick();
          StorageService.clearAll();
          window.location.reload();
        }
      };
    }
  }
}
