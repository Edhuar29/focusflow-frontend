/**
 * FocusFlow Web - Configuration: Environment & API Endpoints
 * Permite alternar fácilmente entre entorno local y la URL del Backend en producción.
 */

export const CONFIG = {
  // Cuando despliegues tu backend en Vercel/Koyeb, cambia esta URL por la tuya (ej. 'https://tu-backend.vercel.app/api')
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://focusflow-backend-api.vercel.app/api', // Reemplazar con tu URL de backend en producción
  
  APP_NAME: 'FocusFlow Web',
  VERSION: '1.0.0',
};
