/**
 * FocusFlow Web - Utils: DOM Helpers
 */

export const $ = (selector, context = document) => context.querySelector(selector);
export const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

/**
 * Crea un elemento DOM con clases y atributos
 */
export function createElement(tag, { className = '', attributes = {}, innerHTML = '' } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(attributes).forEach(([key, val]) => el.setAttribute(key, val));
  if (innerHTML) el.innerHTML = innerHTML;
  return el;
}

/**
 * Sanitiza texto de manera robusta y segura para prevenir inyecciones XSS (en contenido y atributos HTML)
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  const s = typeof str === 'string' ? str : String(str);
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return s.replace(/[&<>"']/g, (m) => map[m]);
}
