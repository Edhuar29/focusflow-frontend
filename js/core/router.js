/**
 * FocusFlow Web - Core: SPA Router
 * Enrutador modular para navegación entre módulos independientes con ciclo de vida.
 */

import { $, $$ } from '../utils/dom.utils.js';
import { soundService } from '../services/sound.service.js';

export class Router {
  constructor(routes, defaultRoute = 'dashboard') {
    this.routes = routes;
    this.defaultRoute = defaultRoute;
    this.currentRoute = null;
    this.currentViewInstance = null;

    this._init();
  }

  _init() {
    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();
  }

  _handleRoute() {
    const rawHash = window.location.hash.replace(/^#\/?/, '');
    const routeName = rawHash || this.defaultRoute;

    if (!this.routes[routeName]) {
      this.navigate(this.defaultRoute);
      return;
    }

    this._switchView(routeName);
  }

  _switchView(routeName) {
    if (this.currentRoute === routeName && this.currentViewInstance) return;

    // 1. Desmontar vista anterior
    if (this.currentViewInstance && typeof this.currentViewInstance.unmount === 'function') {
      try {
        this.currentViewInstance.unmount();
      } catch (e) {
        console.warn('Error desmontando vista:', e);
      }
    }

    // 2. Ocultar todos los contenedores de vista
    const allViews = $$('.spa-view');
    allViews.forEach(v => v.classList.remove('active'));

    // 3. Actualizar enlaces activos en la barra lateral
    const navItems = $$('.nav-item');
    navItems.forEach(item => {
      const linkHash = item.getAttribute('href')?.replace(/^#\/?/, '');
      if (linkHash === routeName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 4. Actualizar título del Topbar
    try {
      this._updateTopbarTitle(routeName);
    } catch (e) {}

    // 5. Montar y mostrar nueva vista
    const targetContainer = $(`#${routeName}-view`);
    if (targetContainer) {
      targetContainer.classList.add('active');
      const ViewClass = this.routes[routeName];
      if (ViewClass) {
        try {
          this.currentViewInstance = new ViewClass();
          this.currentViewInstance.mount();
        } catch (err) {
          console.error(`Error al montar vista ${routeName}:`, err);
        }
      }
    }

    this.currentRoute = routeName;
  }

  _updateTopbarTitle(routeName) {
    const greetingEl = $('.topbar-greeting');
    const titleEl = $('.topbar-title');

    const titles = {
      dashboard: { greeting: 'Visión General:', title: 'Dashboard Ejecutivo' },
      tasks: { greeting: 'Organización Diaria:', title: 'Tareas & Horarios' },
      pomodoro: { greeting: 'Sesión de Concentración:', title: 'Temporizador Pomodoro' },
      hydration: { greeting: 'Salud & Bienestar:', title: 'Control de Hidratación' },
      assistant: { greeting: 'Inteligencia Productiva:', title: 'Asistente IA Gemini' },
      analytics: { greeting: 'Rendimiento Semanal:', title: 'Estadísticas & Reportes' },
      settings: { greeting: 'Personalización:', title: 'Ajustes & Preferencias' }
    };

    const info = titles[routeName] || titles.dashboard;
    if (greetingEl) greetingEl.textContent = info.greeting;
    if (titleEl) titleEl.textContent = info.title;
  }

  navigate(routeName) {
    soundService.playClick();
    window.location.hash = `#/${routeName}`;
  }
}
