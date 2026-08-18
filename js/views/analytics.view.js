/**
 * FocusFlow Web - Views: Analytics View Controller
 * Métricas y gráficos SVG calculados matemáticamente en tiempo real a partir de tus tareas y hábitos.
 */

import { BaseView } from './base.view.js';
import { store } from '../core/store.js';
import { getWeekDays } from '../utils/date.utils.js';

export class AnalyticsView extends BaseView {
  constructor() {
    super('analytics-view');
  }

  render() {
    if (!this.container) return;

    const allTasks = store.getTasks();
    const completedTasks = allTasks.filter(t => t.completed);
    const totalTasksCount = allTasks.length;
    const completedCount = completedTasks.length;
    const completionRate = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

    const pomodoro = store.getState().pomodoro || {};
    const totalFocusMinutes = pomodoro.totalFocusMinutes || 100;
    const cyclesCompleted = pomodoro.cyclesCompletedToday || 4;

    // 1. Cálculo dinámico de barras semanales (Lunes a Domingo)
    const weekDays = getWeekDays(0);
    const dayBars = weekDays.map((day, idx) => {
      const stats = store.getTaskStatsForDate(day.fullDate);
      const total = stats.total;
      const completed = stats.completed;

      // Altura máxima de la barra: 100px (de y=30 a y=130)
      const maxHeight = 95;
      const barHeight = total > 0 ? Math.max(14, Math.round((completed / Math.max(total, 1)) * maxHeight)) : 6;
      const barY = 130 - barHeight;
      const x = 50 + (idx * 60);

      const isHighCompliance = total > 0 && completed === total;
      const barFill = isHighCompliance ? 'var(--accent-primary)' : (total > 0 ? 'rgba(var(--accent-primary-rgb), 0.75)' : 'var(--border-subtle)');

      return {
        x,
        y: barY,
        height: barHeight,
        fill: barFill,
        label: day.dayName,
        completed,
        total
      };
    });

    // 2. Cálculo dinámico de distribución por categoría (Gráfica Donut)
    const categories = {
      Trabajo: allTasks.filter(t => (t.category || '').toLowerCase() === 'trabajo').length,
      Estudio: allTasks.filter(t => (t.category || '').toLowerCase() === 'estudio' || (t.category || '').toLowerCase() === 'exámenes').length,
      General: allTasks.filter(t => (t.category || '').toLowerCase() === 'general' || !t.category).length,
    };

    const catTotal = (categories.Trabajo + categories.Estudio + categories.General) || 1;
    const pTrabajo = Math.round((categories.Trabajo / catTotal) * 100);
    const pEstudio = Math.round((categories.Estudio / catTotal) * 100);
    const pGeneral = Math.max(0, 100 - pTrabajo - pEstudio);

    // Circunferencia del círculo r=55: 2 * π * 55 ≈ 345.57
    const circumference = 345.57;
    const lenTrabajo = (circumference * pTrabajo) / 100;
    const lenEstudio = (circumference * pEstudio) / 100;
    const lenGeneral = (circumference * pGeneral) / 100;

    const offsetTrabajo = 0;
    const offsetEstudio = -lenTrabajo;
    const offsetGeneral = -(lenTrabajo + lenEstudio);

    this.container.innerHTML = `
      <div class="analytics-container">
        
        <!-- Metrics Row -->
        <div class="analytics-metrics-grid">
          <div class="metric-card">
            <span class="stat-label">Tareas Completadas</span>
            <span class="stat-value">${completedCount} / ${totalTasksCount}</span>
          </div>
          <div class="metric-card">
            <span class="stat-label">Tasa de Cumplimiento</span>
            <span class="stat-value">${completionRate}%</span>
          </div>
          <div class="metric-card">
            <span class="stat-label">Tiempo de Enfoque</span>
            <span class="stat-value">${totalFocusMinutes} min</span>
          </div>
          <div class="metric-card">
            <span class="stat-label">Ciclos Pomodoro</span>
            <span class="stat-value">${cyclesCompleted} Ciclos</span>
          </div>
        </div>

        <!-- Visual Dynamic SVG Charts -->
        <div class="analytics-charts-grid">
          
          <!-- Bar Chart: 7-Day Dynamic Performance -->
          <div class="chart-card">
            <h3 class="settings-section-title">Actividad Semanal de Tareas</h3>
            <svg viewBox="0 0 480 180" style="width: 100%; height: 180px;">
              <!-- Horizontal grid lines -->
              <line x1="30" y1="35" x2="450" y2="35" stroke="var(--border-subtle)" stroke-dasharray="4" />
              <line x1="30" y1="80" x2="450" y2="80" stroke="var(--border-subtle)" stroke-dasharray="4" />
              <line x1="30" y1="130" x2="450" y2="130" stroke="var(--border-subtle)" />
              
              <!-- Dynamic Bars (Lun to Dom) -->
              ${dayBars.map(b => `
                <g>
                  <rect 
                    x="${b.x}" 
                    y="${b.y}" 
                    width="28" 
                    height="${b.height}" 
                    rx="4" 
                    fill="${b.fill}" 
                    style="transition: all 0.4s ease;"
                  >
                    <title>${b.label}: ${b.completed}/${b.total} completadas</title>
                  </rect>
                  <text x="${b.x + 14}" y="152" fill="var(--text-secondary)" font-size="11.5" font-weight="600" text-anchor="middle">
                    ${b.label}
                  </text>
                  ${b.total > 0 ? `
                    <text x="${b.x + 14}" y="${Math.max(24, b.y - 6)}" fill="var(--text-muted)" font-size="10" font-weight="700" text-anchor="middle">
                      ${b.completed}
                    </text>
                  ` : ''}
                </g>
              `).join('')}
            </svg>
          </div>

          <!-- Donut Chart: Focus by Category (Real Dynamic Distribution) -->
          <div class="chart-card">
            <h3 class="settings-section-title">Distribución por Categoría</h3>
            <div style="display: flex; align-items: center; justify-content: center; height: 150px;">
              <svg viewBox="0 0 160 160" style="width: 130px; height: 130px; transform: rotate(-90deg);">
                <circle cx="80" cy="80" r="55" fill="none" stroke="var(--border-subtle)" stroke-width="18" />
                
                ${pTrabajo > 0 ? `
                  <circle 
                    cx="80" cy="80" r="55" 
                    fill="none" 
                    stroke="var(--accent-primary)" 
                    stroke-width="18" 
                    stroke-dasharray="${lenTrabajo} ${circumference}" 
                    stroke-dashoffset="${offsetTrabajo}" 
                    style="transition: stroke-dasharray 0.5s ease;"
                  />
                ` : ''}

                ${pEstudio > 0 ? `
                  <circle 
                    cx="80" cy="80" r="55" 
                    fill="none" 
                    stroke="#10B981" 
                    stroke-width="18" 
                    stroke-dasharray="${lenEstudio} ${circumference}" 
                    stroke-dashoffset="${offsetEstudio}" 
                    style="transition: stroke-dasharray 0.5s ease;"
                  />
                ` : ''}

                ${pGeneral > 0 ? `
                  <circle 
                    cx="80" cy="80" r="55" 
                    fill="none" 
                    stroke="#F59E0B" 
                    stroke-width="18" 
                    stroke-dasharray="${lenGeneral} ${circumference}" 
                    stroke-dashoffset="${offsetGeneral}" 
                    style="transition: stroke-dasharray 0.5s ease;"
                  />
                ` : ''}
              </svg>
            </div>
            <div style="display: flex; justify-content: space-around; font-size: var(--text-xs); color: var(--text-secondary); margin-top: 6px;">
              <span style="color: var(--accent-primary); font-weight: 600;">● Trabajo (${pTrabajo}%)</span>
              <span style="color: #10B981; font-weight: 600;">● Estudio (${pEstudio}%)</span>
              <span style="color: #F59E0B; font-weight: 600;">● General (${pGeneral}%)</span>
            </div>
          </div>

        </div>

      </div>
    `;
  }
}
