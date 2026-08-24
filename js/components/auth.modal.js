/**
 * EdhuFlow - Components: Auth Modal & Screen Controller
 * Controlador profesional de Inicio de Sesión, Registro y autenticación oficial con Google (1-Tap & OAuth).
 */

import { store } from '../core/store.js';
import { eventBus } from '../core/event-bus.js';
import { apiService } from '../services/api.service.js';
import { StorageService } from '../services/storage.service.js';
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

    const btnRegisterBack = document.getElementById('btn-register-back-to-login');
    if (btnRegisterBack) {
      btnRegisterBack.addEventListener('click', (e) => {
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
    this.initLanguageSwitcher();
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

  saveSavedProfile(user, token) {
    if (!user || !user.email) return;
    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url || user.avatarUrl,
      lastLogin: Date.now()
    };
    localStorage.setItem('edhuflow_saved_google_profile', JSON.stringify(profile));
    if (token) {
      localStorage.setItem('edhuflow_saved_quick_token', token);
    }
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
    const profile = this.getSavedProfile() || StorageService.get('user', null);
    const quickToken = localStorage.getItem('edhuflow_saved_quick_token') || localStorage.getItem('focusflow_auth_token');

    // 1. Intento de Acceso Instantáneo en 1 Clic (0.1s sin popups)
    if (profile && profile.email && quickToken) {
      try {
        const firstName = (profile.name || profile.email).split(' ')[0];
        toast.info(`Iniciando sesión como ${firstName}...`);

        const data = await apiService.quickLogin(profile.email, quickToken);

        if (data && data.user) {
          if (data.token) {
            localStorage.setItem('edhuflow_saved_quick_token', data.token);
            apiService.setToken(data.token);
          }
          this.saveSavedProfile(data.user, data.token);
          store.setUser(data.user);
          this.updateTopbarUser(data.user);
          this.hide();
          toast.success(`¡Bienvenido de nuevo, ${(data.user.name || profile.name).split(' ')[0]}!`);
          return;
        }
      } catch (err) {
        console.warn('[AuthModal] Token rápido expirado, reautenticando con Google:', err);
      }
    }

    // 2. Si el token expiró, reautenticar con Google seleccionando a Danny automáticamente
    await this.triggerGoogleSignIn(profile ? profile.email : undefined);
  }

  initGoogleIdentityServices() {
    const setupGSI = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          const clientId = window.EDHUFLOW_GOOGLE_CLIENT_ID || '71935301075-58jenh2gfnk43ng0n3rqhip81hq088kc.apps.googleusercontent.com';
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

  async triggerGoogleSignIn(loginHint) {
    this.clearAllErrors();

    const clientId = window.EDHUFLOW_GOOGLE_CLIENT_ID || '71935301075-58jenh2gfnk43ng0n3rqhip81hq088kc.apps.googleusercontent.com';

    // 1. Google OAuth2 Token Client (Con login_hint para omitir la lista de selección)
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              toast.info('Obteniendo perfil de Google...');
              try {
                const data = await apiService.googleLogin({
                  accessToken: tokenResponse.access_token,
                });

                if (data && data.user) {
                  this.saveSavedProfile(data.user, data.token);
                  store.setUser(data.user);
                  this.updateTopbarUser(data.user);
                  this.hide();
                  toast.success(`¡Bienvenido a EdhuFlow, ${data.user.name.split(' ')[0]}!`);
                  return;
                }
              } catch (fetchErr) {
                console.error('[AuthModal] Google userinfo fetch error:', fetchErr);
              }
            }
          }
        });

        const requestOptions = loginHint ? { hint: loginHint } : { prompt: 'select_account' };
        tokenClient.requestAccessToken(requestOptions);
        return;
      } catch (oauthErr) {
        console.warn('[AuthModal] oauth2 tokenClient error, fallback to One Tap:', oauthErr);
      }
    }

    // 2. Google One Tap prompt
    if (window.google && window.google.accounts && window.google.accounts.id) {
      this.initGoogleIdentityServices();
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.info('[AuthModal] GSI prompt suppressed:', notification.getNotDisplayedReason?.());
          const saved = this.getSavedProfile() || StorageService.get('user', null);
          if (saved && saved.email) {
            this.loginWithSavedProfile();
          }
        }
      });
      return;
    }

    // 3. Fallback de inicio con perfil guardado
    const saved = this.getSavedProfile() || StorageService.get('user', null);
    if (saved && saved.email) {
      await this.loginWithSavedProfile();
      return;
    }

    toast.info('Cargando servicios de Google... Por favor espera un momento.');
  }

  async loginWithGoogleCredential(credential) {
    try {
      toast.info('Verificando cuenta de Google...');

      let email = undefined;
      let name = undefined;
      let avatarUrl = undefined;

      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const payload = JSON.parse(jsonPayload);
          email = payload.email;
          name = payload.name || payload.given_name || (email ? email.split('@')[0] : undefined);
          avatarUrl = payload.picture;
        }
      } catch (e) {
        console.warn('[AuthModal] Could not parse JWT payload locally:', e);
      }

      const data = await apiService.googleLogin({
        credential,
        email,
        name,
        avatar_url: avatarUrl,
      });

      if (data && data.user) {
        this.saveSavedProfile(data.user, data.token);
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
        this.saveSavedProfile(data.user, data.token);
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
        this.saveSavedProfile(data.user, data.token);
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

  initLanguageSwitcher() {
    const langBtns = document.querySelectorAll('.auth-lang-btn');
    const savedLang = localStorage.getItem('edhuflow_lang') || 'es';

    const translations = {
      es: {
        loginTitle: 'Iniciar sesión en EdhuFlow',
        emailPlaceholder: 'Correo electrónico o usuario',
        passPlaceholder: 'Contraseña',
        loginBtn: 'Iniciar sesión',
        googleBtn: 'Continuar con Google',
        forgotPass: '¿Olvidaste tu contraseña?',
        createAccountBtn: 'Crear cuenta nueva',
        heroTagline: 'Encuentra tu ritmo, domina tu enfoque.',
        regTitle: 'Empieza a usar EdhuFlow',
        regSubtitle: 'Crea tu cuenta para acceder a tu panel de enfoque, hábitos y recordatorios de forma fácil y segura.',
        namePlaceholder: 'Nombre completo',
        regEmailPlaceholder: 'Correo electrónico',
        regPassPlaceholder: 'Contraseña (mínimo 6 caracteres)',
        confirmPassPlaceholder: 'Confirmar contraseña',
        regBtn: 'Crear cuenta',
        haveAccountBtn: 'Ya tengo una cuenta',
        toastSwitch: 'Idioma cambiado a Español',
      },
      en: {
        loginTitle: 'Log in to EdhuFlow',
        emailPlaceholder: 'Email or username',
        passPlaceholder: 'Password',
        loginBtn: 'Log In',
        googleBtn: 'Continue with Google',
        forgotPass: 'Forgot password?',
        createAccountBtn: 'Create new account',
        heroTagline: 'Find your flow, master your focus.',
        regTitle: 'Get started with EdhuFlow',
        regSubtitle: 'Create an account to access your focus dashboard, habits, and smart reminders.',
        namePlaceholder: 'Full name',
        regEmailPlaceholder: 'Email address',
        regPassPlaceholder: 'Password (min. 6 characters)',
        confirmPassPlaceholder: 'Confirm password',
        regBtn: 'Create account',
        haveAccountBtn: 'Already have an account',
        toastSwitch: 'Language switched to English',
      },
      pt: {
        loginTitle: 'Entrar no EdhuFlow',
        emailPlaceholder: 'E-mail ou nome de usuário',
        passPlaceholder: 'Senha',
        loginBtn: 'Entrar',
        googleBtn: 'Continuar com o Google',
        forgotPass: 'Esqueceu a senha?',
        createAccountBtn: 'Criar nova conta',
        heroTagline: 'Encontre seu ritmo, domine seu foco.',
        regTitle: 'Comece a usar o EdhuFlow',
        regSubtitle: 'Crie sua conta para acessar seu painel de foco, hábitos e lembretes.',
        namePlaceholder: 'Nome completo',
        regEmailPlaceholder: 'E-mail',
        regPassPlaceholder: 'Senha (mínimo 6 caracteres)',
        confirmPassPlaceholder: 'Confirmar senha',
        regBtn: 'Criar conta',
        haveAccountBtn: 'Já tenho uma conta',
        toastSwitch: 'Idioma alterado para Português',
      },
      fr: {
        loginTitle: 'Se connecter à EdhuFlow',
        emailPlaceholder: "E-mail ou nom d'utilisateur",
        passPlaceholder: 'Mot de passe',
        loginBtn: 'Se connecter',
        googleBtn: 'Continuer avec Google',
        forgotPass: 'Mot de passe oublié ?',
        createAccountBtn: 'Créer un nouveau compte',
        heroTagline: 'Trouvez votre rythme, maîtrisez votre concentration.',
        regTitle: 'Commencez à utiliser EdhuFlow',
        regSubtitle: 'Créez votre compte pour accéder à votre tableau de bord et rappels.',
        namePlaceholder: 'Nom complet',
        regEmailPlaceholder: 'Adresse e-mail',
        regPassPlaceholder: 'Mot de passe (min. 6 caractères)',
        confirmPassPlaceholder: 'Confirmer le mot de passe',
        regBtn: 'Créer un compte',
        haveAccountBtn: "J'ai déjà un compte",
        toastSwitch: 'Langue changée en Français',
      }
    };

    const applyLanguage = (lang) => {
      const t = translations[lang] || translations.es;
      localStorage.setItem('edhuflow_lang', lang);

      langBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
      });

      const loginTitle = document.getElementById('auth-main-login-title');
      if (loginTitle) loginTitle.textContent = t.loginTitle;

      const emailInput = document.getElementById('login-email-input');
      if (emailInput) emailInput.placeholder = t.emailPlaceholder;

      const passInput = document.getElementById('login-password-input');
      if (passInput) passInput.placeholder = t.passPlaceholder;

      const submitLogin = document.getElementById('btn-submit-login');
      if (submitLogin) submitLogin.textContent = t.loginBtn;

      const btnGoogleLoginText = document.querySelector('#btn-login-google span');
      if (btnGoogleLoginText) btnGoogleLoginText.textContent = t.googleBtn;

      const btnGoogleRegText = document.querySelector('#btn-register-google span');
      if (btnGoogleRegText) btnGoogleRegText.textContent = t.googleBtn;

      const forgotLink = document.getElementById('btn-forgot-password');
      if (forgotLink) forgotLink.textContent = t.forgotPass;

      const switchRegBtn = document.getElementById('btn-switch-to-register');
      if (switchRegBtn) switchRegBtn.textContent = t.createAccountBtn;

      const heroTagline = document.querySelector('.auth-tagline');
      if (heroTagline) heroTagline.textContent = t.heroTagline;

      const regTitle = document.querySelector('#auth-view-register .auth-fb-title');
      if (regTitle) regTitle.textContent = t.regTitle;

      const regSubtitle = document.querySelector('#auth-view-register .auth-fb-subtitle');
      if (regSubtitle) regSubtitle.textContent = t.regSubtitle;

      const regName = document.getElementById('register-name-input');
      if (regName) regName.placeholder = t.namePlaceholder;

      const regEmail = document.getElementById('register-email-input');
      if (regEmail) regEmail.placeholder = t.regEmailPlaceholder;

      const regPass = document.getElementById('register-password-input');
      if (regPass) regPass.placeholder = t.regPassPlaceholder;

      const regConfirm = document.getElementById('register-confirm-password-input');
      if (regConfirm) regConfirm.placeholder = t.confirmPassPlaceholder;

      const submitReg = document.getElementById('btn-submit-register');
      if (submitReg) submitReg.textContent = t.regBtn;

      const switchLoginBtn = document.getElementById('btn-switch-to-login');
      if (switchLoginBtn) switchLoginBtn.textContent = t.haveAccountBtn;
    };

    langBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        applyLanguage(lang);
        const t = translations[lang] || translations.es;
        if (window.toast) toast.info(t.toastSwitch);
      });
    });

    applyLanguage(savedLang);
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
