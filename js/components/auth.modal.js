/**
 * EdhuFlow - Components: Auth Modal & Screen Controller
 * Controlador profesional de Inicio de Sesión, Registro y autenticación oficial con Google (1-Tap & OAuth).
 */

import { store } from '../core/store.js';
import { eventBus } from '../core/event-bus.js';
import { apiService } from '../services/api.service.js';
import { toast } from './toast.component.js';
import { escapeHTML } from '../utils/dom.utils.js';

export class AuthModal {
  constructor() {
    this.overlay = document.getElementById('auth-screen-overlay');
    this.viewLogin = document.getElementById('auth-view-login');
    this.viewRegister = document.getElementById('auth-view-register');

    this.btnSwitchToRegister = document.getElementById('btn-switch-to-register');
    this.btnSwitchToLogin = document.getElementById('btn-switch-to-login');

    this.formLogin = document.getElementById('form-auth-login');
    this.formRegister = document.getElementById('form-auth-register');

    this.btnGoogleLogin = document.getElementById('btn-login-google');
    this.btnGoogleRegister = document.getElementById('btn-register-google');

    this.savedAccountCard = document.getElementById('auth-saved-account-card');
    this.savedAccountAvatar = document.getElementById('saved-account-avatar');
    this.savedAccountName = document.getElementById('saved-account-name');
    this.savedAccountEmail = document.getElementById('saved-account-email');
    this.btnFastContinue = document.getElementById('btn-fast-continue-user');
    this.btnFastContinueText = document.getElementById('btn-fast-continue-text');
    this.btnSwitchSavedAccount = document.getElementById('btn-switch-saved-account');
    this.standardGoogleSection = document.getElementById('auth-standard-google-section');

    this.toggleLoginPass = document.getElementById('toggle-login-pass');
    this.toggleRegisterPass = document.getElementById('toggle-register-pass');
    this.btnForgotPassword = document.getElementById('btn-forgot-password');

    this.init();
  }

