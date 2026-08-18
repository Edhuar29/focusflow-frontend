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
 * Sanitiza texto para evitar inyecciones XSS
 */
export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
