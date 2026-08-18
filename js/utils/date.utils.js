/**
 * FocusFlow Web - Core: Date & Time Utilities
 * Cálculos precisos de calendario semanal, formateo, saludos y conversiones de hora.
 */

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Retorna la fecha actual del sistema en formato ISO YYYY-MM-DD
 */
export function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna el saludo según la hora del día del sistema
 */
export function getGreetingForNow() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Genera los 7 días de la semana según el offset semanal relativo a hoy
 */
export function getWeekDays(offsetWeeks = 0) {
  const now = new Date();
  const currentDay = now.getDay();
  // Ajuste para que la semana inicie en Lunes (0) a Domingo (6)
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + (offsetWeeks * 7));

  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    const fullDate = `${year}-${month}-${dayNum}`;

    week.push({
      dateObj: d,
      fullDate,
      dayName: DAYS_ES[d.getDay()],
      dateLabel: String(d.getDate()).padStart(2, '0'),
      monthName: MONTHS_ES[d.getMonth()]
    });
  }

  return week;
}

/**
 * Retorna el título descriptivo del rango semanal
 */
export function getWeekRangeTitle(offsetWeeks = 0) {
  const days = getWeekDays(offsetWeeks);
  const first = days[0];
  const last = days[6];

  if (first.dateObj.getMonth() === last.dateObj.getMonth()) {
    return `${first.dateLabel} - ${last.dateLabel} ${first.monthName} ${first.dateObj.getFullYear()}`;
  }
  return `${first.dateLabel} ${first.monthName} - ${last.dateLabel} ${last.monthName} ${last.dateObj.getFullYear()}`;
}

/**
 * Limpia y normaliza el string de hora
 */
export function formatCleanTime(timeStr) {
  if (!timeStr) return '12:00 PM';
  const clean = timeStr.trim();
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(clean)) {
    return clean.toUpperCase();
  }
  if (/^\d{1,2}:\d{2}$/.test(clean)) {
    return timeTo12(clean);
  }
  return clean;
}

/**
 * Convierte formato 12h (ej. "3:00 PM") a formato 24h (ej. "15:00") para <input type="time">
 */
export function timeTo24(time12) {
  if (!time12) return '12:00';
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return '12:00';

  let hours = parseInt(match[1], 10);
  const minutes = match[2].padStart(2, '0');
  const meridian = match[3] ? match[3].toUpperCase() : null;

  if (meridian === 'PM' && hours < 12) hours += 12;
  if (meridian === 'AM' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

/**
 * Convierte formato 24h (ej. "15:00") a formato 12h legible (ej. "3:00 PM")
 */
export function timeTo12(time24) {
  if (!time24) return '12:00 PM';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;

  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  const meridian = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${hours}:${minutes} ${meridian}`;
}
