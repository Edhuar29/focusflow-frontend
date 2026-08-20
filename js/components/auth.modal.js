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
      this.show();
    });

    eventBus.on('user:loggedOut', () => {
      this.clearAllErrors();
      this.showLoginView();
      this.show();
    });

    this.initRealtimeValidation();
    this.initGoogleIdentityServices();
    this.checkInitialAuthState();
  }

  initGoogleIdentityServices() {
    const setupGSI = () => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        try {
          this.googleTokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: window.EDHUFLOW_GOOGLE_CLIENT_ID || '260931319911-qfpm8hspt344ubplhmudij7480fdseho.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid',
            callback: async (tokenResponse) => {
              if (tokenResponse && tokenResponse.access_token) {
                await this.fetchGoogleUserInfoAndLogin(tokenResponse.access_token);
              } else if (tokenResponse && tokenResponse.error) {
                console.warn('[AuthModal] Google OAuth response error:', tokenResponse.error);
                toast.warning('Autorización de Google cancelada o no completada.');
              }
            },
          });
        } catch (e) {
          console.warn('[AuthModal] Google OAuth2 TokenClient init:', e);
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

    // 1. Abrir la ventana emergente oficial de Google OAuth 2.0 (accounts.google.com)
    if (this.googleTokenClient) {
      try {
        this.googleTokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (e) {
        console.warn('[AuthModal] Error solicitando token de Google:', e);
      }
    }

    // 2. Si aún no inicializó el token client, intentar inicializarlo
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      this.initGoogleIdentityServices();
      if (this.googleTokenClient) {
        this.googleTokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      }
    }

    toast.info('Iniciando ventana de Google OAuth...');
    // Redirección o popup directo a Google Accounts OAuth
    const clientId = window.EDHUFLOW_GOOGLE_CLIENT_ID || '260931319911-qfpm8hspt344ubplhmudij7480fdseho.apps.googleusercontent.com';
    const redirectUri = window.location.origin;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=email%20profile%20openid&prompt=select_account`;
    
    window.open(authUrl, 'GoogleAuthPopup', 'width=500,height=600,menubar=no,toolbar=no');
  }

  async fetchGoogleUserInfoAndLogin(accessToken) {
    try {
      toast.info('Obteniendo perfil de Google...');
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) throw new Error('No se pudo obtener la información de perfil de Google.');

      const profile = await res.json();
      if (profile && profile.email) {
        await this.loginWithGoogleAccount(profile.email, profile.name, profile.picture);
      }
    } catch (err) {
      console.error('[AuthModal] Error fetching Google userinfo:', err);
      toast.error('Error al procesar la cuenta de Google.');
    }
  }

  async loginWithGoogleAccount(email, name, avatarUrl = null) {
    try {
      toast.info(`Conectando con Google (${email})...`);

      const data = await apiService.googleLogin({
        email,
        name: name || email.split('@')[0],
        avatar_url: avatarUrl,
      });

      if (data && data.user) {
        store.setUser(data.user);
        this.updateTopbarUser(data.user);
        this.hide();
        toast.success(`¡Bienvenido a EdhuFlow, ${data.user.name.split(' ')[0]}!`);
      } else {
        this.showBannerError(this.viewLogin, 'No se pudo conectar con Google.');
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
