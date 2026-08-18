/**
 * FocusFlow Web - Configuration: Environment & API Endpoints
 * Conectado a la API REST de producción en Vercel y Supabase.
 */

export const CONFIG = {
  // URL de tu Backend desplegado en Vercel
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://focusflow-backend-two.vercel.app/api',
  
  APP_NAME: 'FocusFlow Web',
  VERSION: '1.0.0',
};