  init() {
    if (!this.overlay) return;

    // 1. Alternar vistas entre Login y Registro
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

    // 5. Botones de Continuar con Google
    if (this.btnGoogleLogin) {
      this.btnGoogleLogin.addEventListener('click', () => this.triggerGoogleSignIn());
    }
    if (this.btnGoogleRegister) {
      this.btnGoogleRegister.addEventListener('click', () => this.triggerGoogleSignIn());
    }

    // 5.1 Acceso Rápido en 1-Clic para Usuario Frecuente
    if (this.btnFastContinue) {
      this.btnFastContinue.addEventListener('click', async () => {
        await this.loginWithSavedProfile();
      });
    }

    if (this.btnSwitchSavedAccount) {
      this.btnSwitchSavedAccount.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSwitchAccount(true);
      });
    }

    // 6. Olvidé mi contraseña
    if (this.btnForgotPassword) {
      this.btnForgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        toast.info('Para recuperar tu clave, ingresa tu correo registrado o comunícate con soporte.');
      });
    }

    // 7. Eventos globales
    eventBus.on('auth:open', () => {
      this.clearAllErrors();
      this.renderSavedAccountCard();
      this.show();
    });

    eventBus.on('user:loggedOut', () => {
      this.clearAllErrors();
      this.showLoginView();
      this.renderSavedAccountCard();
      this.show();
    });

    this.initRealtimeValidation();
    this.initGoogleIdentityServices();
    this.checkInitialAuthState();
  }

  /* --- Manejo de Perfil Guardado (Acceso Rápido en 1 Clic) --- */
  getSavedProfile() {
    const raw = localStorage.getItem('edhuflow_saved_google_profile');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return null;
  }

  saveSavedProfile(user) {
    if (!user || !user.email) return;
    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      lastLogin: Date.now()
    };
    localStorage.setItem('edhuflow_saved_google_profile', JSON.stringify(profile));
  }

  renderSavedAccountCard() {
    const profile = this.getSavedProfile();
    if (!this.savedAccountCard) return;

    if (profile && profile.email) {
      const firstName = (profile.name || profile.email).split(' ')[0];
      const initial = (profile.name || profile.email).charAt(0).toUpperCase();

      if (this.savedAccountName) this.savedAccountName.textContent = profile.name || profile.email;
      if (this.savedAccountEmail) this.savedAccountEmail.textContent = profile.email;
      if (this.btnFastContinueText) this.btnFastContinueText.textContent = `Continuar como ${firstName}`;

      if (this.savedAccountAvatar) {
        if (profile.avatarUrl) {
          this.savedAccountAvatar.innerHTML = `<img src="${escapeHTML(profile.avatarUrl)}" alt="${escapeHTML(firstName)}" />`;
        } else {
          this.savedAccountAvatar.textContent = initial;
        }
      }

      this.savedAccountCard.style.display = 'block';
      if (this.standardGoogleSection) this.standardGoogleSection.style.display = 'none';
    } else {
      this.savedAccountCard.style.display = 'none';
      if (this.standardGoogleSection) this.standardGoogleSection.style.display = 'block';
    }
  }

  toggleSwitchAccount(showStandard) {
    if (showStandard) {
      if (this.savedAccountCard) this.savedAccountCard.style.display = 'none';
      if (this.standardGoogleSection) this.standardGoogleSection.style.display = 'block';
    } else {
      this.renderSavedAccountCard();
    }
  }

  async loginWithSavedProfile() {
    const profile = this.getSavedProfile();
    if (!profile || !profile.email) {
      this.triggerGoogleSignIn();
      return;
    }

    if (this.btnFastContinue) {
      this.btnFastContinue.disabled = true;
      this.btnFastContinue.style.opacity = '0.75';
    }

    await this.loginWithGoogleAccount(profile.email, profile.name, profile.avatarUrl);

    if (this.btnFastContinue) {
      this.btnFastContinue.disabled = false;
      this.btnFastContinue.style.opacity = '1';
    }
  }

  initGoogleIdentityServices() {
    const setupGSI = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          const clientId = window.EDHUFLOW_GOOGLE_CLIENT_ID || '260931319911-qfpm8hspt344ubplhmudij7480fdseho.apps.googleusercontent.com';
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              if (response && response.credential) {
                await this.loginWithGoogleCredential(response.credential);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });
        } catch (e) {
          console.warn('[AuthModal] Google Identity Services init:', e);
        }
      }
    };

    if (window.google && window.google.accounts) {
      setupGSI();
    } else {
      window.addEventListener('load', setupGSI);
    }
  }

  async triggerGoogleSignIn() {
    this.clearAllErrors();

    if (window.google && window.google.accounts && window.google.accounts.id) {
      this.initGoogleIdentityServices();
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.info('[AuthModal] GSI prompt no visible o cerrado:', notification.getNotDisplayedReason?.() || notification.getSkippedReason?.());
        }
      });
      return;
    }

    toast.info('Cargando servicios de autenticación de Google...');
  }

  async loginWithGoogleCredential(credential) {
    try {
      toast.info('Verificando credenciales criptográficas con Google...');

      const data = await apiService.googleLogin({ credential });

      if (data && data.user) {
        this.saveSavedProfile(data.user);
        store.setUser(data.user);
        this.updateTopbarUser(data.user);
        this.hide();
        toast.success(`¡Bienvenido a EdhuFlow, ${data.user.name.split(' ')[0]}!`);
      } else {
        this.showBannerError(this.viewLogin, 'No se pudo verificar la sesión con Google.');
      }
    } catch (err) {
      const msg = err.message || 'Error al autenticar con Google';
      this.showBannerError(this.viewLogin, msg);
      toast.error(msg);
    }
  }

  initRealtimeValidation() {
    const inputs = this.overlay.querySelectorAll('.auth-input-control');
    inputs.forEach((input) => {
      input.addEventListener('input', () => {
        this.clearFieldError(input);
      });
    });
  }

  checkInitialAuthState() {
    const user = store.getUser();
    const token = localStorage.getItem('focusflow_auth_token');

    if (!user || !token) {
      this.renderSavedAccountCard();
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
    this.renderSavedAccountCard();
  }

  showRegisterView() {
    if (this.viewLogin) this.viewLogin.style.display = 'none';
    if (this.viewRegister) this.viewRegister.style.display = 'block';
  }

  /* --- Helpers de Validación & UI --- */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  showFieldError(input, message) {
    if (!input) return;
    input.classList.add('is-invalid');
    const group = input.closest('.auth-input-group') || input.parentElement;

    let errorEl = group.querySelector('.auth-field-error-msg');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'auth-field-error-msg';
      group.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }

  clearFieldError(input) {
    if (!input) return;
    input.classList.remove('is-invalid');
    const group = input.closest('.auth-input-group') || input.parentElement;
    const errorEl = group.querySelector('.auth-field-error-msg');
    if (errorEl) errorEl.remove();
  }

  showBannerError(viewElement, message) {
    if (!viewElement) return;
    let banner = viewElement.querySelector('.auth-alert-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'auth-alert-banner';
      const header = viewElement.querySelector('.auth-card-header');
      if (header) header.insertAdjacentElement('afterend', banner);
      else viewElement.prepend(banner);
    }

    banner.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>${escapeHTML(message)}</span>
    `;
    banner.classList.remove('hidden');
  }

  hideBannerError() {
    const banners = this.overlay.querySelectorAll('.auth-alert-banner');
    banners.forEach((b) => b.classList.add('hidden'));
  }

  clearAllErrors() {
    this.hideBannerError();
    const inputs = this.overlay.querySelectorAll('.auth-input-control');
    inputs.forEach((input) => this.clearFieldError(input));
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
