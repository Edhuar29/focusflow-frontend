/**
 * FocusFlow Web - Components: Auth Modal & Screen Controller
 * Controlador de la pantalla completa de Login, Registro y Selector Multicuenta de Google.
 * Soporte para selector de cuentas múltiples de Google (Account Chooser), 1-Tap Fast Login y validación reactiva.
 */

import { store } from '../core/store.js';
import { eventBus } from '../core/event-bus.js';
import { apiService } from '../services/api.service.js';
import { toast } from './toast.component.js';
import { escapeHTML } from '../utils/dom.utils.js';

const AVATAR_COLORS = ['#4285F4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

export class AuthModal {
  constructor() {
    this.overlay = document.getElementById('auth-screen-overlay');
    this.viewLogin = document.getElementById('auth-view-login');
    this.viewRegister = document.getElementById('auth-view-register');
    this.viewGoogle = document.getElementById('auth-view-google');

    this.btnSwitchToRegister = document.getElementById('btn-switch-to-register');
    this.btnSwitchToLogin = document.getElementById('btn-switch-to-login');
    this.btnBackFromGoogle = document.getElementById('btn-back-to-login-from-google');

    this.formLogin = document.getElementById('form-auth-login');
    this.formRegister = document.getElementById('form-auth-register');
    this.formGoogle = document.getElementById('form-auth-google');

    this.btnGoogleLogin = document.getElementById('btn-login-google');
    this.btnGoogleRegister = document.getElementById('btn-register-google');

    this.googleAccountsList = document.getElementById('google-accounts-list');
    this.btnGoogleAddAnother = document.getElementById('btn-google-add-another');
    this.googleCustomSection = document.getElementById('google-custom-input-section');
    this.btnCancelCustomGoogle = document.getElementById('btn-cancel-custom-google');

    this.toggleLoginPass = document.getElementById('toggle-login-pass');
    this.toggleRegisterPass = document.getElementById('toggle-register-pass');
    this.btnForgotPassword = document.getElementById('btn-forgot-password');

    this.init();
  }

  init() {
    if (!this.overlay) return;

    // 1. Alternar vistas
    if (this.btnSwitchToRegister) {
      this.btnSwitchToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearAllErrors();
        this.showRegisterView();
      });
    }

    if (this.btnSwitchToLogin) {
      this.btnSwitchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearAllErrors();
        this.showLoginView();
      });
    }

    if (this.btnBackFromGoogle) {
      this.btnBackFromGoogle.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearAllErrors();
        this.showLoginView();
      });
    }

    // 2. Mostrar / Ocultar Contraseña
    if (this.toggleLoginPass) {
      this.toggleLoginPass.addEventListener('click', () => {
        const input = document.getElementById('login-password-input');
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    }

    if (this.toggleRegisterPass) {
      this.toggleRegisterPass.addEventListener('click', () => {
        const input = document.getElementById('register-password-input');
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    }

    // 3. Envío de Formulario: Login
    if (this.formLogin) {
      this.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLoginSubmit();
      });
    }

    // 4. Envío de Formulario: Registro
    if (this.formRegister) {
      this.formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleRegisterSubmit();
      });
    }

    // 5. Envío de Formulario: Google Auth (Nueva cuenta)
    if (this.formGoogle) {
      this.formGoogle.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleGoogleFormSubmit();
      });
    }

    // 6. Botones de Continuar con Google
    if (this.btnGoogleLogin) {
      this.btnGoogleLogin.addEventListener('click', () => this.showGoogleView());
    }
    if (this.btnGoogleRegister) {
      this.btnGoogleRegister.addEventListener('click', () => this.showGoogleView());
    }

    // 7. Expansión para agregar otra cuenta de Google
    if (this.btnGoogleAddAnother) {
      this.btnGoogleAddAnother.addEventListener('click', () => {
        if (this.googleCustomSection) {
          const isHidden = this.googleCustomSection.style.display === 'none';
          this.googleCustomSection.style.display = isHidden ? 'block' : 'none';
          if (isHidden) {
            const input = document.getElementById('google-email-input');
            if (input) setTimeout(() => input.focus(), 50);
          }
        }
      });
    }

    if (this.btnCancelCustomGoogle) {
      this.btnCancelCustomGoogle.addEventListener('click', () => {
        if (this.googleCustomSection) {
          this.googleCustomSection.style.display = 'none';
        }
      });
    }

    // 8. Olvidé mi contraseña
    if (this.btnForgotPassword) {
      this.btnForgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        toast.info('Para recuperar tu clave, ingresa tu correo o comunícate con soporte.');
      });
    }

    // 9. Eventos globales
    eventBus.on('auth:open', () => {
      this.clearAllErrors();
      this.show();
    });

    eventBus.on('user:loggedOut', () => {
      this.clearAllErrors();
      this.showLoginView();
      this.show();
    });

    this.initRealtimeValidation();
    this.checkInitialAuthState();
  }

  initRealtimeValidation() {
    const inputs = this.overlay.querySelectorAll('.auth-input-control');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.clearFieldError(input);
      });
    });
  }

  checkInitialAuthState() {
    const user = store.getUser();
    const token = localStorage.getItem('focusflow_auth_token');

    if (!user || !token) {
      this.show();
    } else {
      this.updateTopbarUser(user);
    }
  }

  show() {
    document.documentElement.classList.remove('authenticated-boot');
    document.documentElement.classList.add('unauthenticated-boot');
    if (this.overlay) {
      this.overlay.classList.remove('hidden');
    }
  }

  hide() {
    document.documentElement.classList.remove('unauthenticated-boot');
    document.documentElement.classList.add('authenticated-boot');
    if (this.overlay) {
      this.overlay.classList.add('hidden');
    }
  }

  showLoginView() {
    if (this.viewLogin) this.viewLogin.style.display = 'block';
    if (this.viewRegister) this.viewRegister.style.display = 'none';
    if (this.viewGoogle) this.viewGoogle.style.display = 'none';
  }

  showRegisterView() {
    if (this.viewLogin) this.viewLogin.style.display = 'none';
    if (this.viewRegister) this.viewRegister.style.display = 'block';
    if (this.viewGoogle) this.viewGoogle.style.display = 'none';
  }

  showGoogleView() {
    this.clearAllErrors();
    if (this.viewLogin) this.viewLogin.style.display = 'none';
    if (this.viewRegister) this.viewRegister.style.display = 'none';
    if (this.viewGoogle) this.viewGoogle.style.display = 'block';

    if (this.googleCustomSection) {
      this.googleCustomSection.style.display = 'none';
    }

    this.renderGoogleAccountsList();
  }

  /* --- Cuentas de Google Guardadas y Selector --- */
  getSavedGoogleAccounts() {
    const raw = localStorage.getItem('focusflow_saved_google_accounts');
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }

    const currentUser = store.getUser();
    const defaultAccounts = currentUser ? [
      { name: currentUser.name || 'Danny Eduardo', email: currentUser.email || 'dannyeduardoanasi@gmail.com', isCurrent: true }
    ] : [];

    localStorage.setItem('focusflow_saved_google_accounts', JSON.stringify(defaultAccounts));
    return defaultAccounts;
  }

  saveGoogleAccount(name, email) {
    let accounts = this.getSavedGoogleAccounts();
    const existingIndex = accounts.findIndex(a => a.email.toLowerCase() === email.toLowerCase());

    if (existingIndex !== -1) {
      accounts[existingIndex].name = name;
      accounts[existingIndex].isCurrent = true;
    } else {
      accounts.forEach(a => a.isCurrent = false);
      accounts.unshift({ name, email, isCurrent: true });
    }

    if (accounts.length > 6) accounts = accounts.slice(0, 6);
    localStorage.setItem('focusflow_saved_google_accounts', JSON.stringify(accounts));
    return accounts;
  }

  removeGoogleAccount(email) {
    let accounts = this.getSavedGoogleAccounts();
    accounts = accounts.filter(a => a.email.toLowerCase() !== email.toLowerCase());
    localStorage.setItem('focusflow_saved_google_accounts', JSON.stringify(accounts));
    toast.info(`Cuenta ${email} eliminada de este equipo.`);
    this.renderGoogleAccountsList();

    if (accounts.length === 0 && this.googleCustomSection) {
      this.googleCustomSection.style.display = 'block';
    }
  }

  renderGoogleAccountsList() {
    if (!this.googleAccountsList) return;

    const accounts = this.getSavedGoogleAccounts();

    if (accounts.length === 0) {
      this.googleAccountsList.innerHTML = `
        <div style="text-align: center; padding: 16px 12px; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-subtle); border-radius: 12px; margin-bottom: 12px;">
          <p style="font-size: 12.5px; color: var(--text-secondary); margin: 0 0 6px 0;">No hay cuentas guardadas en este dispositivo.</p>
          <span style="font-size: 11px; color: var(--text-muted);">Usa el botón de abajo para ingresar con una cuenta de Google.</span>
        </div>
      `;
      return;
    }

    this.googleAccountsList.innerHTML = accounts.map((acc, index) => {
      const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
      const initial = (acc.name || acc.email).charAt(0).toUpperCase();

      return `
        <div class="google-account-item" data-google-email="${escapeHTML(acc.email)}" data-google-name="${escapeHTML(acc.name)}">
          <div class="google-account-main-click" title="Entrar como ${escapeHTML(acc.name || acc.email)}">
            <div class="google-account-avatar" style="background-color: ${color};">
              ${escapeHTML(initial)}
            </div>
            <div class="google-account-info">
              <div class="google-account-name">${escapeHTML(acc.name)}</div>
              <div class="google-account-email">${escapeHTML(acc.email)}</div>
            </div>
            <div class="google-account-arrow" title="Iniciar sesión">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
          <button type="button" class="google-account-remove-btn" data-action="remove" data-email="${escapeHTML(acc.email)}" title="Quitar cuenta de este dispositivo" aria-label="Quitar cuenta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    // Manejar eventos de clic (Entrar o Quitar)
    const items = this.googleAccountsList.querySelectorAll('.google-account-item');
    items.forEach(item => {
      const mainClick = item.querySelector('.google-account-main-click');
      const removeBtn = item.querySelector('.google-account-remove-btn');

      if (mainClick) {
        mainClick.onclick = async () => {
          const email = item.getAttribute('data-google-email');
          const name = item.getAttribute('data-google-name');
          if (email) {
            await this.loginWithGoogleAccount(email, name || email.split('@')[0]);
          }
        };
      }

      if (removeBtn) {
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          const targetEmail = removeBtn.getAttribute('data-email');
          if (targetEmail) {
            this.removeGoogleAccount(targetEmail);
          }
        };
      }
    });
  }

  /* --- Funciones Auxiliares de Validación y Errores Visuales --- */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  showFieldError(inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.add('is-invalid');

    const group = inputEl.closest('.auth-input-group');
    if (group) {
      let errorSpan = group.querySelector('.auth-inline-error');
      if (!errorSpan) {
        errorSpan = document.createElement('span');
        errorSpan.className = 'auth-inline-error';
        group.appendChild(errorSpan);
      }
      errorSpan.textContent = message;
    }
  }

  clearFieldError(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove('is-invalid');

    const group = inputEl.closest('.auth-input-group');
    if (group) {
      const errorSpan = group.querySelector('.auth-inline-error');
      if (errorSpan) errorSpan.remove();
    }
  }

  showBannerError(viewElement, message) {
    if (!viewElement) return;
    let banner = viewElement.querySelector('.auth-alert-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'auth-alert-banner';
      const form = viewElement.querySelector('.auth-form');
      if (form) viewElement.insertBefore(banner, form);
    }
    banner.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>${message}</span>
    `;
    banner.classList.remove('hidden');
  }

  hideBannerError() {
    const banners = this.overlay.querySelectorAll('.auth-alert-banner');
    banners.forEach(b => b.classList.add('hidden'));
  }

  clearAllErrors() {
    this.hideBannerError();
    const inputs = this.overlay.querySelectorAll('.auth-input-control');
    inputs.forEach(input => this.clearFieldError(input));
  }

  /* --- Manejadores de Formularios --- */
  async handleLoginSubmit() {
    this.clearAllErrors();

    const emailInput = document.getElementById('login-email-input');
    const passInput = document.getElementById('login-password-input');
    const submitBtn = document.getElementById('btn-submit-login');

    if (!emailInput || !passInput) return;

    const email = emailInput.value.trim();
    const password = passInput.value;

    let hasErrors = false;

    if (!email) {
      this.showFieldError(emailInput, 'Por favor ingresa tu correo electrónico');
      hasErrors = true;
    } else if (!this.isValidEmail(email)) {
      this.showFieldError(emailInput, 'El formato del correo es inválido (ej: usuario@correo.com)');
      hasErrors = true;
    }

    if (!password) {
      this.showFieldError(passInput, 'Por favor ingresa tu contraseña');
      hasErrors = true;
    } else if (password.length < 6) {
      this.showFieldError(passInput, 'La contraseña debe tener al menos 6 caracteres');
      hasErrors = true;
    }

    if (hasErrors) return;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Iniciando sesión...';

      const data = await apiService.login(email, password);

      if (data && data.user) {
        store.setUser(data.user);
        this.updateTopbarUser(data.user);
        this.hide();
        toast.success(`Bienvenido de nuevo, ${data.user.name.split(' ')[0]}.`);
      } else {
        this.showBannerError(this.viewLogin, 'Credenciales incorrectas. Verifica tu correo y contraseña.');
      }
    } catch (err) {
      const errorMsg = err.message || 'No se pudo iniciar sesión. Verifica tu conexión.';
      this.showBannerError(this.viewLogin, errorMsg);
      toast.error(errorMsg);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'INICIAR SESIÓN';
    }
  }

  async handleRegisterSubmit() {
    this.clearAllErrors();

    const nameInput = document.getElementById('register-name-input');
    const emailInput = document.getElementById('register-email-input');
    const passInput = document.getElementById('register-password-input');
    const confirmPassInput = document.getElementById('register-confirm-password-input');
    const submitBtn = document.getElementById('btn-submit-register');

    if (!nameInput || !emailInput || !passInput || !confirmPassInput) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passInput.value;
    const confirmPassword = confirmPassInput.value;

    let hasErrors = false;

    if (!name || name.length < 2) {
      this.showFieldError(nameInput, 'El nombre debe tener al menos 2 caracteres');
      hasErrors = true;
    }

    if (!email) {
      this.showFieldError(emailInput, 'Por favor ingresa un correo electrónico');
      hasErrors = true;
    } else if (!this.isValidEmail(email)) {
      this.showFieldError(emailInput, 'El correo no es válido (ej: usuario@correo.com)');
      hasErrors = true;
    }

    if (!password) {
      this.showFieldError(passInput, 'Por favor escribe una contraseña');
      hasErrors = true;
    } else if (password.length < 6) {
      this.showFieldError(passInput, 'La contraseña debe tener al menos 6 caracteres');
      hasErrors = true;
    }

    if (password !== confirmPassword) {
      this.showFieldError(confirmPassInput, 'Las contraseñas no coinciden');
      hasErrors = true;
    }

    if (hasErrors) return;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creando cuenta...';

      const data = await apiService.register({ name, email, password });

      if (data && data.user) {
        store.setUser(data.user);
        this.updateTopbarUser(data.user);
        this.hide();
        toast.success(`¡Cuenta creada con éxito! Bienvenido, ${data.user.name.split(' ')[0]}.`);
      } else {
        this.showBannerError(this.viewRegister, 'No se pudo crear la cuenta. Intenta de nuevo.');
      }
    } catch (err) {
      const errorMsg = err.message || 'Error al registrar el usuario';
      this.showBannerError(this.viewRegister, errorMsg);
      toast.error(errorMsg);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'CREAR CUENTA GRATIS';
    }
  }

  async handleGoogleFormSubmit() {
    this.clearAllErrors();

    const googleEmailInput = document.getElementById('google-email-input');
    if (!googleEmailInput) return;

    const email = googleEmailInput.value.trim();

    if (!email) {
      this.showFieldError(googleEmailInput, 'Por favor ingresa un correo de Google');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showFieldError(googleEmailInput, 'Ingresa una dirección de correo válida');
      return;
    }

    const defaultName = email.split('@')[0];
    const googleName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);

    this.saveGoogleAccount(googleName, email);
    await this.loginWithGoogleAccount(email, googleName);
  }

  async loginWithGoogleAccount(email, name) {
    const submitBtn = document.getElementById('btn-submit-google-auth');

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Accediendo...';
      }

      toast.info(`Conectando con ${email}...`);

      const data = await apiService.googleLogin({
        email,
        name,
      });

      if (data && data.user) {
        this.saveGoogleAccount(data.user.name, data.user.email);

        store.setUser(data.user);
        this.updateTopbarUser(data.user);
        this.hide();
        toast.success(`¡Sesión iniciada con Google (${data.user.email})!`);
      } else {
        this.showBannerError(this.viewGoogle, 'No se pudo conectar con la cuenta de Google.');
      }
    } catch (err) {
      const msg = err.message || 'Error al autenticar con Google';
      this.showBannerError(this.viewGoogle, msg);
      toast.error(msg);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'AGREGAR Y ENTRAR';
      }
    }
  }

  updateTopbarUser(user) {
    if (!user) return;

    // Solicitar permisos nativos de notificaciones al iniciar sesión
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const greetingNameEl = document.querySelector('.welcome-name, .dashboard-greeting strong');
    if (greetingNameEl) {
      greetingNameEl.textContent = user.name.split(' ')[0];
    }

    const popoverNameEl = document.querySelector('#profile-popover strong');
    const popoverEmailEl = document.querySelector('#profile-popover span');
    if (popoverNameEl) popoverNameEl.textContent = user.name;
    if (popoverEmailEl) popoverEmailEl.textContent = user.email;
  }
}
