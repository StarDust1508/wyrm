/* ============================================================
   WYRM — каркас интернационализации.
   Приложение по умолчанию РУССКОЕ (РФ-рынок, 152-ФЗ). Этот модуль — точка
   расширения: t(key, fallback) даёт строку текущего языка; если ключа нет —
   возвращает fallback (или сам ключ). Полное покрытие строк наращивается по
   мере необходимости — компоненты постепенно переводятся на t().
   Язык: VITE_LANG → localStorage('wyrm.lang') → 'ru'.
   ============================================================ */

const DICT = {
  ru: {
    'common.loading': 'Загрузка…',
    'common.more': 'Показать ещё',
    'common.loadingMore': 'Загружаю…',
    'feed.title': 'Лента',
    'auth.login': 'Вход',
    'auth.register': 'Регистрация',
    'auth.forgot': 'Забыли пароль?',
  },
  // en: { ... } — добавить при выходе на международный рынок
};

const envLang = (import.meta.env ? import.meta.env.VITE_LANG : '') || '';
function detect() {
  try { return envLang || localStorage.getItem('wyrm.lang') || 'ru'; }
  catch (_) { return envLang || 'ru'; }
}

export let lang = detect();
export const langs = Object.keys(DICT);
export function setLang(l) { lang = l; try { localStorage.setItem('wyrm.lang', l); } catch (_) {} }

export function t(key, fallback) {
  const d = DICT[lang] || DICT.ru || {};
  return Object.prototype.hasOwnProperty.call(d, key) ? d[key] : (fallback != null ? fallback : key);
}
